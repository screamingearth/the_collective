<div id="the_collective">

# >the_collective // quick start

</div>

## 📋 System Requirements

Before you begin, ensure you have:
- **VS Code 1.107+** (December 2025) // [Download](https://code.visualstudio.com/)
- **GitHub Copilot** // Subscription with Chat access
- **Node.js v20 or v22 (LTS)** // [Download](https://nodejs.org/) (Avoid v23, v25)
- **Python 3.10+** // Required for native modules (Windows)
- **Disk Space:** ~2GB (dependencies + vector database + ML models)
- **RAM:** 4GB+ recommended

---

## 🚀 One-Line Install (Recommended)

**What it does:** Installs Git, Node.js, and Python (if missing), clones the repo, and builds the memory server.

### 🍎 macOS / Linux / WSL
```bash
curl -fsSL https://raw.githubusercontent.com/screamingearth/the_collective/main/bootstrapper_unix.sh | bash
```

### 🪟 Windows (PowerShell)
```powershell
iwr -useb https://raw.githubusercontent.com/screamingearth/the_collective/main/bootstrapper_win.ps1 | iex
```

**After installation:** Restart VS Code, select **Open Folder...**, and navigate to `Documents/the_collective`. 

> **CRITICAL:** You must open the **root** `the_collective` folder. This is required for VS Code to load the MCP servers from `.vscode/mcp.json` and for Copilot to find the agent instructions in `.github/`.

Once opened, say "hey nyx" in Copilot Chat.

> **Note:** The first conversation will download ~400MB of ML models for embeddings. This is normal and only happens once.
> **Windows Users:** The bootstrapper will attempt to install **Visual Studio C++ Build Tools** if missing. This takes ~5-15 minutes and is required for the local memory database.

---

## 🔧 Troubleshooting & Fallbacks

If the bootstrapper fails due to firewall issues or a minimal environment, use these methods.

### 1. Manual Clone (Safe Mode)
If you already have Git installed:

```bash
# Linux/Mac
# Clones to your Documents folder
mkdir -p ~/Documents
git clone https://github.com/screamingearth/the_collective.git ~/Documents/the_collective
cd ~/Documents/the_collective
./bootstrapper_unix.sh

# Windows (PowerShell)
# Clones to your Documents folder
$dest = Join-Path ([Environment]::GetFolderPath('MyDocuments')) "the_collective"
git clone https://github.com/screamingearth/the_collective.git $dest
cd $dest
.\bootstrapper_win.ps1
```

### 2. Python Fallback (No Git/Curl)
If you have Python installed but no Git/Curl:

```bash
python3 - <<'PY'
import urllib.request, os
url='https://raw.githubusercontent.com/screamingearth/the_collective/main/bootstrapper_unix.sh'
open('install.sh','w').write(urllib.request.urlopen(url).read().decode())
print('Saved install.sh — run: bash install.sh')
PY
```

### 3. "Nothing Works" (Manual Dependencies)
If the scripts fail entirely, follow these steps manually:

**Linux / macOS:**
1. Install Node.js & Git:
   ```bash
   # Ubuntu/Debian
   sudo apt update && sudo apt install -y nodejs npm git build-essential
   # macOS
   brew install node git
   xcode-select --install
   ```
2. Run setup:
   ```bash
   mkdir -p ~/Documents
   git clone https://github.com/screamingearth/the_collective.git ~/Documents/the_collective
   cd ~/Documents/the_collective
   chmod +x setup.sh
   ./setup.sh
   ```

**Windows:**
1. Install [Node.js](https://nodejs.org/) (LTS).
2. Install [Git for Windows](https://git-scm.com/download/win) (Select "Git Bash" during install).
3. Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022) (Select "Desktop development with C++").
4. Open Git Bash:
   ```bash
   # Navigate to Documents
   cd ~/Documents
   git clone https://github.com/screamingearth/the_collective.git
   cd the_collective
   ./setup.sh
   ```

### 4. Troubleshooting MCP Servers
If the agents seem to be missing their tools (Memory, GitHub, Gemini), the MCP servers might not have started correctly:

1. Open the **Extensions** window in the sidebar (or press `Ctrl+Shift+X`).
2. Look for the **"MCP Servers - Installed"** section.
3. Click the **cog icon** next to each server (memory, gemini, filesystem).
4. Verify the status is "Running". If not, click **Start** to launch them manually.
5. You can also run the command `MCP: List Servers` from the Command Palette (`Ctrl+Shift+P`) to see a detailed status.

## ⚙️ Configuration

### Automatic MCP Server Startup
When you open the workspace, VS Code will ask to run tasks:
1. **"Start Memory Server"**
2. **"Start Gemini Bridge"**

**Click "Allow" (or "Trust this folder").**
*   **Why?** This "eager loads" the memory system so Copilot has context immediately when you start chatting.
*   **First time?** The memory server will bootstrap 34 core memories automatically. This takes ~10-30 seconds and downloads ~400-500MB of ML models (one time only).
*   **Disable it:** Delete the tasks from `.vscode/tasks.json` if you prefer manual startup.

### Gemini Tools (Optional)
To enable Google's Gemini model for independent research:

```bash
cd .collective/gemini-bridge
npm install
npm run auth     # Opens browser for Google OAuth
npm run build
```
See [docs/GEMINI_BRIDGE.md](docs/GEMINI_BRIDGE.md) for details.

---

## 🛠️ Advanced Maintenance

### Health Checks
Run these commands in the VS Code terminal to verify status:
```bash
npm run check              # Full system diagnostic
npm run check -- --quick   # Fast validation
```

### Common Fixes

| Issue | Solution |
|-------|----------|
| **MCP Servers Not Loading** | Go to the **Extensions** window (`Ctrl+Shift+X`), click the **cog icon** on each MCP server under "MCP Servers - Installed". Ensure they are running; start them manually if not. |
| **Database Locked (EBUSY)** | Close all VS Code windows, run `taskkill /F /IM node.exe` (Win), wait 5s, reopen. |
| **Python Not Found** | Run `winget install Python.Python.3` (Win) or `brew install python3` (Mac). |
| **Node Version Error** | Use Node v22 (LTS). Avoid v23/v25 for native module stability. |
| **Bash Not Found (Win)** | Reinstall Git, ensure "Git Bash" is selected. |
| **Build Failed** | Run `npm run clean`, then `./setup.sh`. |
| **Reset Memory** | `npm run reset:memories -- --keep-core` |

**See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for the complete troubleshooting guide.**

### Logs
If you need to report a bug, check `.collective/.logs/`:
- `setup.log` — Installation details
- `check.log` — Health check failures

<br><div align="center">
  
built with 🖤 by >the_collective

[⬆ uppies](#the_collective)

</div>