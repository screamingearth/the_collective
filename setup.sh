#!/usr/bin/env bash

# ==============================================================================
# Part of the_collective by screamingearth (Apache 2.0 licensed, see NOTICE file).
# ==============================================================================
# Universal Setup & Bootstrap
# ==============================================================================
# ONE script that does EVERYTHING:
#   1. Auto-downloads repo if needed (universal bootstrap)
#   2. Detects your OS
#   3. Installs Node.js 22 if missing or outdated
#   4. Installs all dependencies
#   5. Builds the memory server
#   6. Bootstraps core memories
#
# Usage (local):
#   git clone https://github.com/screamingearth/the_collective.git
#   cd the_collective
#   ./setup.sh
#
# Usage (bootstrap - downloads repo automatically):
#   curl -fsSL https://raw.githubusercontent.com/screamingearth/the_collective/main/setup.sh | bash
# ==============================================================================

set -e

# ==========================================
# BOOTSTRAP: Check if we're in repo directory
# ==========================================
if [ ! -f "package.json" ] || [ ! -d ".collective" ]; then
    echo "→ Not in the_collective directory. Downloading repo..."
    
    # Detect tar format
    if command -v tar &> /dev/null; then
        TEMP_DIR=$(mktemp -d) || {
            echo "✗ Failed to create temp directory"
            exit 1
        }
        cd "$TEMP_DIR" || {
            echo "✗ Failed to enter temp directory"
            rm -rf "$TEMP_DIR" 2>/dev/null
            exit 1
        }
        curl --connect-timeout 30 --max-time 600 -fsSL "$REPO_TARBALL_URL" | tar xz || {
            echo "✗ Failed to download/extract repository"
            cd - > /dev/null 2>&1
            rm -rf "$TEMP_DIR" 2>/dev/null
            exit 1
        }
        if [[ ! -d "the_collective-main" ]]; then
            echo "✗ Repository extraction failed - directory not found"
            cd - > /dev/null 2>&1
            rm -rf "$TEMP_DIR" 2>/dev/null
            exit 1
        fi
        cd the_collective-main || {
            echo "✗ Failed to enter repository directory"
            exit 1
        }
    else
        echo "✗ tar not found. Please install tar or clone manually:"
        echo "  git clone https://github.com/screamingearth/the_collective.git"
        exit 1
    fi
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

# ==========================================
# 2. DEFINE PLATFORM-SPECIFIC COMMANDS
# ==========================================
if [ "$IS_WINDOWS" -eq 1 ]; then
    # Windows/Git Bash specific settings
    PYTHON_CMD="python"    # Windows usually registers 'python', not 'python3'
    PIP_CMD="pip"
    OPEN_CMD="explorer"    # To open folders/files
    
    # Define a dummy 'sudo' function because Git Bash runs as the current user
    # and doesn't have sudo. If admin is needed, the user must run the .bat as Admin.
    sudo() {
        # Security: Whitelist only safe package manager commands
        local cmd="$1"
        case "$cmd" in
            apt-get|dnf|pacman|yum|brew)
                echo "[Windows] Running as current user: $*" >&2
                "$@"
                ;;
            *)
                echo "[Windows] Error: sudo not available. Command not whitelisted: $cmd" >&2
                echo "[Windows] If you need admin privileges, run Git Bash as Administrator" >&2
                return 1
                ;;
        esac
    }
else
    # Linux/Mac specific settings
    PYTHON_CMD="python3"
    PIP_CMD="pip3"
    
    if [[ "$OS_TYPE" == "Darwin"* ]]; then
        OPEN_CMD="open"
    else
        OPEN_CMD="xdg-open"
    fi
fi

# ==========================================
# 3. YOUR MAIN LOGIC STARTS HERE
# ==========================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'

# Setup logging (after colors defined)
# Use absolute path to ensure logs work from any directory
SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

