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
    $isAdmin = $false
    if ($IsWindows -or $PSVersionTable.PSEdition -eq 'Desktop') {
        $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
        if (-not $isAdmin) {
            Log-Message "Running as standard user (some installations may require admin rights)" "Yellow"
        }
    } else {
        Log-Message "Running on non-Windows platform (testing mode)" "Yellow"
    }
    
    # Helper function: Check if Visual Studio Build Tools are installed
    function Test-VisualStudioBuildTools {
        # Check for cl.exe (MSVC compiler) in common locations
        $vsToolsLocations = @(
            "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC",
            "C:\Program Files (x86)\Microsoft Visual Studio\2019\BuildTools\VC\Tools\MSVC",
            "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC",
            "C:\Program Files\Microsoft Visual Studio\2019\Community\VC\Tools\MSVC"
        )
        
        foreach ($location in $vsToolsLocations) {
            if (Test-Path $location) {
                return $true
            }
        }
        
        # Also check if cl.exe is in PATH
        if (Get-Command cl.exe -ErrorAction SilentlyContinue) {
            return $true
        }
        
        return $false
    }
    
    # Helper function: Install Visual Studio Build Tools with elevation if needed
    function Install-VisualStudioBuildTools {
        Log-Message ""
        Log-Message "Checking for Visual Studio C++ Build Tools..." "Cyan"
        
        if (Test-VisualStudioBuildTools) {
            Log-Success "Visual Studio C++ Build Tools already installed"
            return $true
        }
        
        Log-Message "Visual Studio Build Tools not detected" "Yellow"
        Log-Message ""
        
        if (-not $isAdmin) {
            Log-Message "Admin privileges required to install build tools" "Yellow"
            Log-Message "Requesting elevation..." "Yellow"
            Log-Message ""
            
            # Re-run this script with admin privileges
            $params = @{
                'FilePath' = 'powershell.exe'
                'ArgumentList' = @(
                    '-NoProfile',
                    '-ExecutionPolicy', 'Bypass',
                    '-Command', "& {Set-Location '$PWD'; & '$PSCommandPath'}"
                )
                'Verb' = 'RunAs'
                'Wait' = $true
            }
            
            try {
                Start-Process @params
                # After elevation completes, exit this process
                exit 0
            } catch {
                Log-Error "Failed to request elevation: $_"
                Log-Message "Please run PowerShell as Administrator and try again" "Yellow"
                return $false
            }
        }
        
        # If we get here, we're running as admin
        Log-Success "Running with admin privileges - installing build tools"
        Log-Message ""
        Log-Message "Downloading and installing Visual Studio Build Tools..." "Cyan"
        Log-Message "This will take 5-10 minutes. Please wait..." "Cyan"
        Log-Message ""
        
        try {
            # Try winget first (cleaner, no need for manual command)
            if (Get-Command winget -ErrorAction SilentlyContinue) {
                Log-Message "Using winget to install Visual Studio Build Tools..."
                # The --no-upgrade flag prevents updating existing versions
                winget install --id Microsoft.VisualStudio.2022.BuildTools `
                    --accept-package-agreements `
                    --accept-source-agreements `
                    --silent `
                    --override "--passive --wait" 2>&1 | ForEach-Object { Log-Message $_ "Gray" }
                
                if ($LASTEXITCODE -eq 0) {
                    Log-Success "Visual Studio Build Tools installed via winget"
                    return $true
                } else {
                    Log-Message "winget install had issues, trying direct download..." "Yellow"
                }
            }
            
            # Fallback: Direct download and install
            Log-Message "Downloading Visual Studio Build Tools installer..." "Cyan"
            $installerUrl = "https://aka.ms/vs/17/release/vs_buildtools.exe"
            $installerPath = Join-Path $env:TEMP "vs_buildtools.exe"
            
            # Download with progress
            $ProgressPreference = 'SilentlyContinue'  # Suppress progress bar for cleaner logs
            Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -ErrorAction Stop
            Log-Success "Downloaded Visual Studio Build Tools installer"
            
            # Install with C++ workload
            Log-Message "Running installer with C++ workload..." "Cyan"
            $setupArgs = @(
                "--quiet",
                "--wait",
                "--add Microsoft.VisualStudio.Workload.VCTools",
                "--add Microsoft.VisualStudio.Component.VC.CMake.Project"
            )
            
            & $installerPath $setupArgs
            
            if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq 3010) {  # 3010 = restart required
                Log-Success "Visual Studio Build Tools installed successfully"
                
                # Clean up installer
                Remove-Item $installerPath -ErrorAction SilentlyContinue
                
                # If restart required, ask user
                if ($LASTEXITCODE -eq 3010) {
                    Log-Message ""
                    Log-Message "Installation complete but a system restart is recommended" "Yellow"
                    Log-Message "Restarting now..." "Yellow"
                    Log-Message ""
                    Start-Sleep -Seconds 3
                    Restart-Computer -Force
                    exit 0
                }
                
                return $true
            } else {
                Log-Error "Visual Studio Build Tools installation failed with exit code: $LASTEXITCODE"
                Remove-Item $installerPath -ErrorAction SilentlyContinue
                return $false
            }
        } catch {
            Log-Error "Failed to install Visual Studio Build Tools: $_"
            Log-Message ""
            Log-Message "Manual installation:" "Yellow"
            Log-Message "1. Download: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022" "Yellow"
            Log-Message "2. Run installer and select 'Desktop development with C++'" "Yellow"
            Log-Message "3. Complete installation and restart this script" "Yellow"
            return $false
        }
    }
    
    # Attempt to install build tools if missing
    if (-not (Test-VisualStudioBuildTools)) {
        if (-not (Install-VisualStudioBuildTools)) {
            Log-Error "Build tools installation failed or was skipped"
            Log-Message "Setup cannot continue without C++ build tools" "Red"
            Pause
            exit 1
        }
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
            # Run setup.sh and capture detailed error output
            # Note: bash output goes directly to console + log file (via setup.sh's tee command)
            # We just need to check the exit code
            & $bashPath ./setup.sh
            $setupExitCode = $LASTEXITCODE
            
            if ($setupExitCode -ne 0) {
                Log-Error "Setup script failed with exit code: $setupExitCode"
                Log-Message ""
                Log-Message "Troubleshooting steps:" "Yellow"
                Log-Message "1. Check the detailed log file:" "Cyan"
                Log-Message "   Type: Get-Content .collective\.logs\setup.log | Select-Object -Last 50" "Gray"
                Log-Message ""
                Log-Message "2. Common causes on Windows:" "Cyan"
                Log-Message "   • Missing Visual Studio Build Tools (required for native modules like DuckDB)" "Gray"
                Log-Message "   • Insufficient disk space (need ~2GB)" "Gray"
                Log-Message "   • Node.js version too old (need v20+, preferably v22)" "Gray"
                Log-Message "   • Network issues downloading npm packages" "Gray"
                Log-Message ""
                Log-Message "3. If native module compilation failed:" "Cyan"
                Log-Message "   Download Visual Studio Build Tools: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022" "Yellow"
                Log-Message "   Select 'Desktop development with C++' during installation" "Yellow"
                Log-Message "   Then run: bash .\setup.sh" "Gray"
                Log-Message ""
                Log-Message "4. For more help, visit:" "Cyan"
                Log-Message "   https://github.com/screamingearth/the_collective/issues" "Yellow"
                throw "Setup failed (exit code $setupExitCode)"
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
