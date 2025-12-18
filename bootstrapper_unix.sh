#!/usr/bin/env bash

# ==============================================================================
# >the_collective - macOS/Linux Bootstrapper
# ==============================================================================
# One-line install: curl -fsSL https://raw.githubusercontent.com/screamingearth/the_collective/main/bootstrapper_unix.sh | bash
# ==============================================================================
# This file is part of >the_collective by screamingearth (Apache 2.0 licensed).
# ==============================================================================

{ # Prevent execution of partial script if download is interrupted

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
log ""

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
    if [[ $EUID -ne 0 ]]; then
        if command -v sudo &> /dev/null; then
            SUDO="sudo"
        else
            warn "sudo not found. If package installation fails, please run as root or install sudo."
        fi
    fi

    case "$pm" in
        apt)
            local apt_retries=3
            while [[ $apt_retries -gt 0 ]]; do
                if $SUDO apt-get update -y 2>/dev/null; then
                    break
                fi
                apt_retries=$((apt_retries - 1))
                [[ $apt_retries -gt 0 ]] && sleep 2
            done
            [[ $apt_retries -eq 0 ]] && return 1
            $SUDO apt-get install -y --no-install-recommends "${pkgs[@]}" && return 0 || return 1
            ;;
        dnf)
            $SUDO dnf install -y "${pkgs[@]}" && return 0 || return 1
            ;;
        yum)
            $SUDO yum install -y "${pkgs[@]}" && return 0 || return 1
            ;;
        pacman)
            # Use -S --needed instead of -Syu to avoid full system upgrade
            $SUDO pacman -S --noconfirm --needed "${pkgs[@]}" && return 0 || return 1
            ;;
        apk)
            $SUDO apk add --no-cache "${pkgs[@]}" && return 0 || return 1
            ;;
        zypper)
            $SUDO zypper -n install "${pkgs[@]}" && return 0 || return 1
            ;;
        brew)
            if ! command -v brew &> /dev/null; then
                log "Homebrew not found. Installing Homebrew..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || {
                    error "Failed to install Homebrew"
                    exit 1
                }
            fi
            if [[ -f /opt/homebrew/bin/brew ]]; then
                export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"
            elif [[ -f /usr/local/bin/brew ]]; then
                export PATH="/usr/local/bin:/usr/local/sbin:$PATH"
            elif [[ -f "$HOME/.homebrew/bin/brew" ]]; then
                export PATH="$HOME/.homebrew/bin:$PATH"
            fi
            if ! command -v brew &> /dev/null; then
                error "Homebrew installed but not accessible in PATH"
                return 1
            fi
            for p in "${pkgs[@]}"; do brew install "$p" || true; done
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Ensure essential tools are installed
log "Ensuring essential tools are installed (git, curl, python3, build tools)..."

case "$PKG_MANAGER" in
    apt)
        ensure_packages git curl python3 python3-setuptools build-essential || warn "Some packages failed to install. Setup may fail later."
        ;;
    dnf|yum)
        ensure_packages git curl python3 python3-setuptools gcc-c++ make || warn "Some packages failed to install. Setup may fail later."
        ;;
    pacman)
        ensure_packages git curl python python-setuptools base-devel || warn "Some packages failed to install. Setup may fail later."
        ;;
    brew)
        ensure_packages git curl python3 || warn "Some packages failed to install. Setup may fail later."
        # xcode-select --install is handled by setup.sh if needed
        ;;
    *)
        error "Unknown package manager. Cannot install dependencies automatically."
        error "Please ensure git, curl, python3, and build tools are installed manually."
        exit 1
        ;;
esac

# Post-install validation: verify essential tools are now accessible
log "Verifying essential tools are accessible..."
local missing_tools=()
for tool in git curl python3; do
    if ! command -v "$tool" &> /dev/null; then
        missing_tools+=("$tool")
    fi
done

if [[ ${#missing_tools[@]} -gt 0 ]]; then
    error "Installation succeeded but these tools are not in PATH: ${missing_tools[*]}"
    error "This may be a PATH configuration issue. Please add the tool directories to PATH and retry."
    exit 1
fi
success "All essential tools verified"

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
INSTALL_DIR="$HOME/Documents/the_collective"

log ""
log "Installation directory: $INSTALL_DIR"
if [[ "$OS_NAME" == "macOS" ]]; then
    log "  Location: ~/Documents/the_collective (visible in Finder)"
else
    log "  Location: ~/Documents/the_collective (accessible via: cd ~/Documents/the_collective)"
fi
log ""

# Clone or Update Repository
if [ -d "$INSTALL_DIR" ]; then
    log "Repository directory exists. Checking integrity..."
    cd "$INSTALL_DIR" || exit 1
    
    # Check if it's a valid git repo
    if git rev-parse --is-inside-work-tree &>/dev/null; then
        log "Valid repository found. Pulling latest changes..."
        if git pull origin main 2>/dev/null; then
            success "Repository updated"
        else
            warn "Failed to update repository. Continuing with existing local version..."
        fi
    else
        warn "Directory exists but is not a valid git repository."
        log "Moving existing directory to backup and re-cloning..."
        BACKUP_DIR="${INSTALL_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
        mv "$INSTALL_DIR" "$BACKUP_DIR"
        
        log "Cloning repository to $INSTALL_DIR..."
        if git clone --depth 1 https://github.com/screamingearth/the_collective.git "$INSTALL_DIR"; then
            cd "$INSTALL_DIR" || exit 1
            success "Repository cloned successfully"
        else
            error "Failed to clone repository"
            exit 1
        fi
    fi
else
    log "Cloning repository to $INSTALL_DIR..."
    
    if git clone --depth 1 https://github.com/screamingearth/the_collective.git "$INSTALL_DIR"; then
        cd "$INSTALL_DIR" || exit 1
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
echo -e "   \033[36m📁 Your installation:\033[0m"
echo -e "      Location: $INSTALL_DIR"
if [[ "$OS_NAME" == "macOS" ]]; then
    echo -e "      (Visible in: Finder → Go → Home → Documents → the_collective)"
else
    echo -e "      (Accessible via: cd ~/Documents/the_collective)"
fi
echo ""
echo -e "   \033[36m🚀 Next steps:\033[0m"
echo -e "      1. Open VS Code and select 'Open Folder...'"
echo -e "      2. Select the ROOT folder: \033[33m$INSTALL_DIR\033[0m"
echo -e "         \033[1;31m(CRITICAL: You must open the root folder for MCP servers to load)\033[0m"
echo -e "      3. Or run: \033[33mcode $INSTALL_DIR\033[0m"
echo -e "      4. In VS Code, open Copilot Chat sidebar"
echo -e "      5. Type: \033[35m\"hey nyx\"\033[0m"
echo ""
echo ""
echo -e "   \033[2mLog file: $LOGFILE\033[0m"
echo ""

} # End of safety block