LOG_DIR="$SCRIPT_ROOT/.collective/logs"
mkdir -p "$LOG_DIR" 2>/dev/null || {
    # Fallback if .collective directory doesn't exist or has permission issues
    LOG_DIR="/tmp/the_collective_logs"
    mkdir -p "$LOG_DIR" 2>/dev/null || LOG_DIR="."
}
LOG_FILE="$LOG_DIR/setup.log"
# Validate log file is writable
if ! touch "$LOG_FILE" 2>/dev/null; then
    echo "ERROR: Cannot write to log file: $LOG_FILE" >&2
    exit 1
fi
exec 1> >(tee -a "$LOG_FILE")
exec 2>&1

# Node.js version requirements
MIN_NODE_VERSION=20
PREFERRED_NODE_VERSION=22
NVM_VERSION="v0.40.1"  # Update periodically - check https://github.com/nvm-sh/nvm/releases

# Repository configuration
REPO_URL="https://github.com/screamingearth/the_collective.git"
REPO_TARBALL_URL="https://codeload.github.com/screamingearth/the_collective/tar.gz/main"

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

cleanup_on_exit() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        echo ""
        warn "Setup interrupted or failed (exit code: $exit_code)"
        warn "To retry: ./setup.sh"
        warn "To clean up: npm run clean"
    fi
}

trap cleanup_on_exit EXIT

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
            fnm install $PREFERRED_NODE_VERSION || {
                error "Failed to install Node.js via fnm"
                exit 1
            }
            fnm use $PREFERRED_NODE_VERSION || {
                error "Failed to activate Node.js"
                exit 1
            }
            fnm default $PREFERRED_NODE_VERSION || warn "Failed to set fnm default (non-critical)"
            return 0
        fi
        
        # Fallback: try nvm-windows (Windows-native)
        if [[ -d "$APPDATA/nvm" ]]; then
            info "Found nvm-windows, skipping installation"
            warn "Please run: nvm install $PREFERRED_NODE_VERSION && nvm use $PREFERRED_NODE_VERSION"
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
        nvm install $PREFERRED_NODE_VERSION || {
            error "Failed to install Node.js via nvm"
            exit 1
        }
        nvm use $PREFERRED_NODE_VERSION || {
            error "Failed to activate Node.js"
            exit 1
        }
        nvm alias default $PREFERRED_NODE_VERSION || warn "Failed to set nvm default (non-critical)"
        return 0
    fi

    # Try fnm
    if command -v fnm &> /dev/null; then
        info "Found fnm, using it..."
        fnm install $PREFERRED_NODE_VERSION || {
            error "Failed to install Node.js via fnm"
            exit 1
        }
        fnm use $PREFERRED_NODE_VERSION || {
            error "Failed to activate Node.js"
            exit 1
        }
        fnm default $PREFERRED_NODE_VERSION || warn "Failed to set fnm default (non-critical)"
        return 0
    fi

    # Fall back to system package manager
    case "$OS" in
        macos)
            if [[ "$PKG_MANAGER" == "brew" ]]; then
                info "Installing via Homebrew..."
                brew install node@$PREFERRED_NODE_VERSION || {
                    error "Failed to install Node.js via Homebrew"
                    exit 1
                }
                brew link node@$PREFERRED_NODE_VERSION --force --overwrite 2>/dev/null || warn "Homebrew link warning (non-critical)"
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
            sudo dnf module install -y nodejs:$PREFERRED_NODE_VERSION/common 2>/dev/null || {
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
    curl --connect-timeout 30 --max-time 300 -o- https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh | bash || {
        error "Failed to install nvm"
        exit 1
    }

    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" || {
        error "Failed to source nvm.sh"
        exit 1
    }

    nvm install $PREFERRED_NODE_VERSION || {
        error "Failed to install Node.js via nvm"
        exit 1
    }
    
    nvm use $PREFERRED_NODE_VERSION || {
        error "Failed to activate Node.js"
        exit 1
    }
    
    nvm alias default $PREFERRED_NODE_VERSION || warn "Failed to set nvm default (non-critical)"

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
    npm rebuild 2>/dev/null || warn "npm rebuild had issues (non-critical)"
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
    npm run bootstrap || {
        error "Failed to bootstrap memories"
        exit 1
    }
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
        if timeout $GEMINI_AUTH_TIMEOUT npm run auth; then
            success "Gemini tools authentication successful"
        else
            warn "Gemini authentication did not complete (you can run it later with: cd .collective/gemini-bridge && npm run auth)"
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
        
        git commit -m "$COMMIT_MSG" || {
            error "Failed to create initial commit"
            return 1
        }
        
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

