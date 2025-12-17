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
echo   View local:  notepad setup.ps1 (after download)
echo.
echo [*] Launching PowerShell installer...
echo.

REM Check if setup.ps1 exists, download if missing
if not exist "%~dp0setup.ps1" (
    echo [*] setup.ps1 not found, downloading...
    powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/screamingearth/the_collective/main/setup.ps1' -OutFile 'setup.ps1'"
    if %ERRORLEVEL% neq 0 (
        echo [X] Failed to download setup.ps1
        echo.
        echo Please download manually from:
        echo https://github.com/screamingearth/the_collective
        echo.
        pause
        exit /b 1
    )
    echo [*] setup.ps1 downloaded successfully
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
