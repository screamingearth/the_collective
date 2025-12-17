@echo off
REM ==============================================================================
REM Part of the_collective by screamingearth (Apache 2.0 licensed, see NOTICE file).
REM ==============================================================================
REM Windows Setup Launcher
REM ==============================================================================

echo ========================================================
echo        THE COLLECTIVE - WINDOWS SETUP
echo ========================================================
echo.
echo This script uses -ExecutionPolicy Bypass to run setup.ps1 seamlessly.
echo This is SAFE and only affects this one script execution.
echo.
echo Want to audit the code first?
echo   View online: github.com/screamingearth/the_collective
echo   View local:  notepad setup.ps1
echo.
echo [*] Launching PowerShell installer...
echo.

REM Verify we're in the repository directory
if not exist "%~dp0setup.ps1" (
    echo [*] setup.ps1 not found. Attempting to download from repository...
    powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/screamingearth/the_collective/main/setup.ps1' -OutFile '%~dp0setup.ps1'" 2>nul
    
    if not exist "%~dp0setup.ps1" (
        echo [X] ERROR: Could not find or download setup.ps1
        echo.
        echo The recommended approach is to clone the full repository:
        echo   git clone https://github.com/screamingearth/the_collective.git
        echo   cd the_collective
        echo   setup.bat
        echo.
        echo Alternatively, download the setup files from:
        echo   https://github.com/screamingearth/the_collective
        echo.
        pause
        exit /b 1
    )
    echo [*] setup.ps1 downloaded successfully
)

if not exist "%~dp0.collective" (
    echo [*] .collective directory not found. Attempting to download repository files...
    powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/screamingearth/the_collective/main/.collective/.gitkeep' -OutFile '%~dp0.collective\.gitkeep'" 2>nul
    
    if not exist "%~dp0.collective" (
        echo [X] ERROR: Could not find or download repository files
        echo.
        echo The recommended approach is to clone the full repository:
        echo   git clone https://github.com/screamingearth/the_collective.git
        echo   cd the_collective
        echo   setup.bat
        echo.
        pause
        exit /b 1
    )
)

REM Run PowerShell with execution policy bypass
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0setup.ps1"

REM Check exit code
if %ERRORLEVEL% neq 0 (
    echo.
    echo [!] Setup encountered errors. Check the log at .collective\.logs\setup.log
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [*] Setup complete! See above for next steps.
pause
