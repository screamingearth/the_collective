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

show_progress() {
    echo -e "   \033[1;33m⏳\033[0m \033[2m$1 (this may take a minute)...\033[0m"
}

# Spinner for long-running operations
run_with_spinner() {
    local message="$1"
    shift
    local pid
    local spin_chars='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    local i=0
    
    # Run command in background
    "$@" &
    pid=$!
    
    # Show spinner while command runs
    while kill -0 "$pid" 2>/dev/null; do
        local char="${spin_chars:$i:1}"
        printf "\r\033[36m%s\033[0m %s" "$char" "$message"
        i=$(( (i + 1) % 10 ))
        sleep 0.1
    done
    
    # Wait for command and get exit code
    wait "$pid"
    local exit_code=$?
    
    # Clear spinner line
    printf "\r%*s\r" $((${#message} + 3)) ""
    
    return $exit_code
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

# Set up sudo if needed (global for all functions)
SUDO=""
if [[ $EUID -ne 0 ]]; then
    if command -v sudo &> /dev/null; then
        SUDO="sudo"
    else
        warn "sudo not found. If package installation fails, please run as root or install sudo."
    fi
fi

# Helper: ensure_packages - cross-distro install of small toolset
ensure_packages() {
    # Usage: ensure_packages pkg1 pkg2 ...
    local pkgs=("$@")
    local pm="$PKG_MANAGER"

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

# ══════════════════════════════════════════════════════════════════════════════
# Install Node.js v22
# ══════════════════════════════════════════════════════════════════════════════

install_nodejs() {
    log "Installing Node.js v22 (LTS)..."
    show_progress "Downloading and installing Node.js"
    
    case "$PKG_MANAGER" in
        brew)
            # Homebrew - install specific version
            brew install node@22 || {
                error "Failed to install Node.js via Homebrew"
                return 1
            }
            # Link it
            brew link --overwrite node@22 2>/dev/null || true
            ;;
        apt)
            # Use NodeSource for Ubuntu/Debian to get v22
            curl -fsSL https://deb.nodesource.com/setup_22.x | $SUDO bash - || {
                error "Failed to add NodeSource repository"
                return 1
            }
            $SUDO apt-get install -y nodejs || {
                error "Failed to install Node.js"
                return 1
            }
            ;;
        dnf|yum)
            # Use NodeSource for Fedora/RHEL
            curl -fsSL https://rpm.nodesource.com/setup_22.x | $SUDO bash - || {
                error "Failed to add NodeSource repository"
                return 1
            }
            $SUDO $PKG_MANAGER install -y nodejs || {
                error "Failed to install Node.js"
                return 1
            }
            ;;
        pacman)
            # Arch Linux - nodejs package
            $SUDO pacman -S --noconfirm nodejs npm || {
                error "Failed to install Node.js"
                return 1
            }
            ;;
        *)
            error "Unknown package manager. Cannot install Node.js automatically."
            error "Please install Node.js v22 manually: https://nodejs.org"
            return 1
            ;;
    esac
    
    return 0
}

check_and_install_nodejs() {
    if ! command -v node &> /dev/null; then
        log "Node.js not found. Installing..."
        if install_nodejs; then
            success "Node.js installed: $(node -v)"
            # Update npm to latest to avoid deprecated internal package warnings
            log "Updating npm to latest version..."
            npm install -g npm@latest 2>/dev/null || $SUDO npm install -g npm@latest
            success "npm updated: v$(npm -v)"
        else
            error "Failed to install Node.js"
            error "Please install Node.js v22 manually: https://nodejs.org"
            exit 1
        fi
    else
        NODE_VERSION=$(node -v)
        success "Node.js already installed: $NODE_VERSION"
        
        # Check for unsupported versions (v23+ lack prebuilt binaries for native modules)
        NODE_MAJOR=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d. -f1)
        if [[ "$NODE_MAJOR" -ge 23 ]]; then
            echo ""
            warn "⚠️  Node.js $NODE_VERSION is not supported!"
            warn "   Native modules (onnxruntime, DuckDB) require Node.js v20 or v22 (LTS)."
            echo ""
            
            # Check if nvm is already available
            if command -v nvm &> /dev/null || [ -s "$HOME/.nvm/nvm.sh" ]; then
                # Source nvm if available
                [ -s "$HOME/.nvm/nvm.sh" ] && source "$HOME/.nvm/nvm.sh"
                
                if command -v nvm &> /dev/null; then
                    log "nvm detected! Installing Node.js v22..."
                    show_progress "Installing Node.js v22 via nvm"
                    nvm install 22 && nvm use 22 && nvm alias default 22
                    success "Switched to Node.js $(node -v)"
                    return 0
                fi
            fi
            
            # Offer options
            log "You have multiple options:"
            echo ""
            log "  [1] Install nvm (recommended for developers)"
            log "      Lets you switch between Node.js versions for different projects"
            echo ""
            log "  [2] Continue anyway (may fail)"
            log "      Native modules will likely fail to load"
            echo ""
            
            read -p "Enter choice (1 or 2): " choice
            
            if [[ "$choice" == "1" ]]; then
                log ""
                log "Installing nvm..."
                show_progress "Downloading and installing nvm"
                
                # Install nvm
                curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
                
                # Source nvm
                export NVM_DIR="$HOME/.nvm"
                [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
                
                if command -v nvm &> /dev/null; then
                    log "Installing Node.js v22..."
                    nvm install 22 && nvm use 22 && nvm alias default 22
                    success "Node.js $(node -v) installed via nvm"
                else
                    echo ""
                    success "nvm installed!"
                    echo ""
                    warn "⚠️  IMPORTANT: You need to restart your terminal for nvm to work."
                    echo ""
                    log "After restarting, run these commands:"
                    log "  nvm install 22"
                    log "  nvm use 22"
                    log "  cd ~/Documents/the_collective"
                    log "  ./setup.sh"
                    echo ""
                    exit 0
                fi
            else
                log ""
                warn "Continuing with Node.js $NODE_VERSION - native modules may fail!"
                echo ""
            fi
        else
            # Node version is supported (v20-v22) - ensure npm is up to date
            log "Updating npm to latest version..."
            npm install -g npm@latest 2>/dev/null || $SUDO npm install -g npm@latest 2>/dev/null || true
            success "npm updated: v$(npm -v)"
        fi
    fi
}

