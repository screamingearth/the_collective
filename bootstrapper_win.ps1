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
$LogFile = Join-Path ([System.IO.Path]::GetTempPath()) "the_collective_install.log"
if ($env:USERPROFILE) {
    $LogFile = Join-Path $env:USERPROFILE ".collective_install.log"
}

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

function Refresh-Path {
    Log-Message "Refreshing PATH environment variable..." "Gray"
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

function Test-Winget {
    return (Get-Command winget -ErrorAction SilentlyContinue) -ne $null
}

function Require-Winget {
    if (-not (Test-Winget)) {
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
        Pause
        exit 1
    }
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
    
    # Check if running as Administrator
    $isAdmin = $false
    if ($IsWindows -or $PSVersionTable.PSEdition -eq 'Desktop') {
        $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
        if (-not $isAdmin) {
            Log-Message "Running as standard user (winget may prompt for elevation)" "Yellow"
        }
    }
    
    # ══════════════════════════════════════════════════════════════════════════
    # [1/5] Check winget availability
    # ══════════════════════════════════════════════════════════════════════════
    Log-Message ""
    Log-Message "[1/5] Checking winget..." "White"
    Log-Message "────────────────────────────────────────" "DarkGray"
    Require-Winget
    Log-Success "winget is available"
    
    # ══════════════════════════════════════════════════════════════════════════
    # [2/5] Install Git
    # ══════════════════════════════════════════════════════════════════════════
    Log-Message ""
    Log-Message "[2/5] Installing Git" "White"
    Log-Message "────────────────────────────────────────" "DarkGray"
    
    if (Get-Command git -ErrorAction SilentlyContinue) {
        Log-Success "Git already installed: $(git --version)"
    } else {
        Log-Message "Installing Git via winget..."
        try {
            winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements --silent 2>&1 | Out-Null
            Refresh-Path
            
            # Add common Git paths manually if needed
            $gitPaths = @(
                "C:\Program Files\Git\cmd",
                "C:\Program Files\Git\bin",
                "$env:LOCALAPPDATA\Programs\Git\cmd"
            )
            foreach ($p in $gitPaths) {
                if ((Test-Path $p) -and ($env:Path -notlike "*$p*")) {
                    $env:Path = "$p;$env:Path"
                }
            }
            
            if (Get-Command git -ErrorAction SilentlyContinue) {
                Log-Success "Git installed successfully"
            } else {
                throw "Git installed but not in PATH. Please restart your terminal and try again."
            }
        } catch {
            Log-Error "Failed to install Git: $_"
            Log-Message "Manual install: https://git-scm.com/download/win" "Yellow"
            Pause
            exit 1
        }
    }
    
    # ══════════════════════════════════════════════════════════════════════════
    # [3/5] Install Node.js LTS
    # ══════════════════════════════════════════════════════════════════════════
    Log-Message ""
    Log-Message "[3/5] Installing Node.js" "White"
    Log-Message "────────────────────────────────────────" "DarkGray"
    
    $nodeInstalled = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeInstalled) {
        $nodeVersion = node -v
        Log-Success "Node.js already installed: $nodeVersion"
        
        # Check for unsupported versions (v23+ lack prebuilt binaries for some native modules)
        if ($nodeVersion -match "v2[3-9]") {
            Log-Message "Node.js $nodeVersion may lack prebuilt binaries for some packages." "Yellow"
            Log-Message "Recommended: Use Node.js v22 (LTS) for best compatibility." "Yellow"
            Log-Message "You can switch with: nvm install 22 && nvm use 22" "Gray"
        }
    } else {
        Log-Message "Installing Node.js LTS via winget..."
        try {
            winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements --silent 2>&1 | Out-Null
            Refresh-Path
            
            # Add common Node.js paths
            $nodePaths = @(
                "C:\Program Files\nodejs",
                "$env:LOCALAPPDATA\Programs\nodejs",
                "$env:APPDATA\npm"
            )
            foreach ($p in $nodePaths) {
                if ((Test-Path $p) -and ($env:Path -notlike "*$p*")) {
                    $env:Path = "$p;$env:Path"
                }
            }
            
            if (Get-Command node -ErrorAction SilentlyContinue) {
                $nodeVersion = node -v
                Log-Success "Node.js installed successfully: $nodeVersion"
            } else {
                throw "Node.js installed but not in PATH. Please restart your terminal and try again."
            }
        } catch {
            Log-Error "Failed to install Node.js: $_"
            Log-Message "Manual install: https://nodejs.org" "Yellow"
            Pause
            exit 1
        }
    }
    
    # ══════════════════════════════════════════════════════════════════════════
    # [4/5] Install VS Code
    # ══════════════════════════════════════════════════════════════════════════
    Log-Message ""
    Log-Message "[4/5] Installing VS Code" "White"
    Log-Message "────────────────────────────────────────" "DarkGray"
    
    if (Get-Command code -ErrorAction SilentlyContinue) {
        Log-Success "VS Code already installed"
    } else {
        Log-Message "Installing VS Code via winget..."
        try {
            winget install --id Microsoft.VisualStudioCode -e --accept-package-agreements --accept-source-agreements --silent 2>&1 | Out-Null
            Refresh-Path
            
            # Add common VS Code paths
            $codePaths = @(
                "$env:LOCALAPPDATA\Programs\Microsoft VS Code\bin",
                "C:\Program Files\Microsoft VS Code\bin"
            )
            foreach ($p in $codePaths) {
                if ((Test-Path $p) -and ($env:Path -notlike "*$p*")) {
                    $env:Path = "$p;$env:Path"
                }
            }
            
            if (Get-Command code -ErrorAction SilentlyContinue) {
                Log-Success "VS Code installed successfully"
            } else {
                Log-Message "VS Code installed but 'code' command not in PATH yet" "Yellow"
                Log-Message "You may need to restart your terminal or launch VS Code manually" "Yellow"
            }
        } catch {
            Log-Error "Failed to install VS Code: $_"
            Log-Message "Manual install: https://code.visualstudio.com" "Yellow"
            # Don't exit - VS Code is important but we can continue
        }
    }
    
    # ══════════════════════════════════════════════════════════════════════════
    # [5/5] Clone Repository & Run Setup
    # ══════════════════════════════════════════════════════════════════════════
    Log-Message ""
    Log-Message "[5/5] Setting up >the_collective" "White"
    Log-Message "────────────────────────────────────────" "DarkGray"
    
    # Check for running node processes that might lock files
    $runningNode = Get-Process node -ErrorAction SilentlyContinue
    if ($runningNode) {
        Log-Message "" "Yellow"
        Log-Message "⚠️  WARNING: Detected running Node.js processes." "Yellow"
        Log-Message "   These may cause 'EBUSY' errors during installation." "Yellow"
        Log-Message "   Please close VS Code and other Node.js apps before continuing." "Yellow"
        Log-Message "" "Yellow"
        Read-Host "Press Enter once you have closed other Node.js processes..."
    }
    
    # Determine installation directory
    $DocumentsPath = [Environment]::GetFolderPath('MyDocuments')
    $InstallDir = Join-Path $DocumentsPath "the_collective"
    
    Log-Message "Installation directory: $InstallDir" "Cyan"
    
    # Clone or Update Repository
    if (Test-Path $InstallDir) {
        Log-Message "Repository directory exists. Checking integrity..."
        try {
            Set-Location $InstallDir -ErrorAction Stop
            
            $isGitRepo = git rev-parse --is-inside-work-tree 2>$null
            if ($LASTEXITCODE -eq 0) {
                Log-Message "Valid repository found. Pulling latest changes..."
                git pull origin main 2>&1 | Out-Null
                Log-Success "Repository updated"
            } else {
                Log-Message "Directory exists but is not a valid git repository." "Yellow"
                $BackupDir = "${InstallDir}_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
                Move-Item -Path $InstallDir -Destination $BackupDir -Force
                
                git clone --depth 1 https://github.com/screamingearth/the_collective.git $InstallDir
                Set-Location $InstallDir -ErrorAction Stop
                Log-Success "Repository cloned successfully"
            }
        } catch {
            Log-Error "Failed to update repository: $($_.Exception.Message)"
            Log-Message "Continuing with existing local version..." "Yellow"
        }
    } else {
        Log-Message "Cloning repository..."
        try {
            git clone --depth 1 https://github.com/screamingearth/the_collective.git $InstallDir
            Set-Location $InstallDir -ErrorAction Stop
            Log-Success "Repository cloned successfully"
        } catch {
            Log-Error "Failed to clone repository: $_"
            Log-Message "Please check your internet connection and try again" "Yellow"
            Pause
            exit 1
        }
    }
    
    # Run setup.sh via Git Bash
    Log-Message ""
    Log-Message "Running internal setup script..."
    Log-Message "This will install dependencies and configure the environment"
    Log-Message ""
    
    if (Test-Path "./setup.sh") {
        # Find bash
        $bashPath = $null
        if (Get-Command bash -ErrorAction SilentlyContinue) {
            $bashPath = "bash"
        } else {
            $bashLocations = @(
                "C:\Program Files\Git\bin\bash.exe",
                "C:\Program Files (x86)\Git\bin\bash.exe",
                "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe"
            )
            foreach ($loc in $bashLocations) {
                if (Test-Path $loc) {
                    $bashPath = $loc
                    break
                }
            }
        }
        
        if ($bashPath) {
            & $bashPath -c "./setup.sh"
            $setupExitCode = $LASTEXITCODE
            
            if ($setupExitCode -ne 0) {
                Log-Error "Setup script failed with exit code: $setupExitCode"
                Log-Message ""
                Log-Message "Recovery options:" "Yellow"
                Log-Message "  1. Close VS Code and other Node.js apps" "Yellow"
                Log-Message "  2. Run: npm cache clean --force" "Yellow"
                Log-Message "  3. Run: rm -rf node_modules .collective/*/node_modules" "Yellow"
                Log-Message "  4. Retry: ./setup.sh" "Yellow"
                Log-Message ""
                Pause
                exit $setupExitCode
            }
        } else {
            Log-Error "Git Bash (bash.exe) not found"
            Log-Message ""
            Log-Message "Please open Git Bash and run:" "Yellow"
            Log-Message "  cd ~/Documents/the_collective && ./setup.sh" "Cyan"
            Pause
            exit 1
        }
    } else {
        Log-Error "setup.sh not found in repository"
        Pause
        exit 1
    }
    
    # ══════════════════════════════════════════════════════════════════════════
    # Success - Launch VS Code
    # ══════════════════════════════════════════════════════════════════════════
    Write-Host ""
    Write-Host "════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "🎉 Installation Complete!" -ForegroundColor Green
    Write-Host "════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host "   📁 Installed to: $InstallDir" -ForegroundColor Cyan
    Write-Host ""
    
    # Launch VS Code automatically
    if (Get-Command code -ErrorAction SilentlyContinue) {
        Write-Host "   🚀 Launching VS Code..." -ForegroundColor Cyan
        Write-Host ""
        Start-Sleep -Seconds 2
        code "$InstallDir"
        
        Write-Host "   ✨ VS Code is opening!" -ForegroundColor Green
        Write-Host ""
        Write-Host "   Next steps:" -ForegroundColor White
        Write-Host "      1. Wait for MCP servers to initialize (bottom-right status)" -ForegroundColor Gray
        Write-Host "      2. Open Copilot Chat sidebar (Ctrl+Shift+I)" -ForegroundColor Gray
        Write-Host "      3. Type: " -NoNewline
        Write-Host '"hey nyx"' -ForegroundColor Magenta
        Write-Host ""
    } else {
        Write-Host "   ⚠️  VS Code 'code' command not in PATH" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "   To complete setup:" -ForegroundColor White
        Write-Host "      1. Open VS Code manually" -ForegroundColor Gray
        Write-Host "      2. File → Open Folder → $InstallDir" -ForegroundColor Gray
        Write-Host "      3. Open Copilot Chat and say: " -NoNewline
        Write-Host '"hey nyx"' -ForegroundColor Magenta
        Write-Host ""
    }
    
    Write-Host "   Press Enter to close this window..." -ForegroundColor DarkGray
    Read-Host
    
} catch {
    Log-Error "ERROR: $($_.Exception.Message)"
    Write-Host ""
    Write-Host "Log file: $LogFile" -ForegroundColor Red
    Write-Host "For support: https://github.com/screamingearth/the_collective/issues" -ForegroundColor Yellow
    Write-Host ""
    Pause
    exit 1
}
