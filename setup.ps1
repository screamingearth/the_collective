# ==============================================================================
# Part of the_collective by screamingearth (Apache 2.0 licensed, see NOTICE file).
# ==============================================================================
# Universal Windows Setup (PowerShell)
# ==============================================================================
# Native PowerShell installer - no Git Bash required
#
# SECURITY NOTE:
# This script is typically run via setup.bat with -ExecutionPolicy Bypass.
# This is SAFE because:
#   - Only affects THIS script execution (not system-wide)
#   - Doesn't bypass Windows Defender or antivirus
#   - Open source and auditable (you're reading it now!)
#   - Doesn't require admin privileges
#
# Alternative (more "official" but requires one-time setup):
#   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
#   .\setup.ps1
# ==============================================================================

#Requires -Version 5.1

# Set strict mode for better error handling
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ==========================================
# CONFIGURATION
# ==========================================

$MIN_NODE_VERSION = 20
$PREFERRED_NODE_VERSION = 22

# ==========================================
# LOGGING SETUP
# ==========================================

$LOG_DIR = ".collective\.logs"
if (-not (Test-Path $LOG_DIR)) {
    New-Item -ItemType Directory -Path $LOG_DIR -Force | Out-Null
}
$LOG_FILE = Join-Path $LOG_DIR "setup.log"

# Function to log and display
function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp | $Message" | Out-File -FilePath $LOG_FILE -Append
    Write-Host $Message
}

# Start logging
Write-Log "=== Setup started at $(Get-Date) ==="

# ==========================================
# HELPER FUNCTIONS
# ==========================================

function Write-Banner {
    Write-Host ""
    Write-Host "   ▀█▀ █ █ █▀▀" -ForegroundColor Cyan
    Write-Host "    █  █▀█ ██▄" -ForegroundColor Cyan
    Write-Host "   █▀▀ █▀█ █   █   █▀▀ █▀▀ ▀█▀ █ █ █ █▀▀" -ForegroundColor Magenta
    Write-Host "   █▄▄ █▄█ █▄▄ █▄▄ ██▄ █▄▄  █  █ ▀▄▀ ██▄" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "   Windows PowerShell Setup" -ForegroundColor White
    Write-Host ""
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ " -ForegroundColor Blue -NoNewline
    Write-Host $Message
    Write-Log "INFO: $Message"
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ " -ForegroundColor Green -NoNewline
    Write-Host $Message
    Write-Log "SUCCESS: $Message"
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ " -ForegroundColor Yellow -NoNewline
    Write-Host $Message
    Write-Log "WARNING: $Message"
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ " -ForegroundColor Red -NoNewline
    Write-Host $Message
    Write-Log "ERROR: $Message"
}

function Write-Step {
    param(
        [int]$Current,
        [int]$Total,
        [string]$Message
    )
    Write-Host ""
    Write-Host "[$Current/$Total] $Message" -ForegroundColor Cyan
    Write-Host "────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Log "STEP $Current/$Total: $Message"
}

# ==========================================
# NODE.JS MANAGEMENT
# ==========================================

function Get-NodeVersion {
    try {
        $version = node --version 2>$null
        if ($version -match "v(\d+)") {
            return [int]$matches[1]
        }
    } catch {
        return 0
    }
    return 0
}

function Test-NodeVersion {
    $version = Get-NodeVersion
    return $version -ge $MIN_NODE_VERSION
}

