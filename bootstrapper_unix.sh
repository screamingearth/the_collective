#!/usr/bin/env bash

# ==============================================================================
# >the_collective - macOS/Linux Bootstrapper
# ==============================================================================
# One-line install: curl -fsSL https://raw.githubusercontent.com/screamingearth/the_collective/main/bootstrapper_unix.sh | bash
# ==============================================================================
# This file is part of >the_collective by screamingearth (Apache 2.0 licensed).
# ==============================================================================

set -eo pipefail

# Logging
LOGFILE="/tmp/the_collective_install.log"
exec > >(tee -a "$LOGFILE")
exec 2>&1

log() {
    echo -e "\033[1;34m[$(date +'%Y-%m-%d %H:%M:%S')] $1\033[0m"
}

success() {
    echo -e "\033[1;32m✓ $1\033[0m"
}

error() {
    echo -e "\033[1;31m✗ $1\033[0m"
}

warn() {
    echo -e "\033[1;33m⚠ $1\033[0m"
}

error_handler() {
    echo ""
    error "Installation failed at line $1"
    echo "Please check the log at $LOGFILE for details"
    echo "For support, visit: https://github.com/screamingearth/the_collective/issues"
    exit 1
}
trap 'error_handler ${LINENO}' ERR

# Banner
echo ""
echo -e "\033[36m   ▀█▀ █ █ █▀▀\033[0m"
echo -e "\033[36m    █  █▀█ ██▄\033[0m"
echo -e "\033[35m   █▀▀ █▀█ █   █   █▀▀ █▀▀ ▀█▀ █ █ █ █▀▀\033[0m"
echo -e "\033[35m   █▄▄ █▄█ █▄▄ █▄▄ ██▄ █▄▄  █  █ ▀▄▀ ██▄\033[0m"
echo ""
echo "   Unix Bootstrapper"
echo ""

log "Starting installation for $(uname -s)..."
log "Log file: $LOGFILE"

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Darwin*)
        OS_NAME="macOS"
        PKG_MANAGER="brew"
        ;;
    Linux*)
        OS_NAME="Linux"
        # Detect Linux package manager
        if command -v apt-get &> /dev/null; then
            PKG_MANAGER="apt"
        elif command -v dnf &> /dev/null; then
            PKG_MANAGER="dnf"
        elif command -v yum &> /dev/null; then
            PKG_MANAGER="yum"
        elif command -v pacman &> /dev/null; then
            PKG_MANAGER="pacman"
        else
            PKG_MANAGER="unknown"
        fi
        ;;
    *)
        error "Unsupported OS: ${OS}"
        exit 1
        ;;
esac

log "Detected: $OS_NAME ($PKG_MANAGER)"

# Helper: ensure_packages - cross-distro install of small toolset
ensure_packages() {
    # Usage: ensure_packages pkg1 pkg2 ...
    local pkgs=("$@")
    local pm="$PKG_MANAGER"
    local SUDO=""

    # Prefer sudo when not root
    if [[ $EUID -ne 0 ]] && command -v sudo &> /dev/null; then
        SUDO="sudo"
    fi

    case "$pm" in
        apt)
            $SUDO apt-get update -y
            $SUDO apt-get install -y --no-install-recommends "${pkgs[@]}" && return 0 || return 1
            ;;
        dnf)
            $SUDO dnf install -y "${pkgs[@]}" && return 0 || return 1
            ;;
        yum)
            $SUDO yum install -y "${pkgs[@]}" && return 0 || return 1
            ;;
        pacman)
            $SUDO pacman -Syu --noconfirm "${pkgs[@]}" && return 0 || return 1
            ;;
        apk)
            $SUDO apk add --no-cache "${pkgs[@]}" && return 0 || return 1
            ;;
        zypper)
            $SUDO zypper -n install "${pkgs[@]}" && return 0 || return 1
            ;;
        brew)
            for p in "${pkgs[@]}"; do brew install "$p" || true; done
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Install Git if missing
if ! command -v git &> /dev/null; then
    log "Git not found. Attempting automatic install of Git, curl, and python3..."

    # Try the universal helper first
    if ensure_packages git curl python3; then
        success "Git and essential tools installed"
    else
        log "Automatic install failed. Falling back to package-manager specific steps..."
        case "$PKG_MANAGER" in
            brew)
                if ! command -v brew &> /dev/null; then
                    log "Homebrew not found. Installing Homebrew..."
                    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || {
                        error "Failed to install Homebrew"
                        exit 1
                    }
                fi
                brew install git || {
                    error "Failed to install Git via Homebrew"
                    exit 1
                }
                ;;
            apt)
                log "Installing Git via apt (requires sudo)..."
                sudo apt-get update && sudo apt-get install -y git curl || {
                    error "Failed to install Git via apt"
                    error "Please run: sudo apt-get install git curl"
                    exit 1
                }
                ;;
            dnf|yum)
                log "Installing Git via $PKG_MANAGER (requires sudo)..."
                sudo $PKG_MANAGER install -y git curl || {
                    error "Failed to install Git via $PKG_MANAGER"
                    error "Please run: sudo $PKG_MANAGER install git curl"
                    exit 1
                }
                ;;
            pacman)
                log "Installing Git via pacman (requires sudo)..."
                sudo pacman -S --noconfirm git curl || {
                    error "Failed to install Git via pacman"
                    error "Please run: sudo pacman -S git curl"
                    exit 1
                }
                ;;
            *)
                error "Unknown package manager. Please install Git manually:"
                error "  Ubuntu/Debian: sudo apt-get install git curl"
                error "  Fedora/RHEL:   sudo dnf install git curl"
                error "  Arch:          sudo pacman -S git curl"
                error "Alternatively, if git is available elsewhere, use: git clone https://github.com/screamingearth/the_collective.git ~/the_collective"
                exit 1
                ;;
        esac
    fi
    
    success "Git installed"
