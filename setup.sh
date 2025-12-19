#!/usr/bin/env bash

# ==============================================================================
# Part of >the_collective by screamingearth (Apache 2.0 licensed, see NOTICE file).
# ==============================================================================
# Internal Setup Script
# ==============================================================================

# Guard: Detect if accidentally run in PowerShell or CMD
if [[ -n "${PSModulePath:-}" ]] && [[ -z "${BASH_VERSION:-}" ]]; then
    echo "ERROR: This script must be run in Bash, not PowerShell"
    echo "Use Git Bash: bash ./setup.sh"
    echo "Or run: .\\bootstrapper_win.ps1"
    exit 1
fi
# This script configures an already-cloned repository:
#   1. Detects your OS
#   2. Installs Node.js 22 if missing or outdated
#   3. Installs all dependencies
#   4. Builds the memory server
#   5. Bootstraps core memories
#
# Usage:
#   Called automatically by bootstrapper scripts, or manually:
#   cd the_collective
#   ./setup.sh
#
# For first-time installation, use the bootstrapper:
#   curl -fsSL https://raw.githubusercontent.com/screamingearth/the_collective/main/bootstrapper_unix.sh | bash
# ==============================================================================

set -eo pipefail

# Set up logging IMMEDIATELY - before anything else
# This ensures we capture errors from the very start
LOG_DIR=".collective/.logs"
mkdir -p "$LOG_DIR" 2>/dev/null || true

LOG_FILE="$LOG_DIR/setup.log"

# Validate log file is writable before proceeding
if ! touch "$LOG_FILE" 2>/dev/null; then
    echo "WARNING: Cannot write to $LOG_FILE - logging disabled" >&2
else
    # Set up logging with tee (Bash portable)
    exec 1> >(tee -a "$LOG_FILE")
    exec 2>&1
    
    # Get absolute path for display (handles relative/absolute gracefully)
    if command -v readlink &> /dev/null; then
        ABS_LOG_FILE=$(readlink -f "$LOG_FILE" 2>/dev/null || echo "$(pwd)/$LOG_FILE")
    else
        ABS_LOG_FILE="$(pwd)/$LOG_FILE"
    fi
    # Clean up double slashes if any
    ABS_LOG_FILE=$(echo "$ABS_LOG_FILE" | sed 's/\/\//\//g')
    
    echo "📝 Setup log: $ABS_LOG_FILE"
fi

# Set download command preference (curl preferred, wget fallback)
# Used for downloading nvm installer later
if command -v curl &> /dev/null; then
    DOWNLOAD_CMD="curl"
elif command -v wget &> /dev/null; then
    DOWNLOAD_CMD="wget"
else
    # If neither exists, nvm installation will fail with clear error
    DOWNLOAD_CMD="curl"
fi

