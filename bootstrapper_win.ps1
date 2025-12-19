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

function Show-Progress {
    param([string]$Activity)
    Write-Host "   ⏳ " -NoNewline -ForegroundColor Yellow
    Write-Host "$Activity (this may take a minute)..." -ForegroundColor Gray
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
        Show-Progress "Downloading and installing Git"
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
    # [3/6] Install Visual C++ Redistributable (required for native modules)
    # ══════════════════════════════════════════════════════════════════════════
    Log-Message ""
    Log-Message "[3/6] Installing Visual C++ Redistributable" "White"
    Log-Message "────────────────────────────────────────" "DarkGray"
    
    # Check for VC++ Redistributable via multiple methods
    $vcRedistFound = $false
    
    # Method 1: Registry check (VS 14.0+ / 2015+)
    $regPaths = @(
        "HKLM:\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\X64",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\X64"
    )
    foreach ($regPath in $regPaths) {
        $vcRedist = Get-ItemProperty $regPath -ErrorAction SilentlyContinue
        if ($vcRedist -and $vcRedist.Installed -eq 1) {
            $vcRedistFound = $true
            break
        }
    }
    
    # Method 2: Check installed programs
    if (-not $vcRedistFound) {
        $vcRedistPackages = Get-AppxPackage | Where-Object { $_.Name -like "*VCLibs*" -or $_.Name -like "*VCRedist*" }
        if ($vcRedistPackages) {
            $vcRedistFound = $true
        }
    }
    
    if ($vcRedistFound) {
        Log-Success "Visual C++ Redistributable already installed"
    } else {
        Log-Message "Installing Visual C++ Redistributable (required for onnxruntime-node)..."
        Show-Progress "Downloading and installing VC++ Redistributable"
        try {
            winget install --id Microsoft.VCRedist.2015+.x64 -e --accept-package-agreements --accept-source-agreements --silent 2>&1 | Out-Null
            Log-Success "Visual C++ Redistributable installed"
        } catch {
            Log-Message "Failed to install VC++ Redistributable automatically" "Yellow"
            Log-Message "If native module errors occur, manually install from:" "Yellow"
            Log-Message "  https://aka.ms/vs/17/release/vc_redist.x64.exe" "Yellow"
            # Don't exit - continue and handle native module errors later if they occur
        }
    }
    
    # ══════════════════════════════════════════════════════════════════════════
    # [4/6] Install Node.js LTS (v22)
    # ══════════════════════════════════════════════════════════════════════════
    Log-Message ""
    Log-Message "[4/6] Installing Node.js" "White"
    Log-Message "────────────────────────────────────────" "DarkGray"
    
    $nodeOK = $false
    $nodeInstalled = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeInstalled) {
        $nodeVersion = node -v
        Log-Success "Node.js already installed: $nodeVersion"
        
        # Check for unsupported versions (v23+ lack prebuilt binaries for native modules)
        if ($nodeVersion -match "v2[3-9]|v[3-9][0-9]") {
            Log-Message ""
            Log-Message "⚠️  Node.js $nodeVersion is not supported!" "Yellow"
            Log-Message "   Native modules (onnxruntime, DuckDB) require Node.js v20 or v22 (LTS)." "Yellow"
            Log-Message ""
            
            # Check if nvm is already installed
            $nvmInstalled = Get-Command nvm -ErrorAction SilentlyContinue
            if ($nvmInstalled) {
                Log-Message "nvm detected! Installing Node.js v20 (best native module support)..." "Cyan"
                try {
                    nvm install 20
                    nvm use 20
                    Refresh-Path
                    $newVersion = node -v
                    if ($newVersion -match "v20") {
                        Log-Success "Switched to Node.js $newVersion via nvm"
                        $nodeOK = $true
                    }
                } catch {
                    Log-Error "Failed to switch Node.js version via nvm: $_"
                }
            } else {
                # Offer to install nvm-windows
                Log-Message "You have multiple options:" "White"
                Log-Message ""
                Log-Message "  [1] Install nvm-windows (recommended for developers)" "Cyan"
                Log-Message "      Lets you switch between Node.js versions for different projects" "Gray"
                Log-Message ""
                Log-Message "  [2] Skip and continue anyway" "Cyan"
                Log-Message "      May cause native module errors - not recommended" "Gray"
                Log-Message ""
                
                $choice = Read-Host "Enter choice (1 or 2)"
                
                if ($choice -eq "1") {
                    Log-Message ""
                    Log-Message "Installing nvm-windows..." "Cyan"
                    Show-Progress "Downloading and installing nvm-windows"
                    
                    try {
                        winget install --id CoreyButler.NVMforWindows -e --accept-package-agreements --accept-source-agreements --silent 2>&1 | Out-Null
                        Refresh-Path
                        
                        # nvm-windows requires a new terminal session to work
                        Log-Message ""
                        Log-Success "nvm-windows installed!"
                        Log-Message ""
                        Log-Message "⚠️  IMPORTANT: You need to restart your terminal for nvm to work." "Yellow"
                        Log-Message ""
                        Log-Message "After restarting, run these commands:" "White"
                        Log-Message "  nvm install 20" "Cyan"
                        Log-Message "  nvm use 20" "Cyan"
                        Log-Message "  cd ~/Documents/the_collective" "Cyan"
                        Log-Message "  ./setup.sh" "Cyan"
                        Log-Message ""
                        Log-Message "Or re-run this bootstrapper after restarting your terminal." "Gray"
                        Log-Message ""
                        Pause
                        exit 0
                    } catch {
                        Log-Error "Failed to install nvm-windows: $_"
                        Log-Message "Manual install: https://github.com/coreybutler/nvm-windows/releases" "Yellow"
                        Pause
                        exit 1
                    }
                } else {
                    Log-Message ""
                    Log-Message "Continuing with Node.js $nodeVersion..." "Yellow"
                    Log-Message "⚠️  Native modules may fail to load. You can fix this later with:" "Yellow"
                    Log-Message "   nvm install 20 && nvm use 20 && ./setup.sh" "Gray"
                    Log-Message ""
                    $nodeOK = $true  # Let them try, they were warned
                }
            }
        } else {
            # Node version is supported (v20, v21, v22) - ensure npm is up to date
            Log-Message "Updating npm to latest version..."
            npm install -g npm@latest 2>&1 | Out-Null
            Refresh-Path
            $npmVersion = npm -v
            Log-Success "npm updated: v$npmVersion"
            $nodeOK = $true
        }
    } else {
        Log-Message "Installing Node.js v20 (LTS - best native module support) via winget..."
        Show-Progress "Downloading and installing Node.js v20"
        try {
            # Install v20 LTS specifically - best native module support for onnxruntime/DuckDB
            winget install --id OpenJS.NodeJS.LTS --version 20.19.2 -e --accept-package-agreements --accept-source-agreements --silent 2>&1 | Out-Null
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
                $nodeOK = $true
                
                # Update npm to latest to avoid deprecated internal package warnings
                Log-Message "Updating npm to latest version..."
                npm install -g npm@latest 2>&1 | Out-Null
                Refresh-Path
                $npmVersion = npm -v
                Log-Success "npm updated: v$npmVersion"
            } else {
                throw "Node.js installed but not in PATH. Please restart your terminal and try again."
            }
        } catch {
            Log-Error "Failed to install Node.js: $_"
            Log-Message "Manual install: https://nodejs.org (choose v20 LTS)" "Yellow"
            Pause
            exit 1
        }
    }
    
    # ══════════════════════════════════════════════════════════════════════════
    # [5/6] Install VS Code
    # ══════════════════════════════════════════════════════════════════════════
    Log-Message ""
    Log-Message "[5/6] Installing Visual Studio Code" "White"
    Log-Message "────────────────────────────────────────" "DarkGray"
    
    if (Get-Command code -ErrorAction SilentlyContinue) {
        Log-Success "VS Code already installed"
    } else {
        Log-Message "Installing VS Code via winget..."
        Show-Progress "Downloading and installing VS Code"
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
    # [6/6] Clone Repository & Run Setup
    # ══════════════════════════════════════════════════════════════════════════
    Log-Message ""
    Log-Message "[6/6] Setting up >the_collective" "White"
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
                
                # Check for previous failed installs - offer to clean
                $nodeModulesExist = (Test-Path "node_modules") -or (Test-Path ".collective/memory-server/node_modules")
                if ($nodeModulesExist) {
                    Log-Message ""
                    Log-Message "Previous installation detected." "Cyan"
                    Log-Message "Cleaning old dependencies for fresh install..." "Cyan"
                    Show-Progress "Removing old dependencies"
                    
                    # Remove node_modules
                    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue "node_modules"
                    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue ".collective/memory-server/node_modules"
                    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue ".collective/gemini-bridge/node_modules"
                    
                    # Remove package-lock.json files to force fresh dependency resolution
                    Remove-Item -Force -ErrorAction SilentlyContinue "package-lock.json"
                    Remove-Item -Force -ErrorAction SilentlyContinue ".collective/memory-server/package-lock.json"
                    Remove-Item -Force -ErrorAction SilentlyContinue ".collective/gemini-bridge/package-lock.json"
                    
                    # Clear npm cache
                    npm cache clean --force 2>&1 | Out-Null
                    
                    Log-Success "Old dependencies removed - will install fresh"
                }
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
    Show-Progress "Installing npm packages and building servers"
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