else
    success "Git already installed: $(git --version)"
fi

# Ensure curl or wget exists (for later steps)
if ! command -v curl &> /dev/null && ! command -v wget &> /dev/null; then
    log "Neither curl nor wget found. Installing curl..."
    
    case "$PKG_MANAGER" in
        brew)
            brew install curl || warn "Failed to install curl (continuing anyway)"
            ;;
        apt)
            sudo apt-get install -y curl || warn "Failed to install curl (continuing anyway)"
            ;;
        dnf|yum)
            sudo $PKG_MANAGER install -y curl || warn "Failed to install curl (continuing anyway)"
            ;;
        pacman)
            sudo pacman -S --noconfirm curl || warn "Failed to install curl (continuing anyway)"
            ;;
    esac
fi

# Check for Node.js (setup.sh will install if missing)
if ! command -v node &> /dev/null; then
    log "Node.js not found. It will be installed by setup.sh"
else
    success "Node.js already installed: $(node --version)"
fi

# Determine installation directory
INSTALL_DIR="$HOME/the_collective"

# Clone or Update Repository
if [ -d "$INSTALL_DIR" ]; then
    log "Repository directory exists. Pulling latest changes..."
    cd "$INSTALL_DIR"
    
    if git pull origin main 2>/dev/null; then
        success "Repository updated"
    else
        warn "Failed to update repository. Continuing with existing local version..."
    fi
else
    log "Cloning repository to $INSTALL_DIR..."
    
    if git clone --depth 1 https://github.com/screamingearth/the_collective.git "$INSTALL_DIR"; then
        cd "$INSTALL_DIR"
        success "Repository cloned successfully"
    else
        error "Failed to clone repository"
        error "Please check your internet connection and try again"
        exit 1
    fi
fi

# Make setup.sh executable if it isn't already
if [ -f "setup.sh" ] && [ ! -x "setup.sh" ]; then
    chmod +x setup.sh
fi

# Hand over to internal setup script
log ""
log "Running internal setup script..."
log "This will install Node.js (if missing), dependencies, and configure the environment"
log ""

if [ -f "setup.sh" ]; then
    ./setup.sh || {
        error "Setup script failed"
        exit 1
    }
else
    error "setup.sh not found in repository"
    exit 1
fi

# Success
echo ""
echo -e "\033[1;32m════════════════════════════════════════════════\033[0m"
echo -e "\033[1;32m🎉 Installation Complete!\033[0m"
echo -e "\033[1;32m════════════════════════════════════════════════\033[0m"
echo ""
echo -e "   \033[36mNext steps:\033[0m"
echo -e "   1. Open VS Code: \033[33mcode $INSTALL_DIR\033[0m"
echo -e "   2. In VS Code, open Copilot Chat and say: \033[35m\"hey nyx\"\033[0m"
echo ""
echo -e "   \033[2mLog file: $LOGFILE\033[0m"
echo ""
