#!/usr/bin/env bash

# ==============================================================================
# Part of the_collective by screamingearth (Apache 2.0 licensed, see NOTICE file).
# ==============================================================================
# Universal Setup
# ==============================================================================
# ONE script that does EVERYTHING:
#   1. Detects your OS
#   2. Installs Node.js 22 if missing or outdated
#   3. Installs all dependencies
#   4. Builds the memory server
#   5. Bootstraps core memories
#
# Usage:
#   ./setup.sh
#   OR
#   curl -fsSL https://raw.githubusercontent.com/screamingearth/the_collective/main/setup.sh | bash
# ==============================================================================

set -e

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
mkdir -p .collective/.logs 2>/dev/null || true
LOG_FILE=".collective/.logs/setup.log"
exec 1> >(tee -a "$LOG_FILE")
exec 2>&1

# Node.js version requirements
MIN_NODE_VERSION=20
PREFERRED_NODE_VERSION=22

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------

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

# -----------------------------------------------------------------------------
# OS Detection
# -----------------------------------------------------------------------------

detect_os() {
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
    [[ "$version" -ge "$MIN_NODE_VERSION" ]]
}

install_node() {
    info "Installing Node.js ${PREFERRED_NODE_VERSION}..."

    # Validate curl is available (needed for node installation)
    if ! command -v curl &> /dev/null; then
        error "curl not found - required for Node.js installation"
        error "Install curl first: https://curl.se/"
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
            else
                install_nvm
            fi
            ;;
        fedora|rhel)
            info "Installing via dnf..."
            sudo dnf module install -y nodejs:$PREFERRED_NODE_VERSION/common 2>/dev/null || {
                info "Trying NodeSource RPM..."
                curl -fsSL https://rpm.nodesource.com/setup_${PREFERRED_NODE_VERSION}.x | sudo bash - || {
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
            curl -fsSL https://deb.nodesource.com/setup_${PREFERRED_NODE_VERSION}.x | sudo -E bash - || {
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
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash || {
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
        cd .collective/gemini-bridge || {
            error "Failed to enter gemini-bridge directory"
            exit 1
        }
        
        # Set timeout for auth (some systems might hang)
        timeout 120 npm run auth 2>/dev/null || {
            warn "Gemini authentication did not complete (you can run it later)"
        }
        
        cd ../.. || {
            error "Failed to return to root directory"
            exit 1
        }
        success "Gemini tools setup attempted"
    else
        info "Skipping Gemini setup (you can run 'cd .collective/gemini-bridge && npm run auth' later)"
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
            error "Git not found - required for cloning repository"
            error "Install Git: https://git-scm.com/downloads"
            exit 1
        fi

        if [[ ! -d "the_collective" ]]; then
            info "Cloning the_collective repository..."
            git clone https://github.com/screamingearth/the_collective.git || {
                error "Failed to clone repository"
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

    # Detect OS
    detect_os
    info "Detected: $OS ($PKG_MANAGER)"

    # Clone repo if running via curl | bash
    clone_if_needed

    # Determine total steps based on whether we need to install Node
    if check_node; then
        success "Node.js v$(get_node_version) detected"
        TOTAL_STEPS=5
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
    else
        if command -v node &> /dev/null; then
            warn "Node.js v$(get_node_version) is too old (need v${MIN_NODE_VERSION}+)"
        else
            warn "Node.js not found"
        fi

        TOTAL_STEPS=6
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
    fi

    print_success
}

main "$@"