function Install-NodeJS {
    Write-Info "Installing Node.js $PREFERRED_NODE_VERSION..."
    
    # Try fnm first (fast, cross-platform)
    if (Get-Command fnm -ErrorAction SilentlyContinue) {
        Write-Info "Found fnm, using it..."
        try {
            fnm install $PREFERRED_NODE_VERSION
            fnm use $PREFERRED_NODE_VERSION
            fnm default $PREFERRED_NODE_VERSION
            Write-Success "Node.js installed via fnm"
            return
        } catch {
            Write-Warning "fnm installation failed, trying alternatives..."
        }
    }
    
    # Try nvm-windows
    $nvmDir = "$env:APPDATA\nvm"
    if (Test-Path $nvmDir) {
        Write-Info "Found nvm-windows..."
        Write-Warning "Please run manually: nvm install $PREFERRED_NODE_VERSION && nvm use $PREFERRED_NODE_VERSION"
        Write-Host "Press Enter after installing Node.js..."
        Read-Host
        return
    }
    
    # Try Chocolatey
    if (Get-Command choco -ErrorAction SilentlyContinue) {
        Write-Info "Found Chocolatey, using it..."
        try {
            choco install nodejs --version=$PREFERRED_NODE_VERSION -y
            # Refresh environment
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            Write-Success "Node.js installed via Chocolatey"
            return
        } catch {
            Write-Warning "Chocolatey installation failed, trying winget..."
        }
    }
    
    # Try winget (Windows 10+)
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Info "Found winget, using it..."
        try {
            winget install OpenJS.NodeJS --version $PREFERRED_NODE_VERSION --silent --accept-package-agreements --accept-source-agreements
            # Refresh environment
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            Write-Success "Node.js installed via winget"
            return
        } catch {
            Write-Warning "winget installation failed"
        }
    }
    
    # Manual fallback
    Write-Error "Could not auto-install Node.js"
    Write-Host ""
    Write-Host "Please install Node.js manually:" -ForegroundColor Yellow
    Write-Host "  1. Download from: " -NoNewline
    Write-Host "https://nodejs.org/" -ForegroundColor Cyan
    Write-Host "  2. Install Node.js $PREFERRED_NODE_VERSION or later"
    Write-Host "  3. Restart this script"
    Write-Host ""
    Write-Host "Or install a Node version manager:"
    Write-Host "  - fnm: " -NoNewline
    Write-Host "https://github.com/Schniz/fnm#installation" -ForegroundColor Cyan
    Write-Host "  - nvm-windows: " -NoNewline
    Write-Host "https://github.com/coreybutler/nvm-windows" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

# ==========================================
# SETUP STEPS
# ==========================================

function Install-Dependencies {
    Write-Info "Installing root dependencies..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install root dependencies"
        exit 1
    }
    Write-Success "Root dependencies installed"
    
    Write-Info "Installing memory server dependencies..."
    Push-Location ".collective\memory-server"
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to install memory-server dependencies"
        Pop-Location
        exit 1
    }
    try {
        npm rebuild 2>$null
    } catch {
        Write-Warning "npm rebuild had issues (non-critical)"
    }
    Pop-Location
    Write-Success "Memory server dependencies installed"
    
    Write-Info "Installing Gemini bridge dependencies..."
    Push-Location ".collective\gemini-bridge"
    try {
        npm install 2>$null
        Write-Success "Gemini bridge dependencies installed"
    } catch {
        Write-Warning "Gemini bridge install had issues (optional)"
    }
    Pop-Location
}

function Build-Projects {
    Write-Info "Building memory server..."
    Push-Location ".collective\memory-server"
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to build memory-server"
        Pop-Location
        exit 1
    }
    Pop-Location
    Write-Success "Memory server compiled"
    
    Write-Info "Building Gemini bridge..."
    Push-Location ".collective\gemini-bridge"
    try {
        npm run build 2>$null
        Write-Success "Gemini bridge compiled"
    } catch {
        Write-Warning "Gemini bridge build had issues (optional)"
    }
    Pop-Location
}

function Initialize-Memories {
    Write-Info "Bootstrapping core memories..."
    if (-not (Test-Path ".mcp")) {
        New-Item -ItemType Directory -Path ".mcp" -Force | Out-Null
    }
    
    Push-Location ".collective\memory-server"
    npm run bootstrap
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to bootstrap memories"
        Pop-Location
        exit 1
    }
    Pop-Location
    Write-Success "Core memories loaded"
}

function Test-VSCodeConfig {
    Write-Info "Verifying VS Code configuration..."
    
    if (-not (Test-Path ".vscode")) {
        Write-Warning ".vscode directory missing - this should exist in the repo"
        return
    }
    
    if (-not (Test-Path ".vscode\mcp.json")) {
        Write-Warning ".vscode\mcp.json missing - MCP servers won't auto-load"
    } else {
        Write-Success "MCP configuration verified"
    }
    
    if (-not (Test-Path ".vscode\settings.json")) {
        Write-Warning ".vscode\settings.json missing"
    } else {
        Write-Success "VS Code settings verified"
    }
}