# ==========================================
# Pre-flight: Fix permissions if needed
# ==========================================
# If this script was copied/downloaded without execute permissions, fix it
# Skip if running via pipe (curl | bash) - BASH_SOURCE will be something like "/dev/fd/63"
if [[ "${BASH_SOURCE[0]}" == "./setup.sh" ]] || [[ "${BASH_SOURCE[0]}" == "setup.sh" ]] || [[ "${BASH_SOURCE[0]}" == *"/setup.sh" ]]; then
    SCRIPT_PATH="${BASH_SOURCE[0]}"
    # Only try chmod if it looks like a real file path (not /dev/fd/* or bash)
    if [[ ! -x "$SCRIPT_PATH" ]] && [[ "$SCRIPT_PATH" != */dev/fd/* ]] && [[ "$SCRIPT_PATH" != "bash" ]]; then
        echo "⚠️  setup.sh doesn't have execute permissions. Fixing..."
        chmod +x "$SCRIPT_PATH" 2>/dev/null || {
            echo "Note: chmod failed - if you see 'permission denied', restart your terminal and try again"
        }
    fi
fi

# ==========================================
# Verify we're in the repo directory
# ==========================================
if [ ! -f "package.json" ] || [ ! -d ".collective" ]; then
    echo "✗ Not in the_collective directory"
    echo ""
    echo "This script must be run from within the cloned repository."
    echo ""
    echo "Use the bootstrapper for first-time installation:"
    echo "  curl -fsSL https://raw.githubusercontent.com/screamingearth/the_collective/main/bootstrapper_unix.sh | bash"
    echo ""
    echo "Or clone manually:"
    echo "  git clone https://github.com/screamingearth/the_collective.git"
    echo "  cd the_collective"
    echo "  ./setup.sh"
    exit 1
fi

# ==========================================
# 1. OS DETECTION & CONFIGURATION
# ==========================================
OS_TYPE="$(uname -s)"
case "${OS_TYPE}" in
    CYGWIN*|MINGW32*|MSYS*|MINGW*)
        echo "Detected OS: Windows (Git Bash)"
        IS_WINDOWS=1
        ;;
    Darwin*)
        echo "Detected OS: macOS"
        IS_WINDOWS=0
        ;;
    Linux*)
        echo "Detected OS: Linux"
        IS_WINDOWS=0
        ;;
    *)
        echo "Unknown OS: ${OS_TYPE}"
        IS_WINDOWS=0
        ;;
esac

# Note: This script runs in bash (including Git Bash on Windows)
# No Windows-specific commands needed - Git Bash provides Unix-like environment

# ==========================================
# 3. YOUR MAIN LOGIC STARTS HERE
# ==========================================

# Colors - disable if output is not a terminal (prevents log file pollution)
if [[ -t 1 ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    MAGENTA='\033[0;35m'
    CYAN='\033[0;36m'
    NC='\033[0m'
    BOLD='\033[1m'
    DIM='\033[2m'
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    MAGENTA=''
    CYAN=''
    NC=''
    BOLD=''
    DIM=''
fi

# Note: Logging will be set up later, after we determine the correct repo directory

# Node.js version requirements
MIN_NODE_VERSION=20
MAX_SUPPORTED_VERSION=22
PREFERRED_NODE_VERSION=22
NVM_VERSION="v0.40.1"  # Update periodically - check https://github.com/nvm-sh/nvm/releases

# Flags
SAFE_MODE=0
for arg in "$@"; do
    if [[ "$arg" == "--safe" ]]; then
        SAFE_MODE=1
    fi
done

# Timeouts (in seconds)
GEMINI_AUTH_TIMEOUT=600  # 10 minutes for OAuth browser flow

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------

check_disk_space() {
    local required_mb=2000  # Estimate: node_modules ~300MB, builds ~100MB, ML models ~500MB, cache ~500MB
    local available_mb
    
    if command -v df &> /dev/null; then
        available_mb=$(df -m . 2>/dev/null | tail -1 | awk '{print $4}')
        if [[ -n "$available_mb" ]] && [[ "$available_mb" -lt "$required_mb" ]]; then
            error "Insufficient disk space: ${available_mb}MB available, ${required_mb}MB required"
            info "Note: First run downloads ~500MB of ML models for semantic embeddings"
            info "Tip: Clear npm cache with 'npm cache clean --force' if space is tight"
            exit 1
        fi
    fi
}

print_banner() {
    echo -e "${CYAN}"
    echo "   ▀█▀ █ █ █▀▀"
    echo "    █  █▀█ ██▄"
    echo -e "${MAGENTA}   █▀▀ █▀█ █   █   █▀▀ █▀▀ ▀█▀ █ █ █ █▀▀"
    echo "   █▄▄ █▄█ █▄▄ █▄▄ ██▄ █▄▄  █  █ ▀▄▀ ██▄"
    echo -e "${NC}"
    echo -e "   ${BOLD}Universal Setup${NC}"
    echo ""
}

info()    { echo -e "${BLUE}ℹ${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn()    { echo -e "${YELLOW}⚠${NC} $1"; }
error()   { echo -e "${RED}✗${NC} $1"; }

# UI CLI wrapper - use Node.js ui-cli.cjs if available, fallback to bash
# This provides consistent UI across all scripts
UI_CLI=""
detect_ui_cli() {
    if command -v node &> /dev/null; then
        local script_dir
        script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        if [[ -f "$script_dir/scripts/ui-cli.cjs" ]]; then
            UI_CLI="node $script_dir/scripts/ui-cli.cjs"
        elif [[ -f "./scripts/ui-cli.cjs" ]]; then
            UI_CLI="node ./scripts/ui-cli.cjs"
        fi
    fi
}

# Spinner for long-running operations
# Usage: run_with_spinner "message" command arg1 arg2...
run_with_spinner() {
    local message="$1"
    shift
    
    # Use Node.js UI if available
    if [[ -n "$UI_CLI" ]]; then
        $UI_CLI spinner "$message" -- "$@"
        return $?
    fi
    
    # Fallback: bash spinner
    local pid
    local spin_chars='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local i=0
    
    # Run command in background
    "$@" &
    pid=$!
    
    # Show spinner while command runs
    while kill -0 "$pid" 2>/dev/null; do
        local char="${spin_chars:$i:1}"
        printf "\r${CYAN}%s${NC} %s" "$char" "$message"
        i=$(( (i + 1) % 10 ))
        sleep 0.1
    done
    
    # Wait for command to finish and get exit code
    wait "$pid"
    local exit_code=$?
    
    # Clear spinner line
    printf "\r%*s\r" $((${#message} + 3)) ""
    
    return $exit_code
}

# Simple progress indicator (non-blocking)
show_progress() {
    if [[ -n "$UI_CLI" ]]; then
        $UI_CLI progress "$1"
    else
        echo -e "   ${YELLOW}⏳${NC} ${DIM}$1 (this may take a minute)...${NC}"
    fi
}

step() {
    if [[ -n "$UI_CLI" ]]; then
        $UI_CLI step "$1" "$2" "$3"
    else
        echo ""
        echo -e "${CYAN}${BOLD}[$1/$2] $3${NC}"
        echo -e "${DIM}────────────────────────────────────────${NC}"
    fi
}

setup_logging() {
    # Call this after we're in the repo directory
    # This re-verifies and reconfigures logging if needed
    
    # Logging should already be active from early in the script,
    # but this function ensures it's working correctly
    if [ -w "$LOG_FILE" ]; then
        success "Logging active: $LOG_FILE"
        return 0
    else
        warn "Log file not writable - some output may not be captured"
        return 1
    fi
}

cleanup_on_exit() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        echo ""
        error "═══════════════════════════════════════════"
        error "Setup failed (exit code: $exit_code)"
        error "═══════════════════════════════════════════"
        echo ""
        
        # Check for common Windows errors in the log
        if [[ "$IS_WINDOWS" -eq 1 ]]; then
            if grep -qi "EBUSY" "$LOG_FILE" || grep -qi "EPERM" "$LOG_FILE"; then
                warn "Detected 'EBUSY' or 'EPERM' errors."
                warn "This usually means a file is locked by another process (like VS Code)."
                info "FIX: Close VS Code, run 'taskkill /F /IM node.exe', and retry."
                echo ""
            fi
            if grep -qi "Could not find any Python installation" "$LOG_FILE"; then
                warn "Detected missing Python."
                info "FIX: Run 'winget install Python.Python.3' and retry."
                echo ""
            fi
            
            # Pause on Windows so the window doesn't close
            echo -e "${YELLOW}Press Enter to close this window...${NC}"
            read -r
        fi

        info "Log file: ${LOG_FILE:-'.collective/.logs/setup.log'}"
        echo ""
        info "Recovery steps:"
        info "  1. Review the error message above"
        info "  2. Try: npm cache clean --force"
        info "  3. Try: rm -rf node_modules .collective/*/node_modules"
        info "  4. Retry: ./setup.sh"
        echo ""
        info "For help: https://github.com/screamingearth/the_collective/issues"
    fi
}

# -----------------------------------------------------------------------------
# OS Detection (Linux/Mac Package Manager)
# -----------------------------------------------------------------------------

detect_os() {
    # Skip if Windows - package management is different
    if [ "$IS_WINDOWS" -eq 1 ]; then
        OS="windows"
        PKG_MANAGER="winget"
        return
    fi
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        if command -v brew &> /dev/null; then
            PKG_MANAGER="brew"
        else
            PKG_MANAGER="none"
        fi
    elif [[ -f /etc/fedora-release ]]; then
        OS="fedora"
        PKG_MANAGER="dnf"
    elif [[ -f /etc/debian_version ]]; then
        OS="debian"
        PKG_MANAGER="apt"
    elif [[ -f /etc/arch-release ]]; then
        OS="arch"
        PKG_MANAGER="pacman"
    elif [[ -f /etc/redhat-release ]]; then
        OS="rhel"
        PKG_MANAGER="dnf"
    else
        OS="linux"
        PKG_MANAGER="unknown"
    fi
    
    # Detect WSL2 specifically
    if [[ -f /proc/version ]] && grep -qi microsoft /proc/version 2>/dev/null; then
        IS_WSL=1
        info "Detected WSL2 environment"
        
        # Check if running from Windows filesystem (very slow)
        if [[ "$(pwd)" == /mnt/* ]]; then
            warn "Running from Windows filesystem (/mnt/c, /mnt/d, etc.)"
            warn "This is VERY SLOW for npm operations"
            warn "Recommended: Move project to Linux filesystem: ~/Documents/the_collective"
            echo ""
        fi
    else
        IS_WSL=0
    fi
}

# -----------------------------------------------------------------------------
# Pre-flight Checks
# -----------------------------------------------------------------------------

check_network() {
    info "Checking network connectivity..."
    
    # Quick connectivity test to npm registry
    local connected=0
    
    if command -v curl &> /dev/null; then
        if curl -s --connect-timeout 5 --max-time 10 https://registry.npmjs.org/-/ping &> /dev/null; then
            connected=1
        fi
    elif command -v wget &> /dev/null; then
        if wget -q --timeout=10 -O /dev/null https://registry.npmjs.org/-/ping &> /dev/null; then
            connected=1
        fi
    else
        # No curl or wget - skip check, will fail later with better error
        warn "Neither curl nor wget found - skipping connectivity check"
        return 0
    fi
    
    if [[ $connected -eq 0 ]]; then
        error "Cannot reach npm registry (registry.npmjs.org)"
        error "Check your internet connection"
        echo ""
        
        # Check for proxy settings
        if [[ -n "${HTTP_PROXY:-}" ]] || [[ -n "${HTTPS_PROXY:-}" ]] || [[ -n "${http_proxy:-}" ]] || [[ -n "${https_proxy:-}" ]]; then
            info "Proxy detected. Ensure npm is configured:"
            info "  npm config set proxy \$HTTP_PROXY"
            info "  npm config set https-proxy \$HTTPS_PROXY"
        fi
        
        exit 1
    fi
    
    success "Network connectivity verified"
}

check_build_tools() {
    info "Checking native module build dependencies..."
    
    local missing=()
    local install_cmd=""
    
    if [[ "$IS_WINDOWS" -eq 1 ]]; then
        # Windows: Native modules (DuckDB) use prebuilt binaries for Node.js LTS
        # No build tools required unless using unsupported Node.js versions
        success "Windows detected - using prebuilt binaries"
    elif [[ "$OS" == "macos" ]]; then
        # macOS: Xcode Command Line Tools is CRITICAL
        if ! xcode-select -p &> /dev/null 2>&1; then
            error "Xcode Command Line Tools not installed"
            echo ""
            info "Installing Xcode Command Line Tools..."
            info "A dialog will appear - click 'Install' to continue"
            echo ""
            
            # Trigger the install dialog
            xcode-select --install 2>/dev/null || true
            
            # Wait for user to complete installation
            echo ""
            echo -e "${YELLOW}Please complete the Xcode CLT installation dialog.${NC}"
            echo -e "${YELLOW}Press Enter after installation completes...${NC}"
            read -r
            
            # Verify installation succeeded
            if ! xcode-select -p &> /dev/null 2>&1; then
                error "Xcode Command Line Tools installation failed or incomplete"
                error "Please install manually: xcode-select --install"
                exit 1
            fi
            
            success "Xcode Command Line Tools installed"
        else
            success "Xcode Command Line Tools found"
        fi
    else
        # Linux: check for gcc/g++ and make
        if ! command -v g++ &> /dev/null && ! command -v gcc &> /dev/null; then
            missing+=("C++ compiler (g++/gcc)")
            case "$PKG_MANAGER" in
                apt) install_cmd="sudo apt-get install -y build-essential" ;;
                dnf) install_cmd="sudo dnf groupinstall -y 'Development Tools'" ;;
                pacman) install_cmd="sudo pacman -S --noconfirm base-devel" ;;
                *) install_cmd="Install gcc/g++ for your distribution" ;;
            esac
        fi
        
        if ! command -v make &> /dev/null; then
            missing+=("make")
        fi
        
        if [[ ${#missing[@]} -gt 0 ]]; then
            error "Missing build dependencies: ${missing[*]}"
            error "Native modules (DuckDB) will fail to compile"
            echo ""
            info "Install with: $install_cmd"
            echo ""
            exit 1
        fi
        
        success "Build tools verified (g++, make)"
    fi
    
    # Check for Python (required by node-gyp)
    if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
        error "Python not found - node-gyp WILL fail for native modules (DuckDB)"
        
        if [[ "$IS_WINDOWS" -eq 1 ]]; then
            info "Install Python via winget:"
            info "  winget install Python.Python.3"
            info "Or download: https://www.python.org/downloads/windows/"
        else
            case "$OS" in
                macos)
                    info "Install: brew install python3"
                    ;;
                debian)
                    info "Install: sudo apt-get install -y python3"
                    ;;
                fedora|rhel)
                    info "Install: sudo dnf install -y python3"
                    ;;
                arch)
                    info "Install: sudo pacman -S --noconfirm python"
                    ;;
            esac
        fi
        echo ""
        exit 1
    else
        success "Python found ($(python3 --version 2>/dev/null || python --version))"
    fi
}

check_running_processes() {
    if [[ "$IS_WINDOWS" -eq 1 ]]; then
        if tasklist.exe | grep -qi "node.exe"; then
            warn "Detected running Node.js processes."
            warn "These may lock files and cause 'EBUSY' or 'EPERM' errors."
            info "Please close VS Code and any other Node.js apps."
            echo ""
            printf "Press Enter once you have closed other Node.js processes..."
            read -r
            echo ""
        fi
    fi
}

show_native_module_help() {
    # Show platform-specific help for native module failures
    echo ""
    if [[ "$IS_WINDOWS" -eq 1 ]]; then
        warn "WINDOWS: Prebuilt binary not found for your Node.js version"
        echo ""
        info "Ensure you're using Node.js LTS (v20 or v22):"
        info "  node -v"
        echo ""
        info "If using an unsupported version, install LTS:"
        info "  winget install --id OpenJS.NodeJS.LTS"
        echo ""
    elif [[ "$OS" == "macos" ]]; then
        error "MACOS: Native module failed"
        echo ""
        info "Install Xcode Command Line Tools:"
        info "  xcode-select --install"
        echo ""
    elif [[ "$OS" == "debian" ]]; then
        error "LINUX: Native module failed"
        echo ""
        info "Install build tools:"
        info "  sudo apt update && sudo apt install -y build-essential python3"
        echo ""
    else
        error "UNIX: Native module failed"
        echo ""
        info "Install gcc, make, and python3 for your system"
        echo ""
    fi
}

# -----------------------------------------------------------------------------
# Node.js Management
# -----------------------------------------------------------------------------

get_node_version() {
    if command -v node &> /dev/null; then
        node -v | sed 's/v//' | cut -d. -f1
    else
        echo "0"
    fi
}

check_node() {
    local version
    version=$(get_node_version)
    
    # Safely extract version - handle parsing failures
    if [[ ! "$version" =~ ^[0-9]+$ ]]; then
        warn "Could not parse Node.js version: $(node -v 2>/dev/null || echo 'unknown')"
        return 1
    fi
    
    if [[ "$version" -ge "$MIN_NODE_VERSION" ]]; then
        # Hard reject if version is "Current" (Node 23, 25, etc.)
        if [[ "$version" -gt "$MAX_SUPPORTED_VERSION" ]]; then
            error "Node.js v$(node -v 2>/dev/null) is NOT supported."
            error "Native modules (DuckDB) lack pre-built binaries for Node v$version."
            info "Required: Node.js v20 or v22 (LTS). Use: nvm install 22 && nvm use 22"
            echo ""
            
            # If not in safe mode, we exit. In safe mode, we just warn.
            if [[ "$SAFE_MODE" -eq 0 ]]; then
                error "Setup aborted. Use --safe to ignore this (not recommended)."
                exit 1
            fi
        fi

        # Also verify npm works
        if command -v npm &> /dev/null && npm --version &> /dev/null; then
            return 0
        fi
    fi
    return 1
}

install_node() {
    info "Installing Node.js ${PREFERRED_NODE_VERSION}..."

    # Validate curl is available (needed for node installation)
    if ! command -v curl &> /dev/null; then
        error "curl not found - required for Node.js installation"
        error "Install curl: https://curl.se/"
        exit 1
    fi

    # Windows-specific Node installation
    if [ "$IS_WINDOWS" -eq 1 ]; then
        info "Windows detected - checking for Node version managers..."
        
        # Try fnm (cross-platform)
        if command -v fnm &> /dev/null; then
            info "Found fnm, using it..."
            fnm install "$PREFERRED_NODE_VERSION" || {
                error "Failed to install Node.js via fnm"
                exit 1
            }
            fnm use "$PREFERRED_NODE_VERSION" || {
                error "Failed to activate Node.js"
                exit 1
            }
            fnm default "$PREFERRED_NODE_VERSION" || warn "Failed to set fnm default (non-critical)"
            return 0
        fi
        
        # Fallback: try nvm-windows (Windows-native)
        if [[ -d "$APPDATA/nvm" ]] && ! command -v nvm &> /dev/null; then
            error "Found nvm-windows directory but nvm command not in PATH"
            error "Please ensure nvm-windows is properly installed and in PATH"
            error "Or run: nvm install $PREFERRED_NODE_VERSION && nvm use $PREFERRED_NODE_VERSION"
            error "Then re-run setup.sh"
            exit 1
        elif [[ -d "$APPDATA/nvm" ]] && command -v nvm &> /dev/null; then
            # nvm-windows exists and is in PATH, try to use it
            info "Found nvm-windows, attempting to install Node.js..."
            nvm install "$PREFERRED_NODE_VERSION" || {
                error "Failed to install Node.js via nvm-windows"
                exit 1
            }
            nvm use "$PREFERRED_NODE_VERSION" || {
                error "Failed to activate Node.js"
                exit 1
            }
            return 0
        fi
        
        error "Neither fnm nor nvm-windows found on Windows"
        error "Please install Node.js manually: https://nodejs.org"
        error "Or install fnm: https://github.com/Schniz/fnm#installation"
        error "Or install nvm-windows: https://github.com/coreybutler/nvm-windows"
        exit 1
    fi

    # Try nvm first (most common for devs)
    if [[ -s "$HOME/.nvm/nvm.sh" ]]; then
        info "Found nvm, using it..."
        source "$HOME/.nvm/nvm.sh"
        nvm install "$PREFERRED_NODE_VERSION" || {
            error "Failed to install Node.js via nvm"
            exit 1
        }
        nvm use "$PREFERRED_NODE_VERSION" || {
            error "Failed to activate Node.js"
            exit 1
        }
        nvm alias default "$PREFERRED_NODE_VERSION" || warn "Failed to set nvm default (non-critical)"
        return 0
    fi

    # Try fnm
    if command -v fnm &> /dev/null; then
        info "Found fnm, using it..."
        fnm install "$PREFERRED_NODE_VERSION" || {
            error "Failed to install Node.js via fnm"
            exit 1
        }
        fnm use "$PREFERRED_NODE_VERSION" || {
            error "Failed to activate Node.js"
            exit 1
        }
        fnm default "$PREFERRED_NODE_VERSION" || warn "Failed to set fnm default (non-critical)"
        return 0
    fi

    # Fall back to system package manager
    case "$OS" in
        macos)
            if [[ "$PKG_MANAGER" == "brew" ]]; then
                info "Installing via Homebrew..."
                brew install "node@$PREFERRED_NODE_VERSION" || {
                    error "Failed to install Node.js via Homebrew"
                    exit 1
                }
                brew link "node@$PREFERRED_NODE_VERSION" --force --overwrite 2>/dev/null || warn "Homebrew link warning (non-critical)"
                # Verify node is accessible
                if ! command -v node &> /dev/null || ! node --version &> /dev/null; then
                    error "Node.js installed via Homebrew but not accessible in PATH"
                    error "Try: export PATH=\"/opt/homebrew/opt/node@${PREFERRED_NODE_VERSION}/bin:\$PATH\""
                    exit 1
                fi
            else
                install_nvm
            fi
            ;;
        fedora|rhel)
            info "Installing via dnf..."
            sudo dnf module install -y "nodejs:$PREFERRED_NODE_VERSION/common" 2>/dev/null || {
                info "Trying NodeSource RPM..."
                curl --connect-timeout 30 --max-time 300 -fsSL https://rpm.nodesource.com/setup_${PREFERRED_NODE_VERSION}.x | sudo bash - || {
                    error "Failed to setup NodeSource repository"
                    exit 1
                }
                sudo dnf install -y nodejs || {
                    error "Failed to install Node.js via dnf"
                    exit 1
                }
            }
            ;;
        debian)
            info "Installing via apt..."
            curl --connect-timeout 30 --max-time 300 -fsSL https://deb.nodesource.com/setup_${PREFERRED_NODE_VERSION}.x | sudo -E bash - || {
                error "Failed to setup NodeSource repository"
                exit 1
            }
            sudo apt-get install -y nodejs || {
                error "Failed to install Node.js via apt"
                exit 1
            }
            ;;
        arch)
            info "Installing via pacman..."
            # Try to install LTS version (v22) first
            if sudo pacman -S --noconfirm nodejs-lts-jod npm 2>/dev/null; then
                success "Installed Node.js LTS (v22) via pacman"
            else
                warn "nodejs-lts-jod not found, using fnm for safe version management"
                install_nvm  # Use nvm/fnm instead of generic nodejs package
            fi
            ;;
        *)
            install_nvm
            ;;
    esac

    success "Node.js installed"
}

install_nvm() {
    info "Installing nvm (Node Version Manager)..."
    
    # Security: Download script first, then execute (never pipe directly to bash)
    local nvm_script
    nvm_script=$(mktemp) || {
        error "Failed to create temp file for nvm installer"
        exit 1
    }
    trap "rm -f '$nvm_script'" EXIT INT TERM
    
    info "Downloading nvm installer..."
    if [[ "$DOWNLOAD_CMD" == "curl" ]]; then
        curl --connect-timeout 30 --max-time 300 --proto '=https' --tlsv1.2 \
            -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" \
            -o "$nvm_script" || {
            error "Failed to download nvm installer"
            rm -f "$nvm_script"
            exit 1
        }
    else
        wget --timeout=300 --tries=3 -q -O "$nvm_script" \
            "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" || {
            error "Failed to download nvm installer"
            rm -f "$nvm_script"
            exit 1
        }
    fi
    
    # Verify it's a shell script
    if ! head -1 "$nvm_script" | grep -q "^#!.*sh"; then
        error "Downloaded nvm installer doesn't look like a shell script"
        rm -f "$nvm_script"
        exit 1
    fi
    
    info "Executing nvm installer..."
    bash "$nvm_script" || {
        error "Failed to install nvm"
        rm -f "$nvm_script"
        exit 1
    }
    rm -f "$nvm_script"

    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" || {
        error "Failed to source nvm.sh"
        exit 1
    }

    nvm install "$PREFERRED_NODE_VERSION" || {
        error "Failed to install Node.js via nvm"
        exit 1
    }
    
    nvm use "$PREFERRED_NODE_VERSION" || {
        error "Failed to activate Node.js"
        exit 1
    }
    
    nvm alias default "$PREFERRED_NODE_VERSION" || warn "Failed to set nvm default (non-critical)"

    success "nvm and Node.js installed"
    warn "You may need to restart your terminal after setup completes"
}

# -----------------------------------------------------------------------------
# Setup Steps
# -----------------------------------------------------------------------------

install_dependencies() {
    local max_retries=3
    local retry=0
    
    info "Installing root dependencies..."
    if [[ "$SAFE_MODE" -eq 1 ]]; then
        warn "SAFE MODE: Skipping native module compilation where possible"
        # We can't easily skip all native builds in npm install, but we can try to ignore failures
    fi
    
    info "This may take 2-5 minutes on first run..."
    
    while [[ $retry -lt $max_retries ]]; do
        # Use --loglevel=error to suppress deprecated warnings unless it's the last attempt
        local log_level="error"
        if [[ $retry -eq $((max_retries - 1)) ]]; then
            log_level="notice"
        fi

        if npm install --loglevel=$log_level 2>&1; then
            success "Root dependencies installed"
            break
        fi
        
        retry=$((retry + 1))
        if [[ $retry -lt $max_retries ]]; then
            warn "npm install failed (attempt $retry/$max_retries), retrying..."
            
            if [[ "$IS_WINDOWS" -eq 1 ]]; then
                info "Windows: Attempting to clear file locks..."
                taskkill.exe /F /IM node.exe /T 2>/dev/null || true
            fi

            info "Cleaning node_modules and cache..."
            rm -rf node_modules 2>/dev/null || true
            npm cache clean --force 2>/dev/null || true
            sleep 2
        else
            error "npm install failed after $max_retries attempts"
            echo ""
            info "Troubleshooting steps:"
            info "  1. Check internet: curl -s https://registry.npmjs.org/-/ping"
            info "  2. Clear cache: npm cache clean --force"
            info "  3. Remove node_modules: rm -rf node_modules .collective/*/node_modules"
            info "  4. Check disk space: at least 2GB free required"
            info "  5. Retry: npm install"
            exit 1
        fi
    done

    cd .collective/memory-server || {
        error "Failed to enter memory-server directory"
        exit 1
    }
    
    retry=0
    info "Installing memory-server dependencies..."
    
    while [[ $retry -lt $max_retries ]]; do
        local log_level="error"
        if [[ $retry -eq $((max_retries - 1)) ]]; then
            log_level="notice"
        fi

        if npm install --loglevel=$log_level 2>&1; then
            break
        fi
        
        retry=$((retry + 1))
        if [[ $retry -lt $max_retries ]]; then
            warn "npm install failed (attempt $retry/$max_retries), retrying..."
            
            if [[ "$IS_WINDOWS" -eq 1 ]]; then
                taskkill.exe /F /IM node.exe /T 2>/dev/null || true
            fi

            rm -rf node_modules 2>/dev/null || true
            npm cache clean --force 2>/dev/null || true
            sleep 2
        else
            error "Failed to install memory-server dependencies after $max_retries attempts"
            exit 1
        fi
    done
    
    # Rebuild native modules explicitly - critical for DuckDB on Windows
    if [[ "$SAFE_MODE" -eq 1 ]]; then
        info "SAFE MODE: Skipping explicit native module rebuild"
        cd ../..
        return 0
    fi

    info "Rebuilding native modules (DuckDB, etc)..."
    
    local rebuild_output
    local rebuild_status=0
    
    # Use timeout to prevent indefinite hangs (5 minutes should be enough)
    if command -v timeout &> /dev/null; then
        rebuild_output=$(timeout 300 npm rebuild 2>&1)
        rebuild_status=${PIPESTATUS[0]}
    else
        # No timeout command available (macOS by default) - run without timeout
        rebuild_output=$(npm rebuild 2>&1)
        rebuild_status=${PIPESTATUS[0]}
    fi
    
    # Show first 30 lines of output
    echo "$rebuild_output" | head -30
    
    # Check npm rebuild's actual exit code
    if [[ $rebuild_status -ne 0 ]]; then
        warn "npm rebuild encountered issues - this often means missing build tools"
        echo ""
        error "═══════════════════════════════════════════════════════════"
        error "Native module installation failed"
        error "═══════════════════════════════════════════════════════════"
        echo ""
        
        if [[ "$IS_WINDOWS" -eq 1 ]]; then
            error "WINDOWS: Prebuilt binaries failed to install"
            echo ""
            info "This usually means you're using an unsupported Node.js version."
            info "DuckDB only provides prebuilt binaries for Node.js LTS (v20, v22)."
            echo ""
            info "Check your Node.js version:"
            info "  node -v"
            echo ""
            info "If using Node.js v23+, install v22 LTS instead:"
            info "  winget install --id OpenJS.NodeJS.LTS"
            echo ""
            info "Then retry: ./setup.sh"
            echo ""
        else
            error "Unix/Mac: Prebuilt binaries failed to install"
            echo ""
            if [[ "$OS" == "macos" ]]; then
                info "Install Xcode Command Line Tools:"
                info "  xcode-select --install"
            elif [[ "$OS" == "debian" ]]; then
                info "Install build tools (Ubuntu/Debian):"
                info "  sudo apt update && sudo apt install -y build-essential python3"
            elif [[ "$OS" == "fedora" ]] || [[ "$OS" == "rhel" ]]; then
                info "Install build tools (Fedora/RHEL):"
                info "  sudo dnf groupinstall -y 'Development Tools'"
            else
                info "Install: gcc, make, python3 for your distribution"
            fi
            echo ""
            info "Then retry: ./setup.sh"
            echo ""
        fi
        
        error "═══════════════════════════════════════════════════════════"
        echo ""
        
        # Exit with clear error instead of continuing
        exit 1
    fi
    success "Memory server dependencies installed"
    cd ../.. || {
        error "Failed to return to root directory"
        exit 1
    }

    cd .collective/gemini-bridge || {
        error "Failed to enter gemini-bridge directory"
        exit 1
    }
    npm install 2>/dev/null || warn "Gemini bridge install had issues (optional)"
    success "Gemini bridge dependencies installed"
    cd ../.. || {
        error "Failed to return to root directory"
        exit 1
    }
}

build_projects() {
    cd .collective/memory-server || {
        error "Failed to enter memory-server directory"
        exit 1
    }
    npm run build || {
        error "Failed to build memory-server"
        exit 1
    }
    cd ../.. || {
        error "Failed to return to root directory"
        exit 1
    }
    success "Memory server compiled"

    cd .collective/gemini-bridge || {
        error "Failed to enter gemini-bridge directory"
        exit 1
    }
    npm run build 2>/dev/null || warn "Gemini bridge build had issues (optional)"
    cd ../.. || {
        error "Failed to return to root directory"
        exit 1
    }
    success "Gemini bridge compiled"
}

bootstrap_memories() {
    mkdir -p .mcp || {
        error "Failed to create .mcp directory"
        exit 1
    }
    
    cd .collective/memory-server || {
        error "Failed to enter memory-server directory"
        exit 1
    }
    
    # Pre-flight: Check if native modules are available
    # DuckDB for vector storage, onnxruntime-node for embeddings
    info "Verifying native modules are available..."
    
    # Check DuckDB
    if ! node -e "require.resolve('duckdb')" 2>/dev/null; then
        error "═══════════════════════════════════════════════════════════"
        error "Native module (DuckDB) is not available!"
        error "═══════════════════════════════════════════════════════════"
        show_native_module_help
        cd ../.. > /dev/null 2>&1
        exit 1
    fi
    
    # Check onnxruntime-node (required by @xenova/transformers for embeddings)
    if ! node -e "require('onnxruntime-node')" 2>/dev/null; then
        error "═══════════════════════════════════════════════════════════"
        error "Native module (onnxruntime-node) is not available!"
        error "═══════════════════════════════════════════════════════════"
        echo ""
        
        if [[ "$IS_WINDOWS" -eq 1 ]]; then
            warn "WINDOWS: This usually means Visual C++ Redistributable is missing"
            echo ""
            info "Install Visual C++ Redistributable:"
            info "  winget install --id Microsoft.VCRedist.2015+.x64"
            echo ""
            info "Or download directly:"
            info "  https://aka.ms/vs/17/release/vc_redist.x64.exe"
            echo ""
            info "After installing, clean and retry:"
            info "  rm -rf node_modules"
            info "  npm install"
            echo ""
        else
            show_native_module_help
        fi
        
        cd ../.. > /dev/null 2>&1
        exit 1
    fi
    
    success "Native modules verified"
    
    # Try bootstrap with better error handling for native module issues
    if ! npm run bootstrap; then
        error "Bootstrap failed (memory database initialization)"
        echo ""
        error "This usually indicates an issue with DuckDB or the database initialization."
        echo ""
        info "Try these recovery steps:"
        info "1. Delete the database: rm -f .mcp/memories.db"
        info "2. Retry setup: cd ../.. && ./setup.sh"
        echo ""
        cd ../.. > /dev/null 2>&1
        exit 1
    fi
    
    cd ../.. || {
        error "Failed to return to root directory"
        exit 1
    }
    success "Core memories loaded"
}

setup_vscode_config() {
    # Ensure .vscode directory exists with proper config
    if [[ ! -d ".vscode" ]]; then
        warn ".vscode directory missing - this should exist in the repo"
        return
    fi
    
    if [[ ! -f ".vscode/mcp.json" ]]; then
        warn ".vscode/mcp.json missing - MCP servers won't auto-load"
    else
        success "MCP configuration verified"
    fi
    
    if [[ ! -f ".vscode/settings.json" ]]; then
        warn ".vscode/settings.json missing"
    else
        success "VS Code settings verified"
    fi
}

setup_gemini_optional() {
    echo ""
    echo -e "${CYAN}${BOLD}Optional: Gemini Research Tools${NC}"
    echo -e "${DIM}Enable cognitive diversity via Google's Gemini (different AI model)${NC}"
    echo ""
    
    printf "%s" "$(printf "${BLUE}Enable Gemini tools? [y/N]: ${NC}")"
    read -r -n 1 REPLY
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        info "Skipping Gemini setup (you can set GEMINI_API_KEY later or run 'npm run auth')"
        return 0
    fi
    
    echo ""
    echo -e "${CYAN}Authentication Options:${NC}"
    echo -e "  ${BOLD}1. API Key${NC} (recommended) - Fast, simple, no browser needed"
    echo -e "     Get a free key at: ${BLUE}https://aistudio.google.com/apikey${NC}"
    echo ""
    echo -e "  ${BOLD}2. OAuth${NC} - Uses your Google account via browser login"
    echo ""
    
    printf "%s" "$(printf "${BLUE}Enter your Gemini API key (or press Enter for OAuth): ${NC}")"
    read -r API_KEY
    echo
    
    if [[ -n "$API_KEY" ]]; then
        # API key provided - save it to .env file
        cd .collective/gemini-bridge || {
            error "Failed to enter gemini-bridge directory"
            return 1
        }
        
        # Validate key format (should be alphanumeric, typically 39 chars)
        if [[ ${#API_KEY} -lt 20 ]]; then
            warn "API key seems short - make sure you copied the full key"
        fi
        
        # Save to .env file
        echo "GEMINI_API_KEY=$API_KEY" > .env
        success "API key saved to .collective/gemini-bridge/.env"
        
        # Quick validation - try a simple API call
        info "Validating API key..."
        if command -v curl &> /dev/null; then
            HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
                -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$API_KEY" \
                -H "Content-Type: application/json" \
                -d '{"contents":[{"parts":[{"text":"Hi"}]}]}' \
                --connect-timeout 10 --max-time 30 2>/dev/null)
            
            if [[ "$HTTP_STATUS" == "200" ]]; then
                success "API key validated successfully!"
            elif [[ "$HTTP_STATUS" == "400" ]] || [[ "$HTTP_STATUS" == "401" ]] || [[ "$HTTP_STATUS" == "403" ]]; then
                warn "API key may be invalid (HTTP $HTTP_STATUS). Double-check your key."
                warn "You can update it later in: .collective/gemini-bridge/.env"
            else
                warn "Could not validate key (HTTP $HTTP_STATUS). Will try at runtime."
            fi
        else
            info "Skipping validation (curl not available)"
        fi
        
        cd ../.. || return 1
        success "Gemini tools configured with API key (fast mode)"
        return 0
    fi
    
    # No API key - proceed with OAuth
    info "Setting up Gemini via OAuth..."
    info "A browser window will open for Google authentication"
    info "If the browser doesn't open, visit the URL shown in the terminal"
    echo ""
    
    cd .collective/gemini-bridge || {
        error "Failed to enter gemini-bridge directory"
        return 1
    }
    
    # Run auth with timeout
    if command -v timeout &> /dev/null; then
        if timeout "$GEMINI_AUTH_TIMEOUT" npm run auth; then
            success "Gemini OAuth authentication successful"
        else
            warn "OAuth did not complete. You can retry later with:"
            warn "  cd .collective/gemini-bridge && npm run auth"
            warn "Or set GEMINI_API_KEY environment variable"
        fi
    else
        if npm run auth; then
            success "Gemini OAuth authentication successful"
        else
            warn "OAuth did not complete. You can retry later."
        fi
    fi
    
    cd ../.. || return 1
    success "Gemini tools setup complete"
}

reinit_git_optional() {
    echo ""
    echo -e "${CYAN}${BOLD}Optional: Fresh Repository${NC}"
    echo -e "${DIM}Replace git history with a new repository${NC}"
    echo ""
    printf "%s" "$(printf "${BLUE}Initialize fresh git repo? [y/N]: ${NC}")"
    read -r -n 1 REPLY
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        info "Creating fresh repository..."
        
        # Backup original remote info
        ORIGINAL_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
        
        # Backup git history before removal
        if [[ -d ".git" ]]; then
            BACKUP_NAME=".git.backup.$(date +%s)"
            mv .git "$BACKUP_NAME" || {
                error "Failed to backup .git directory"
                return 1
            }
            info "Git history backed up to $BACKUP_NAME"
        fi
        
        # Initialize fresh repo
        git init || {
            error "Failed to initialize git repository"
            return 1
        }
        git add . || {
            error "Failed to add files to git"
            return 1
        }
        
        # Prompt for custom commit message
        echo ""
        echo -e "${CYAN}Initial commit message:${NC}"
        printf "  Default: ${DIM}Initial commit from the_collective template${NC}\n"
        printf "%s" "  Enter custom message (or press Enter for default): "
        read -r COMMIT_MSG
        echo
        
        # Security: Validate and truncate commit message length
        if [[ -z "$COMMIT_MSG" ]]; then
            COMMIT_MSG="Initial commit from the_collective template"
        elif [[ ${#COMMIT_MSG} -gt 500 ]]; then
            warn "Commit message too long (${#COMMIT_MSG} chars), truncating to 500 characters"
            COMMIT_MSG="${COMMIT_MSG:0:500}"
        fi
        
        # Security: Reject null bytes (command injection vector)
        if [[ "$COMMIT_MSG" == *$'\x00'* ]]; then
            error "Invalid commit message - contains null bytes"
            return 1
        fi
        
        # Security: Use git commit -F - to pass message via stdin (prevents injection)
        git commit -F - <<EOF
$COMMIT_MSG
EOF
        
        if [[ $? -ne 0 ]]; then
            error "Failed to create initial commit"
            return 1
        fi
        
        # Optionally set default branch
        git branch -M main 2>/dev/null || true
        
        success "Fresh repository created"
        
        if [[ -n "$ORIGINAL_REMOTE" ]]; then
            info "Original remote was: $ORIGINAL_REMOTE"
            info "Add your remote: git remote add origin <your-repo-url>"
        fi
    else
        info "Keeping existing git history"
    fi
}

print_success() {
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}${BOLD}🎉 Setup complete!${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "   ${CYAN}Next steps:${NC}"
    echo -e "   1. ${BOLD}Restart VS Code${NC} (to load MCP servers)"
    echo -e "   2. Open Copilot Chat and say \"${MAGENTA}hey nyx${NC}\""
    echo ""
    echo -e "   ${YELLOW}⚠ First conversation downloads ~400MB of ML models${NC}"
    echo -e "   ${YELLOW}⚠ This is normal and only happens once${NC}"
    echo ""
    echo -e "   ${DIM}Verify anytime: npm run check${NC}"
    echo -e "   ${DIM}Enable Gemini later: cd .collective/gemini-bridge && npm run auth${NC}"
    echo ""
}



# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

main() {
    # Set up exit trap now that we're in a valid state with all functions defined
    # Catch EXIT (normal exit), INT (Ctrl+C), and TERM (kill signal)
    trap cleanup_on_exit EXIT INT TERM
    
    # Detect enhanced UI early (needs Node.js available)
    detect_ui_cli
    
    print_banner
    
    # Verify we're in the repo directory first
    if [ ! -f "package.json" ] || [ ! -d ".collective" ]; then
        echo "✗ Not in the_collective directory" >&2
        echo "" >&2
        echo "This script must be run from within the cloned repository." >&2
        echo "" >&2
        echo "Use the bootstrapper for first-time installation:" >&2
        echo "  curl -fsSL https://raw.githubusercontent.com/screamingearth/the_collective/main/bootstrapper_unix.sh | bash" >&2
        echo "" >&2
        echo "Or clone manually:" >&2
        echo "  git clone https://github.com/screamingearth/the_collective.git" >&2
        echo "  cd the_collective" >&2
        echo "  ./setup.sh" >&2
        exit 1
    fi
    
    # Set up logging now that we're in the repo directory
    setup_logging
    
    # Detect OS first (needed for subsequent checks)
    detect_os
    info "Detected: $OS ($PKG_MANAGER)"
    
    # Check disk space before starting
    check_disk_space
    
    # Check for running processes that might lock files
    check_running_processes

    # Check network connectivity before trying to download anything
    check_network
    
    # Check build tools before npm install (prevents 10-min failure)
    check_build_tools

    # Determine total steps based on whether we need to install Node
    if check_node; then
        success "Node.js v$(get_node_version) detected"
        TOTAL_STEPS=6
        STEP=0

        step "$((++STEP))" "$TOTAL_STEPS" "Installing dependencies"
        install_dependencies

        step "$((++STEP))" "$TOTAL_STEPS" "Building projects"
        build_projects

        step "$((++STEP))" "$TOTAL_STEPS" "Bootstrapping memories"
        bootstrap_memories

        step "$((++STEP))" "$TOTAL_STEPS" "Verifying VS Code configuration"
        setup_vscode_config

        step "$((++STEP))" "$TOTAL_STEPS" "Gemini tools (optional)"
        setup_gemini_optional

        step "$((++STEP))" "$TOTAL_STEPS" "Fresh repository (optional)"
        reinit_git_optional
    else
        if command -v node &> /dev/null; then
            warn "Node.js v$(get_node_version) is too old (need v${MIN_NODE_VERSION}+)"
        else
            warn "Node.js not found"
        fi

        TOTAL_STEPS=7
        STEP=0

        step "$((++STEP))" "$TOTAL_STEPS" "Installing Node.js"
        install_node

        # Verify installation succeeded
        if ! check_node; then
            error "Node.js installation failed"
            echo "Please install Node.js ${MIN_NODE_VERSION}+ manually: https://nodejs.org"
            exit 1
        fi

        info "Node.js: $(node -v)"
        info "npm: $(npm -v)"

        step "$((++STEP))" "$TOTAL_STEPS" "Installing dependencies"
        install_dependencies

        step "$((++STEP))" "$TOTAL_STEPS" "Building projects"
        build_projects

        step "$((++STEP))" "$TOTAL_STEPS" "Bootstrapping memories"
        bootstrap_memories

        step "$((++STEP))" "$TOTAL_STEPS" "Verifying VS Code configuration"
        setup_vscode_config

        step "$((++STEP))" "$TOTAL_STEPS" "Gemini tools (optional)"
        setup_gemini_optional

        step "$((++STEP))" "$TOTAL_STEPS" "Fresh repository (optional)"
        reinit_git_optional
    fi

    print_success
}

main "$@"
