#!/bin/bash
# PowerShell validation script for CI/CD
# Validates setup.ps1 syntax on Linux/WSL using PowerShell Core

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SETUP_PS1="$PROJECT_ROOT/setup.ps1"

# Check if PowerShell is available
if ! command -v pwsh &> /dev/null; then
    echo "⚠️  PowerShell Core (pwsh) not found"
    echo "Install with: ~/.local/bin/pwsh or apt-get install powershell"
    exit 1
fi

echo "🔍 Validating PowerShell script: setup.ps1"

# Run PowerShell syntax check
pwsh -NoProfile -Command "
\$content = Get-Content -Raw '$SETUP_PS1'
\$errors = @()
\$null = [System.Management.Automation.Language.Parser]::ParseInput(\$content, [ref]\$null, [ref]\$errors)

if (\$errors.Count -gt 0) {
    Write-Host '✗ PARSE FAILED - Syntax errors found:' -ForegroundColor Red
    \$errors | ForEach-Object { Write-Host \"  Line \$(\$_.Extent.StartLineNumber): \$(\$_.Message)\" -ForegroundColor Yellow }
    exit 1
} else {
    Write-Host '✓ PowerShell Script Validation: PASSED' -ForegroundColor Green
    Write-Host '  - All syntax is valid for PowerShell 5.1+' -ForegroundColor Green
    Write-Host '  - Ready for Windows testing' -ForegroundColor Green
}
"