function Initialize-GeminiOptional {
    Write-Host ""
    Write-Host "Optional: Gemini Research Tools" -ForegroundColor Cyan
    Write-Host "Enable cognitive diversity via Google's Gemini (different AI model)" -ForegroundColor DarkGray
    Write-Host ""
    
    $response = Read-Host "Enable Gemini tools? [y/N]"
    
    if ($response -match "^[Yy]") {
        Write-Info "Setting up Gemini authentication..."
        Write-Info "A browser window will open for Google OAuth authentication"
        Write-Info "If the browser doesn't open automatically, visit the URL shown in the terminal"
        Write-Host ""
        
        Push-Location ".collective\gemini-bridge"
        try {
            npm run auth
            Write-Success "Gemini tools authentication successful"
        } catch {
            Write-Warning "Gemini authentication did not complete (you can run it later with: cd .collective\gemini-bridge && npm run auth)"
        }
        Pop-Location
    } else {
        Write-Info "Skipping Gemini setup (you can run 'cd .collective\gemini-bridge && npm run auth' later)"
    }
}

function Initialize-FreshGitOptional {
    Write-Host ""
    Write-Host "Optional: Fresh Repository" -ForegroundColor Cyan
    Write-Host "Replace git history with a new repository" -ForegroundColor DarkGray
    Write-Host ""
    
    $response = Read-Host "Initialize fresh git repo? [y/N]"
    
    if ($response -match "^[Yy]") {
        Write-Info "Creating fresh repository..."
        
        # Backup original remote
        try {
            $originalRemote = git remote get-url origin 2>$null
        } catch {
            $originalRemote = ""
        }
        
        # Remove old git history
        if (Test-Path ".git") {
            Remove-Item -Recurse -Force ".git"
        }
        
        # Initialize fresh repo
        git init
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to initialize git repository"
            return
        }
        
        git add .
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to add files to git"
            return
        }
        
        # Prompt for custom commit message
        Write-Host ""
        Write-Host "Initial commit message:" -ForegroundColor Cyan
        Write-Host "  Default: " -NoNewline
        Write-Host "Initial commit from the_collective template" -ForegroundColor DarkGray
        $commitMsg = Read-Host "  Enter custom message (or press Enter for default)"
        
        if ([string]::IsNullOrWhiteSpace($commitMsg)) {
            $commitMsg = "Initial commit from the_collective template"
        }
        
        git commit -m $commitMsg
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to create initial commit"
            return
        }
        
        # Set default branch
        git branch -M main 2>$null
        
        Write-Success "Fresh repository created"
        
        if (-not [string]::IsNullOrWhiteSpace($originalRemote)) {
            Write-Info "Original remote was: $originalRemote"
            Write-Info "Add your remote: git remote add origin <your-repo-url>"
        }
    } else {
        Write-Info "Keeping existing git history"
    }
}

function Write-CompletionMessage {
    Write-Host ""
    Write-Host "════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "🎉 Setup complete!" -ForegroundColor Green
    Write-Host "════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host "   Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Restart VS Code (to load MCP servers)"
    Write-Host "   2. Open Copilot Chat and say " -NoNewline
    Write-Host "'hey nyx'" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "   Verify anytime: npm run check" -ForegroundColor DarkGray
    Write-Host "   Enable Gemini later: cd .collective\gemini-bridge && npm run auth" -ForegroundColor DarkGray
    Write-Host ""
    Write-Log "Setup completed successfully at $(Get-Date)"
}

function Install-GitIfNeeded {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Warning "Git not found - attempting to install..."
        
        # Try winget first (Windows 10+)
        if (Get-Command winget -ErrorAction SilentlyContinue) {
            Write-Info "Installing Git via winget..."
            try {
                winget install --id Git.Git -e --source winget --silent --accept-package-agreements --accept-source-agreements
                # Refresh environment
                $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
                Write-Success "Git installed via winget"
                return
            } catch {
                Write-Warning "winget installation failed, trying Chocolatey..."
            }
        }
        
        # Try Chocolatey
        if (Get-Command choco -ErrorAction SilentlyContinue) {
            Write-Info "Installing Git via Chocolatey..."
            try {
                choco install git -y
                # Refresh environment
                $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
                Write-Success "Git installed via Chocolatey"
                return
            } catch {
                Write-Warning "Chocolatey installation failed"
            }
        }
        
        # Manual fallback
        Write-Error "Could not auto-install Git"
        Write-Host ""
        Write-Host "Please install Git manually:" -ForegroundColor Yellow
        Write-Host "  Download from: " -NoNewline
        Write-Host "https://git-scm.com/downloads" -ForegroundColor Cyan
        Write-Host "  Then restart this script"
        Write-Host ""
        exit 1
    }
}

