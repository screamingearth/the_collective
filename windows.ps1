# >the_collective - Windows Setup Script
# Minimal setup assuming dependencies are pre-installed via Copilot
# Copyright © screamingearth. Licensed under Apache 2.0.

param(
    [switch]$SkipGemini
)

$ErrorActionPreference = "Stop"
$SCRIPT_ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

# Color output functions
function Write-Success { param([string]$Message) Write-Host "✓ $Message" -ForegroundColor Green }
function Write-Error { param([string]$Message) Write-Host "✗ $Message" -ForegroundColor Red }
function Write-Info { param([string]$Message) Write-Host "→ $Message" -ForegroundColor Cyan }
function Write-Warning { param([string]$Message) Write-Host "⚠ $Message" -ForegroundColor Yellow }

Write-Host ""
Write-Host ">the_collective - Windows Setup" -ForegroundColor Magenta
Write-Host "================================" -ForegroundColor Magenta
Write-Host ""

# Check Node.js
Write-Info "Checking Node.js..."
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js not found"
    Write-Host ""
    Write-Host "Please install Node.js using GitHub Copilot Chat:" -ForegroundColor Yellow
    Write-Host "  1. Open Copilot Chat (Ctrl+Shift+I)" -ForegroundColor White
    Write-Host "  2. Ask: " -NoNewline -ForegroundColor White
    Write-Host "Install Node.js 20 or later" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}
$nodeVersion = node --version
Write-Success "Node.js $nodeVersion found"

# Check Git
Write-Info "Checking Git..."
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "Git not found"
    Write-Host ""
    Write-Host "Please install Git using GitHub Copilot Chat:" -ForegroundColor Yellow
    Write-Host "  1. Open Copilot Chat (Ctrl+Shift+I)" -ForegroundColor White
    Write-Host "  2. Ask: " -NoNewline -ForegroundColor White
    Write-Host "Install Git for Windows" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Note: Git for Windows includes Git Bash" -ForegroundColor DarkGray
    Write-Host ""
    exit 1
}
$gitVersion = git --version
Write-Success "$gitVersion found"

# Check bash (included with Git for Windows)
Write-Info "Checking bash..."
if (!(Get-Command bash -ErrorAction SilentlyContinue)) {
    Write-Error "Bash not found"
    Write-Host ""
    Write-Host "Git for Windows should include Git Bash." -ForegroundColor Yellow
    Write-Host "Please ensure " -NoNewline -ForegroundColor Yellow
    Write-Host "C:\Program Files\Git\bin" -NoNewline -ForegroundColor Cyan
    Write-Host " is in your PATH" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or reinstall Git for Windows and ensure Git Bash is selected during installation." -ForegroundColor DarkGray
    Write-Host ""
    exit 1
}
Write-Success "Bash found"

Write-Host ""
Write-Host "Dependencies Verified" -ForegroundColor Green
Write-Host ""

# Install npm dependencies
Write-Info "Installing npm dependencies..."
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Error "npm install failed"
    exit 1
}
Write-Success "Dependencies installed"

# Build MCP servers
Write-Info "Building MCP servers..."
Push-Location "$SCRIPT_ROOT\.collective\memory-server"
npm run build
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Error "Memory server build failed"
    exit 1
}
Pop-Location

Push-Location "$SCRIPT_ROOT\.collective\gemini-bridge"
npm run build
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Error "Gemini bridge build failed"
    exit 1
}
Pop-Location
Write-Success "MCP servers built"

# Bootstrap memories
Write-Info "Bootstrapping memory system..."
Push-Location "$SCRIPT_ROOT\.collective\memory-server"
npm run bootstrap
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Error "Memory bootstrap failed"
    exit 1
}
Pop-Location
Write-Success "Memory system bootstrapped"

# Gemini setup (optional)
if (!$SkipGemini) {
    Write-Host ""
    Write-Host "Optional: Gemini Integration" -ForegroundColor Cyan
    Write-Host "Enable cognitive diversity via Google Gemini (different AI model)" -ForegroundColor DarkGray
    Write-Host ""
    $setupGemini = Read-Host "Set up Gemini integration? (Y/n)"
    
    if ($setupGemini -eq "" -or $setupGemini -match "^[Yy]") {
        Write-Info "Starting Gemini OAuth flow..."
        Write-Info "If the browser does not open automatically, visit the URL shown in the terminal"
        Push-Location "$SCRIPT_ROOT\.collective\gemini-bridge"
        npm run auth
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Gemini authentication complete"
        } else {
            Write-Warning "Gemini auth failed or was cancelled"
        }
        Pop-Location
    } else {
        Write-Info "Skipping Gemini setup (you can run 'cd .collective\gemini-bridge && npm run auth' later)"
    }
}

Write-Host ""
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Reload VS Code to activate MCP servers" -ForegroundColor White
Write-Host "  2. Open Copilot Chat and say: " -NoNewline -ForegroundColor White
Write-Host "hey nyx" -ForegroundColor Magenta
Write-Host ""
Write-Host "Documentation: " -NoNewline -ForegroundColor White
Write-Host "README.md, QUICKSTART.md" -ForegroundColor Cyan
Write-Host ""