check_and_install_nodejs

# ══════════════════════════════════════════════════════════════════════════════
# Install VS Code (optional - skip if already installed)
# ══════════════════════════════════════════════════════════════════════════════

install_vscode() {
    if command -v code &> /dev/null; then
        success "VS Code already installed"
        return 0
    fi
    
    log "Installing VS Code..."
    show_progress "Downloading and installing VS Code"
    
    case "$PKG_MANAGER" in
        brew)
            brew install --cask visual-studio-code || {
                warn "Failed to install VS Code via Homebrew"
                return 1
            }
            ;;
        apt)
            # Microsoft's official repo for Debian/Ubuntu
            curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > /tmp/packages.microsoft.gpg
            $SUDO install -D -o root -g root -m 644 /tmp/packages.microsoft.gpg /etc/apt/keyrings/packages.microsoft.gpg
            echo "deb [arch=amd64,arm64,armhf signed-by=/etc/apt/keyrings/packages.microsoft.gpg] https://packages.microsoft.com/repos/code stable main" | $SUDO tee /etc/apt/sources.list.d/vscode.list > /dev/null
            rm -f /tmp/packages.microsoft.gpg
            $SUDO apt-get update
            $SUDO apt-get install -y code || {
                warn "Failed to install VS Code"
                return 1
            }
            ;;
        dnf|yum)
            # Microsoft's official repo for Fedora/RHEL
            $SUDO rpm --import https://packages.microsoft.com/keys/microsoft.asc
            echo -e "[code]\nname=Visual Studio Code\nbaseurl=https://packages.microsoft.com/yumrepos/vscode\nenabled=1\ngpgcheck=1\ngpgkey=https://packages.microsoft.com/keys/microsoft.asc" | $SUDO tee /etc/yum.repos.d/vscode.repo > /dev/null
            $SUDO $PKG_MANAGER install -y code || {
                warn "Failed to install VS Code"
                return 1
            }
            ;;
        pacman)
            # VS Code is in AUR, use yay/paru if available, otherwise skip
            if command -v yay &> /dev/null; then
                yay -S --noconfirm visual-studio-code-bin || warn "Failed to install VS Code via yay"
            elif command -v paru &> /dev/null; then
                paru -S --noconfirm visual-studio-code-bin || warn "Failed to install VS Code via paru"
            else
                warn "VS Code not in official repos. Install from https://code.visualstudio.com or via AUR."
                return 1
            fi
            ;;
        *)
            warn "Cannot install VS Code automatically for this package manager."
            warn "Please install from: https://code.visualstudio.com"
            return 1
            ;;
    esac
    
    if command -v code &> /dev/null; then
        success "VS Code installed successfully"
        return 0
    else
        warn "VS Code installed but 'code' command not in PATH"
        warn "You may need to add it to PATH or launch VS Code manually"
        return 1
    fi
}

install_vscode

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
        
        # Check for previous failed installs - clean automatically
        if [ -d "node_modules" ] || [ -d ".collective/memory-server/node_modules" ]; then
            echo ""
            log "Previous installation detected."
            log "Cleaning old dependencies for fresh install..."
            
            # Remove node_modules
            rm -rf node_modules .collective/memory-server/node_modules .collective/gemini-bridge/node_modules 2>/dev/null
            
            # Remove package-lock.json files to force fresh dependency resolution
            rm -f package-lock.json .collective/memory-server/package-lock.json .collective/gemini-bridge/package-lock.json 2>/dev/null
            
            # Clear npm cache
            npm cache clean --force 2>/dev/null || true
            
            success "Old dependencies removed - will install fresh"
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