function Clone-RepositoryIfNeeded {
    # If running via irm | iex, we need to clone the repo first
    if (-not (Test-Path "package.json")) {
        # Ensure Git is available
        Install-GitIfNeeded
        
        $repoDir = "the_collective"
        if (-not (Test-Path $repoDir)) {
            Write-Info "Cloning the_collective repository..."
            git clone https://github.com/screamingearth/the_collective.git
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Failed to clone repository"
                exit 1
            }
        }
        
        Set-Location $repoDir
        
        # Verify critical directories exist
        if (-not (Test-Path ".collective")) {
            Write-Error ".collective directory missing in cloned repository"
            exit 1
        }
        
        Write-Success "Repository ready"
    }
}

# ==========================================
# MAIN EXECUTION
# ==========================================

function Main {
    Write-Banner
    Write-Info "Setup log: $LOG_FILE"
    
    # Verify PowerShell version
    $psVersion = $PSVersionTable.PSVersion.Major
    if ($psVersion -lt 5) {
        Write-Error "PowerShell $psVersion detected - this script requires PowerShell 5.1 or later"
        Write-Host ""
        Write-Host "Please update PowerShell:" -ForegroundColor Yellow
        Write-Host "  Windows 10/11: Already includes PowerShell 5.1"
        Write-Host "  Windows 7/8: Download Windows Management Framework 5.1"
        Write-Host "  URL: " -NoNewline
        Write-Host "https://www.microsoft.com/download/details.aspx?id=54616" -ForegroundColor Cyan
        Write-Host ""
        exit 1
    }
    
    Write-Info "Detected: Windows PowerShell $($PSVersionTable.PSVersion)"
    
    # Clone repo if running via remote script
    Clone-RepositoryIfNeeded
    
    # Check Node.js version
    if (Test-NodeVersion) {
        $nodeVersion = node --version
        Write-Success "Node.js $nodeVersion detected"
        $TOTAL_STEPS = 6
        $STEP = 0
        
        Write-Step (++$STEP) $TOTAL_STEPS "Installing dependencies"
        Install-Dependencies
        
        Write-Step (++$STEP) $TOTAL_STEPS "Building projects"
        Build-Projects
        
        Write-Step (++$STEP) $TOTAL_STEPS "Bootstrapping memories"
        Initialize-Memories
        
        Write-Step (++$STEP) $TOTAL_STEPS "Verifying VS Code configuration"
        Test-VSCodeConfig
        
        Write-Step (++$STEP) $TOTAL_STEPS "Gemini tools (optional)"
        Initialize-GeminiOptional
        
        Write-Step (++$STEP) $TOTAL_STEPS "Fresh repository (optional)"
        Initialize-FreshGitOptional
    } else {
        $currentVersion = Get-NodeVersion
        if ($currentVersion -gt 0) {
            Write-Warning "Node.js v$currentVersion is too old (need v${MIN_NODE_VERSION}+)"
        } else {
            Write-Warning "Node.js not found"
        }
        
        $TOTAL_STEPS = 7
        $STEP = 0
        
        Write-Step (++$STEP) $TOTAL_STEPS "Installing Node.js"
        Install-NodeJS
        
        # Verify installation
        if (-not (Test-NodeVersion)) {
            Write-Error "Node.js installation failed"
            Write-Host "Please install Node.js ${MIN_NODE_VERSION}+ manually: " -NoNewline
            Write-Host "https://nodejs.org" -ForegroundColor Cyan
            exit 1
        }
        
        $nodeVersion = node --version
        $npmVersion = npm --version
        Write-Info "Node.js: $nodeVersion"
        Write-Info "npm: $npmVersion"
        
        Write-Step (++$STEP) $TOTAL_STEPS "Installing dependencies"
        Install-Dependencies
        
        Write-Step (++$STEP) $TOTAL_STEPS "Building projects"
        Build-Projects
        
        Write-Step (++$STEP) $TOTAL_STEPS "Bootstrapping memories"
        Initialize-Memories
        
        Write-Step (++$STEP) $TOTAL_STEPS "Verifying VS Code configuration"
        Test-VSCodeConfig
        
        Write-Step (++$STEP) $TOTAL_STEPS "Gemini tools (optional)"
        Initialize-GeminiOptional
        
        Write-Step (++$STEP) $TOTAL_STEPS "Fresh repository (optional)"
        Initialize-FreshGitOptional
    }
    
    Write-CompletionMessage
}

# Run main function
try {
    Main
} catch {
    Write-Error "Setup failed: $_"
    Write-Log "FATAL ERROR: $_"
    Write-Log "Stack trace: $($_.ScriptStackTrace)"
    exit 1
}
