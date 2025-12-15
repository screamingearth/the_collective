@echo off
setlocal EnableDelayedExpansion
title The Collective - Installer

echo ========================================================
echo        THE COLLECTIVE - INITIALIZING SETUP
echo ========================================================
echo.

:: ----------------------------------------------------------
:: 1. CHECK FOR GIT (AND INSTALL IF MISSING)
:: ----------------------------------------------------------
echo [*] Checking system requirements...
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Git is not installed.
    echo [*] Attempting auto-install via Winget (Windows Package Manager)...
    
    :: Install Git silently
    winget install --id Git.Git -e --source winget --silent --accept-package-agreements --accept-source-agreements
    
    if %errorlevel% neq 0 (
        echo [X] Auto-install failed. Please install Git manually and restart this script.
        echo     Download: https://git-scm.com/download/win
        pause
        exit /b
    )
    
    echo [*] Git installed successfully!
    echo [*] Refreshing environment path...
    
    :: Manually add Git to PATH for this session only
    set "PATH=%PATH%;C:\Program Files\Git\cmd;C:\Program Files\Git\bin"
    
    :: Configure Git for Windows (handle CRLF line endings)
    git config --global core.autocrlf true
) else (
    echo [*] Git is already installed.
)

echo.
echo ========================================================
echo.

:: ----------------------------------------------------------
:: 2. CHOOSE INSTALL LOCATION
:: ----------------------------------------------------------
set "DEFAULT_DIR=%USERPROFILE%\the_collective"
echo Where would you like to install The Collective?
echo (Press ENTER to use default: %DEFAULT_DIR%)
set /p INST_DIR="> "

:: Use default if user just hit enter
if "%INST_DIR%"=="" set "INST_DIR=%DEFAULT_DIR%"

:: Create directory if it doesn't exist
if not exist "%INST_DIR%" (
    mkdir "%INST_DIR%" 2>nul
    if %errorlevel% neq 0 (
        echo [X] Failed to create directory: %INST_DIR%
        echo     Check permissions or choose a different location.
        pause
        exit /b
    )
)

:: ----------------------------------------------------------
:: 3. CLONE OR UPDATE REPOSITORY
:: ----------------------------------------------------------
cd /d "%INST_DIR%"

if exist ".git" (
    echo [*] Updating existing installation...
    git pull
    if %errorlevel% neq 0 (
        echo [!] Warning: Git pull failed. Continuing with existing files...
    )
) else (
    echo [*] Downloading The Collective...
    git clone https://github.com/screamingearth/the_collective.git .
    if %errorlevel% neq 0 (
        echo [X] Failed to clone repository. Check your internet connection.
        pause
        exit /b
    )
)

:: ----------------------------------------------------------
:: 4. HANDOFF TO BASH SETUP SCRIPT
:: ----------------------------------------------------------
echo.
echo ========================================================
echo [*] Handing off to main installer...
echo ========================================================

:: Attempt to locate bash.exe
if exist "C:\Program Files\Git\bin\bash.exe" (
    set "BASH_PATH=C:\Program Files\Git\bin\bash.exe"
) else (
    :: Fallback: Try to find bash in system PATH
    for %%X in (bash.exe) do (set "BASH_PATH=%%~$PATH:X")
)

if not defined BASH_PATH (
    echo [!] Critical Error: Could not locate Bash. 
    echo     Please restart your terminal to finalize the Git installation.
    pause
    exit /b
)

:: Execute setup.sh using Git Bash
:: --login ensures profile loading, -i makes it interactive
"%BASH_PATH%" --login -i -c "./setup.sh"

if %errorlevel% neq 0 (
    echo.
    echo [!] Setup encountered errors. Check the log at .collective/.logs/setup.log
    pause
    exit /b %errorlevel%
)

echo.
echo ========================================================
echo [*] Setup complete! Restart VS Code and say "hey nyx"
echo ========================================================
pause
