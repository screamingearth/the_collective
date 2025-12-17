# ==============================================================================
# >the_collective - Windows Bootstrapper
# ==============================================================================
# One-line install: iwr -useb https://raw.githubusercontent.com/screamingearth/the_collective/main/bootstrapper_win.ps1 | iex
# ==============================================================================
# This file is part of >the_collective by screamingearth (Apache 2.0 licensed).
# ==============================================================================

# Set error action to stop on error
$ErrorActionPreference = "Stop"

# Define Logging
$LogFile = "$env:TEMP\the_collective_install.log"
function Log-Message {
    param([string]$Message, [string]$Color = "Cyan")
    $TimeStamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogOutput = "[$TimeStamp] $Message"
    Write-Host $LogOutput -ForegroundColor $Color
    Add-Content -Path $LogFile -Value $LogOutput
}

function Log-Error {
    param([string]$Message)
    Log-Message $Message "Red"
}

function Log-Success {
    param([string]$Message)
    Log-Message $Message "Green"
}

# Banner
Write-Host ""
Write-Host "   ▀█▀ █ █ █▀▀" -ForegroundColor Cyan
Write-Host "    █  █▀█ ██▄" -ForegroundColor Cyan
Write-Host "   █▀▀ █▀█ █   █   █▀▀ █▀▀ ▀█▀ █ █ █ █▀▀" -ForegroundColor Magenta
Write-Host "   █▄▄ █▄█ █▄▄ █▄▄ ██▄ █▄▄  █  █ ▀▄▀ ██▄" -ForegroundColor Magenta
Write-Host ""
Write-Host "   Windows Bootstrapper" -ForegroundColor White
Write-Host ""

try {
    Log-Message "Starting installation for Windows..."
    Log-Message "Log file: $LogFile"
    
    # Check for Git & Install if missing
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Log-Message "Git not found. Installing Git via winget..."
        
        # Verify winget exists (standard on Windows 10 1709+, Windows 11)
        if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
            Log-Error "winget not found. Please install Git manually from: https://git-scm.com/download/win"
            Log-Error "Or install winget (App Installer) from Microsoft Store"
            Pause
            exit 1
        }
        
        # Install Git
        try {
            winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements --silent | Out-Null
            Log-Success "Git installed successfully"
        } catch {
            Log-Error "Failed to install Git via winget"
            Log-Message "Please install Git manually: https://git-scm.com/download/win"
            Pause
            exit 1
        }
        
        # Refresh environment variables to access git immediately
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        # Verify git is now accessible
        if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
            Log-Error "Git installed but not found in PATH. Please restart your terminal."
            Pause
            exit 1
        }
    } else {
        Log-Success "Git already installed: $(git --version)"
    }
    
    # Check for Node.js (setup.sh will install if missing, but check anyway)
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Log-Message "Node.js not found. It will be installed by setup.sh"
    } else {
        Log-Success "Node.js already installed: $(node --version)"
    }
    
    # Determine installation directory
    $InstallDir = "$HOME\the_collective"
    
    # Clone or Update Repository
    if (Test-Path $InstallDir) {
        Log-Message "Repository directory exists. Pulling latest changes..."
        Set-Location $InstallDir
        
        try {
            git pull origin main
            Log-Success "Repository updated"
        } catch {
            Log-Error "Failed to update repository. Manual intervention may be required."
            Log-Message "Continuing with existing local version..."
        }
    } else {
        Log-Message "Cloning repository to $InstallDir..."
        
        try {
            git clone --depth 1 https://github.com/screamingearth/the_collective.git $InstallDir
            Set-Location $InstallDir
            Log-Success "Repository cloned successfully"
        } catch {
            Log-Error "Failed to clone repository"
            Log-Message "Please check your internet connection and try again"
            Pause
            exit 1
        }
    }
    
    # Hand over to internal setup script
    Log-Message ""
    Log-Message "Running internal setup script..."
    Log-Message "This will install Node.js (if missing), dependencies, and configure the environment"
    Log-Message ""
    
    # Run setup.sh via Git Bash (which we just installed)
    if (Test-Path ".\setup.sh") {
        # Git Bash should now be in PATH after installation
        if (Get-Command bash -ErrorAction SilentlyContinue) {
            bash .\setup.sh
        } else {
            Log-Error "Git Bash not found in PATH after Git installation"
            Log-Message "Please restart your terminal and run: bash setup.sh"
            Log-Message "Or open Git Bash and run: ./setup.sh"
            Pause
            exit 1
        }
    } else {
        Log-Error "setup.sh not found in repository"
        Pause
        exit 1
    }
    
    # Success
    Write-Host ""
    Write-Host "════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "🎉 Installation Complete!" -ForegroundColor Green
    Write-Host "════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host "   Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Open VS Code: " -NoNewline
    Write-Host "code $InstallDir" -ForegroundColor Yellow
    Write-Host "   2. In VS Code, open Copilot Chat and say: " -NoNewline
    Write-Host '"hey nyx"' -ForegroundColor Magenta
    Write-Host ""
    
    # Offer to open VS Code if installed
    if (Get-Command code -ErrorAction SilentlyContinue) {
        $OpenCode = Read-Host "Open in VS Code now? (y/n)"
        if ($OpenCode -eq "y" -or $OpenCode -eq "Y") {
            code $InstallDir
        }
    }
    
    Pause
    
} catch {
    Log-Error "ERROR: $($_.Exception.Message)"
    Write-Host ""
    Write-Host "Please check the log file at: $LogFile" -ForegroundColor Red
    Write-Host "For support, visit: https://github.com/screamingearth/the_collective/issues" -ForegroundColor Yellow
    Write-Host ""
    Pause
    exit 1
}
