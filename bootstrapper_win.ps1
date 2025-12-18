# ==============================================================================
# >the_collective - Windows Bootstrapper
# ==============================================================================
# One-line install: iwr -useb https://raw.githubusercontent.com/screamingearth/the_collective/main/bootstrapper_win.ps1 | iex
# ==============================================================================
# This file is part of >the_collective by screamingearth (Apache 2.0 licensed).
# ==============================================================================

# Set error action to stop on error
$ErrorActionPreference = "Stop"

# Define Logging (cross-platform temp path)
$TempPath = if ($env:TEMP) { $env:TEMP } else { [System.IO.Path]::GetTempPath() }
$LogFile = Join-Path $TempPath "the_collective_install.log"
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
    
    # Check if running as Administrator (Windows-only check)
    if ($IsWindows -or $PSVersionTable.PSEdition -eq 'Desktop') {
        $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
        if (-not $isAdmin) {
            Log-Message "Running as standard user (some installations may require admin rights)" "Yellow"
        }
    } else {
        Log-Message "Running on non-Windows platform (testing mode)" "Yellow"
    }
    
    # Check for Git & Install if missing
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Log-Message "Git not found. Installing Git via winget..."
        
        # Verify winget exists (standard on Windows 10 1709+, Windows 11)
        if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
            Log-Error "winget not found."
            Log-Message ""
            Log-Message "To get winget (Windows Package Manager):" "Yellow"
            Log-Message "  1. Open Microsoft Store" "Yellow"
            Log-Message "  2. Search for 'App Installer'" "Yellow"
            Log-Message "  3. Install or Update it" "Yellow"
            Log-Message ""
            Log-Message "Or download directly:" "Yellow"
            Log-Message "  https://aka.ms/getwinget" "Yellow"
            Log-Message ""
            Log-Message "Alternative: Install Git manually from:" "Yellow"
            Log-Message "  https://git-scm.com/download/win" "Yellow"
            Pause
            exit 1
        }
        
        # Install Git
        try {
            Log-Message "Installing Git (this may take a minute)..."
            winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements --silent | Out-Null
            Log-Success "Git installed successfully"
        } catch {
            Log-Error "Failed to install Git via winget"
            Log-Message ""
            Log-Message "Manual installation options:" "Yellow"
            Log-Message "  1. Download from: https://git-scm.com/download/win" "Yellow"
            Log-Message "  2. Run the installer with default options" "Yellow"
            Log-Message "  3. Restart this script" "Yellow"
            Pause
            exit 1
        }
        
        # Refresh environment variables to access git immediately
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        
        # Also check common Git installation paths
        $gitPaths = @(
            "C:\Program Files\Git\cmd",
            "C:\Program Files\Git\bin",
            "C:\Program Files (x86)\Git\cmd",
            "$env:LOCALAPPDATA\Programs\Git\cmd"
        )
        foreach ($p in $gitPaths) {
            if ((Test-Path $p) -and ($env:Path -notlike "*$p*")) {
                $env:Path = "$p;$env:Path"
            }
        }
        
        # Verify git is now accessible
        if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
            Log-Error "Git installed but not found in PATH"
            Log-Message ""
            Log-Message "Please try one of these:" "Yellow"
            Log-Message "  1. Close this window and open a NEW PowerShell/Terminal" "Yellow"
            Log-Message "  2. Run this command again in the new terminal" "Yellow"
            Log-Message ""
            Log-Message "If that doesn't work:" "Yellow"
            Log-Message "  1. Open Git Bash (search for 'Git Bash' in Start menu)" "Yellow"
            Log-Message "  2. Run: cd ~ && git clone https://github.com/screamingearth/the_collective.git" "Yellow"
            Log-Message "  3. Run: cd the_collective && ./setup.sh" "Yellow"
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
    
    # Determine installation directory (cross-platform)
    $InstallDir = Join-Path $HOME "the_collective"
    
    # Clone or Update Repository
    if (Test-Path $InstallDir) {
        Log-Message "Repository directory exists. Pulling latest changes..."
        try {
            Set-Location $InstallDir -ErrorAction Stop
        } catch {
            Log-Error "Failed to change to directory: $InstallDir"
            Pause
            exit 1
        }
        
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
            try {
                Set-Location $InstallDir -ErrorAction Stop
            } catch {
                Log-Error "Failed to change to directory: $InstallDir"
                Pause
                exit 1
            }
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
    if (Test-Path "./setup.sh") {
        # Try to find bash in PATH or common locations
        $bashPath = $null
        
        if (Get-Command bash -ErrorAction SilentlyContinue) {
            $bashPath = "bash"
        } else {
            # Check common Git Bash locations (Windows-specific)
            $bashLocations = @(
                "C:\Program Files\Git\bin\bash.exe",
                "C:\Program Files (x86)\Git\bin\bash.exe",
                "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe",
                "C:\Program Files\Git\usr\bin\bash.exe"
            )
            foreach ($loc in $bashLocations) {
                if (Test-Path $loc) {
                    $bashPath = $loc
                    break
                }
            }
        }
        
        if ($bashPath) {
            & $bashPath ./setup.sh
            if ($LASTEXITCODE -ne 0) {
                Log-Error "Setup script failed with exit code: $LASTEXITCODE"
                throw "Setup failed"
            }
        } else {
            Log-Error "Git Bash (bash.exe) not found"
            Log-Message ""
            Log-Message "The setup script requires Git Bash to run." "Yellow"
            Log-Message ""
            Log-Message "Please try one of these options:" "Yellow"
            Log-Message ""
            Log-Message "Option 1: Use Git Bash directly" "Cyan"
            Log-Message "  1. Open Git Bash (search 'Git Bash' in Start menu)"
            Log-Message "  2. Run: cd ~/the_collective"
            Log-Message "  3. Run: ./setup.sh"
            Log-Message ""
            Log-Message "Option 2: Restart and retry" "Cyan"
            Log-Message "  1. Close this window"
            Log-Message "  2. Open a new PowerShell window"
            Log-Message "  3. Run: cd $InstallDir; bash .\setup.sh"
            Log-Message ""
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
