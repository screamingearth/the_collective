#!/usr/bin/env bash

# ==============================================================================
# Part of the_collective by screamingearth (Apache 2.0 licensed, see NOTICE file).
# ==============================================================================
# Internal Setup Script
# ==============================================================================
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
PREFERRED_NODE_VERSION=22
NVM_VERSION="v0.40.1"  # Update periodically - check https://github.com/nvm-sh/nvm/releases

# Timeouts (in seconds)
GEMINI_AUTH_TIMEOUT=600  # 10 minutes for OAuth browser flow

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------

check_disk_space() {
    local required_mb=500  # Estimate: 500MB for node_modules + builds
    local available_mb
    
    if command -v df &> /dev/null; then
        available_mb=$(df -m . | tail -1 | awk '{print $4}')
        if [[ "$available_mb" -lt "$required_mb" ]]; then
            error "Insufficient disk space: ${available_mb}MB available, ${required_mb}MB required"
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

step() {
    echo ""
    echo -e "${CYAN}${BOLD}[$1/$2] $3${NC}"
    echo -e "${DIM}────────────────────────────────────────${NC}"
}

setup_logging() {
    # Call this after we're in the repo directory
    # This ensures logs go to the correct location
    
    # Security: Sanitize log directory path to prevent traversal
    LOG_DIR=$(realpath ".collective/.logs" 2>/dev/null || echo ".collective/.logs")
    
    mkdir -p "$LOG_DIR" || {
        warn "Could not create .collective/.logs directory"
        return 0
    }
    
    LOG_FILE="$LOG_DIR/setup.log"
    
    # Security: Validate path is within expected bounds
    if [[ "$LOG_FILE" != *"/.collective/.logs/"* ]]; then
        warn "Log path suspicious: $LOG_FILE - skipping logging"
        return 0
    fi
    
    # Validate log file is writable
    if ! touch "$LOG_FILE" 2>/dev/null; then
        warn "Cannot write to $LOG_FILE"
        return 0
    fi
    
    # Set up logging with fallback for non-bash shells
    # Bash supports process substitution >(tee), other shells don't
    if [ -n "$BASH_VERSION" ]; then
        # In bash: redirect to both stdout and file using process substitution
        exec 1> >(tee -a "$LOG_FILE")
        exec 2>&1
    else
        # Not in bash: redirect to file only (safer, more portable)
        exec >> "$LOG_FILE" 2>&1
    fi
    
    echo "📝 Setup log: $(pwd)/$LOG_FILE"
}

cleanup_on_exit() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        echo ""
        warn "Setup interrupted or failed (exit code: $exit_code)"
        warn "To retry: ./setup.sh"
        warn "To clean up: npm run clean"
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
    if [[ "$version" -ge "$MIN_NODE_VERSION" ]]; then
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
            sudo pacman -S --noconfirm nodejs npm || {
                error "Failed to install Node.js via pacman"
                exit 1
            }
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
    npm install || {
        error "Failed to install root dependencies"
        exit 1
    }
    success "Root dependencies installed"

    cd .collective/memory-server || {
        error "Failed to enter memory-server directory"
        exit 1
    }
    npm install || {
        error "Failed to install memory-server dependencies"
        exit 1
    }
    
    # Rebuild native modules explicitly - critical for DuckDB on Windows
    info "Rebuilding native modules (DuckDB, etc)..."
    
    # Use timeout to prevent indefinite hangs (5 minutes should be enough)
    if command -v timeout &> /dev/null; then
        timeout 300 npm rebuild 2>&1 | head -20
        local rebuild_status=${PIPESTATUS[0]}
    else
        # No timeout command available (macOS by default) - run without timeout
        npm rebuild 2>&1 | head -20
        local rebuild_status=${PIPESTATUS[0]}
    fi
    
    # Check npm rebuild's actual exit code
    if [[ $rebuild_status -ne 0 ]]; then
        warn "npm rebuild encountered issues - attempting to continue"
        info "If you see DuckDB errors, try: npm rebuild --build-from-source"
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
    
    # Try bootstrap with better error handling for native module issues
    if ! npm run bootstrap; then
        error "Bootstrap failed - likely a native module issue"
        echo ""
        warn "Troubleshooting for Windows users:"
        warn "1. If you see 'Segmentation fault', try rebuilding native modules:"
        warn "   npm rebuild --build-from-source"
        warn ""
        warn "2. Ensure you have Windows Build Tools installed:"
        warn "   npm install --global windows-build-tools"
        warn ""
        warn "3. Or install Visual Studio with C++ build tools"
        warn ""
        warn "After installing tools, run: ./setup.sh"
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
    # Use printf for better cross-platform compatibility instead of echo -e with read
    printf "%s" "$(printf "${BLUE}Enable Gemini tools? [y/N]: ${NC}")"
    read -r -n 1 REPLY
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        info "Setting up Gemini authentication..."
        info "A browser window will open for Google OAuth authentication"
        info "If the browser doesn't open automatically, visit the URL shown in the terminal"
        echo ""
        
        cd .collective/gemini-bridge || {
            error "Failed to enter gemini-bridge directory"
            exit 1
        }
        
        # Run auth with full output visible (OAuth is interactive)
        # Use generous timeout since user needs to complete browser auth
        # Note: timeout command may not exist on macOS by default
        if command -v timeout &> /dev/null; then
            if timeout "$GEMINI_AUTH_TIMEOUT" npm run auth; then
                success "Gemini tools authentication successful"
            else
                warn "Gemini authentication did not complete (you can run it later with: cd .collective/gemini-bridge && npm run auth)"
            fi
        else
            # No timeout available - run without time limit
            if npm run auth; then
                success "Gemini tools authentication successful"
            else
                warn "Gemini authentication did not complete (you can run it later with: cd .collective/gemini-bridge && npm run auth)"
            fi
        fi
        
        cd ../.. || {
            error "Failed to return to root directory"
            exit 1
        }
        success "Gemini tools setup attempted"
    else
        info "Skipping Gemini setup (you can run 'cd .collective/gemini-bridge && npm run auth' later)"
    fi
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
    
    print_banner
    
    # Set up logging now that we're in the correct directory
    setup_logging

    # Pre-flight checks
    check_disk_space

    # Detect OS
    detect_os
    info "Detected: $OS ($PKG_MANAGER)"

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