clone_if_needed() {
    # If running via curl | bash, we need to clone the repo first
    if [[ ! -f "package.json" ]]; then
        if ! command -v git &> /dev/null; then
            warn "Git not found - required for cloning repository"

            # Offer to install Git automatically when possible
            printf "Would you like the installer to attempt to install Git now using your package manager? [y/N]: "
            read -r INSTALL_GIT_REPLY
            if [[ "$INSTALL_GIT_REPLY" =~ ^[Yy]$ ]]; then
                info "Attempting to install Git using package manager: $PKG_MANAGER"
                case "$PKG_MANAGER" in
                    apt)
                        sudo apt-get update && sudo apt-get install -y git || {
                            error "Failed to install Git via apt"
                            error "Install Git manually: https://git-scm.com/downloads"
                            exit 1
                        }
                        ;;
                    dnf)
                        sudo dnf install -y git || {
                            error "Failed to install Git via dnf"
                            error "Install Git manually: https://git-scm.com/downloads"
                            exit 1
                        }
                        ;;
                    pacman)
                        sudo pacman -S --noconfirm git || {
                            error "Failed to install Git via pacman"
                            error "Install Git manually: https://git-scm.com/downloads"
                            exit 1
                        }
                        ;;
                    brew)
                        brew install git || {
                            error "Failed to install Git via Homebrew"
                            error "Install Git manually: https://git-scm.com/downloads"
                            exit 1
                        }
                        ;;
                    *)
                        error "Automatic Git installation is not supported on your system ($PKG_MANAGER)."
                        error "Please install Git manually: https://git-scm.com/downloads"
                        exit 1
                        ;;
                esac

                # Verify installation
                if ! command -v git &> /dev/null; then
                    error "Git installation appeared to fail. Please install Git manually: https://git-scm.com/downloads"
                    exit 1
                fi
                success "Git installed successfully"
            else
                error "Git is required to continue. Please install Git and re-run this script: https://git-scm.com/downloads"
                exit 1
            fi
        fi

        if [[ ! -d "the_collective" ]]; then
            info "Cloning the_collective repository..."
            # Security: Sanitize git output to prevent terminal injection via ANSI escape codes
            GIT_ERROR=$(git clone "$REPO_URL" 2>&1 | tr -d '\000-\037\177-\377') || {
                error "Failed to clone repository:"
                echo "$GIT_ERROR" | head -20 >&2  # Limit output to prevent spam
                exit 1
            }
        fi
        cd the_collective || {
            error "Failed to enter the_collective directory"
            exit 1
        }
        
        # Verify critical directories exist
        if [[ ! -d ".collective" ]]; then
            error ".collective directory missing in cloned repository"
            exit 1
        fi
        
        success "Repository ready"
    fi
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

main() {
    print_banner
    info "Setup log: $LOG_FILE"

    # Pre-flight checks
    check_disk_space

    # Detect OS
    detect_os
    info "Detected: $OS ($PKG_MANAGER)"

    # Clone repo if running via curl | bash
    clone_if_needed

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

        # Reload shell environment
        [[ -s "$HOME/.nvm/nvm.sh" ]] && source "$HOME/.nvm/nvm.sh"

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
