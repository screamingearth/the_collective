# Troubleshooting Guide

Common issues and solutions when installing or running >the_collective.

## Installation Issues

### Windows

#### "winget not found"

**Cause:** Windows Package Manager (winget) is not installed or not in PATH.

**Solutions:**

1. **Install from Microsoft Store:**
   - Open Microsoft Store
   - Search for "App Installer"
   - Click Install or Update

2. **Direct download:**
   - Visit [aka.ms/getwinget](https://aka.ms/getwinget)
   - Download and run the installer

3. **Alternative - Manual Git install:**
   - Download from [git-scm.com](https://git-scm.com/download/win)
   - Run the installer with default options
   - Restart your terminal

#### "Git Bash not found in PATH"

**Cause:** Git was installed but the shell isn't accessible from PowerShell.

**Solutions:**

1. **Restart your terminal completely** (close and reopen)

2. **Use Git Bash directly:**
   ```bash
   # Open Git Bash from Start menu, then:
   cd ~/Documents/the_collective
   ./setup.sh
   ```

3. **Run bash with full path:**
   ```powershell
   & "C:\Program Files\Git\bin\bash.exe" .\setup.sh
   ```

#### Native module compilation fails

**Cause:** Visual Studio Build Tools are not installed or misconfigured.

**Solutions:**

1. **Run the bootstrapper again:** The `bootstrapper_win.ps1` script now attempts to install these automatically using `winget`.

2. **Manual Install:**
   - Download from [Visual Studio Downloads](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
   - Run installer
   - Select "Desktop development with C++" workload
   - Restart terminal and retry

3. **Check for errors in setup.log:**
   ```bash
   cat .collective/.logs/setup.log
   ```

### macOS

#### "Xcode Command Line Tools not installed"

**Cause:** macOS requires Xcode CLT for compiling native modules.

**Solution:**

```bash
xcode-select --install
```

A dialog will appear. Click "Install" and wait for completion.

#### Homebrew permission errors

**Cause:** Homebrew directory permissions issue.

**Solution:**

```bash
sudo chown -R $(whoami) /opt/homebrew  # Apple Silicon
sudo chown -R $(whoami) /usr/local     # Intel Macs
```

### Linux

#### "g++/gcc not found"

**Cause:** Build tools are not installed.

**Solutions by distribution:**

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y build-essential python3

# Fedora/RHEL
sudo dnf groupinstall -y "Development Tools"
sudo dnf install -y python3

# Arch Linux
sudo pacman -S --noconfirm base-devel python
```

#### "Cannot reach npm registry"

**Cause:** Network connectivity issue or firewall blocking.

**Solutions:**

1. **Check connectivity:**
   ```bash
   curl -s https://registry.npmjs.org/-/ping
   ```

2. **Corporate proxy:** Configure npm:
   ```bash
   npm config set proxy $HTTP_PROXY
   npm config set https-proxy $HTTPS_PROXY
   ```

3. **DNS issues:** Try Google DNS:
   ```bash
   echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf
   ```

### WSL2 (Windows Subsystem for Linux)

#### Very slow npm install

**Cause:** Running from Windows filesystem (`/mnt/c/...`).

**Solution:** Keep the project on the Linux filesystem:

```bash
# Instead of /mnt/c/Users/...
cd ~
git clone https://github.com/screamingearth/the_collective.git
cd the_collective
./setup.sh
```

## Runtime Issues

### Memory server won't start

**Symptoms:** "Cannot find module" or "duckdb failed to load"

**Solutions:**

1. **Rebuild native modules:**
   ```bash
   cd .collective/memory-server
   npm rebuild --build-from-source
   ```

2. **Clean reinstall:**
   ```bash
   npm run clean
   ./setup.sh
   ```

3. **Check database file:**
   ```bash
   ls -la .mcp/collective_memory.duckdb
   # If corrupt, delete and restart:
   rm .mcp/collective_memory.duckdb*
   cd .collective/memory-server && npm run bootstrap
   ```

### "First conversation takes forever"

**Cause:** ML models are downloading on first use (~400-500MB).

**Solution:** This is normal! The first time you use the memory system, it downloads embedding models from Hugging Face. This only happens once.

You can verify progress by watching the VS Code task output for "Start Memory Server".

### Gemini tools not working

**Symptoms:** Gemini-related tool calls fail or timeout.

**Solutions:**

1. **Check authentication:**
   ```bash
   cd .collective/gemini-bridge
   npm run auth
   ```

2. **Verify auth status:**
   ```bash
   npm run status
   ```

3. **Re-authenticate:**
   - A browser window will open
   - Sign in with your Google account
   - Grant permissions

### VS Code doesn't recognize MCP servers

**Symptoms:** Tool calls to memory/GitHub fail, MCP errors in output, or agents seem "dumb" (missing personas).

**Solutions:**

1. **CRITICAL: Open the Root Folder:** Ensure you have opened the `the_collective` **root** folder in VS Code (File → Open Folder...). 
   - If you open a subfolder (like `.collective/memory-server`), VS Code will **not** load `.vscode/mcp.json` or `.github/copilot-instructions.md`.

2. **Restart VS Code** (the MCP servers need a restart to load)

3. **Check MCP configuration:**
   ```bash
   cat .vscode/mcp.json
   ```

4. **Verify servers are running:**
   - Open View → Terminal
   - Check "Tasks" output panels for Memory Server and Gemini Bridge

5. **Start servers manually:**
   ```bash
   npm run check  # This shows server status
   ```

## Diagnostic Commands

```bash
# Full health check
npm run check

# Quick health check
npm run check -- --quick

# Validate code quality
npm run validate

# Reset everything
npm run clean
./setup.sh

# View logs
cat .collective/.logs/setup.log
```

## Still stuck?

1. **Check existing issues:** [GitHub Issues](https://github.com/screamingearth/the_collective/issues)

2. **Open a new issue** with:
   - Your operating system and version
   - Node.js version (`node --version`)
   - The full error message
   - Contents of `.collective/.logs/setup.log`

3. **Community help:** Tag your issue with `question` label
