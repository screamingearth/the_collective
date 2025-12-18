<div id="the_collective">

# >the_collective // quick start

</div>

## 📋 System Requirements

Before you begin, ensure you have:
- **VS Code 1.107+** (December 2025) // [Download](https://code.visualstudio.com/)
- **GitHub Copilot** // Subscription with Chat access
- **Disk Space:** ~2GB (dependencies + vector database + ML models)
- **RAM:** 4GB+ recommended

---

## 🚀 One-Line Install (Recommended)

**What it does:** Installs Git, Node.js, and Python (if missing), clones the repo, and builds the memory server.

### 🍎 macOS / Linux / WSL
```bash
sh -c 'U="https://raw.githubusercontent.com/screamingearth/the_collective/main/bootstrapper_unix.sh"; (command -v curl >/dev/null && curl -fsSL "$U" || command -v wget >/dev/null && wget -qO- "$U" || python3 -c "import sys,urllib.request;sys.stdout.buffer.write(urllib.request.urlopen(\'$U\').read())") | bash'
```

### 🪟 Windows (PowerShell)
```powershell
iwr -useb https://raw.githubusercontent.com/screamingearth/the_collective/main/bootstrapper_win.ps1 | iex
```

**After installation:** Restart VS Code, open the `the_collective` folder, and say "hey nyx" in Copilot Chat.

> **Note:** The first conversation will download ~400MB of ML models for embeddings. This is normal and only happens once.

---

## 🔧 Troubleshooting & Fallbacks

If the bootstrapper fails due to firewall issues or a minimal environment, use these methods.

### 1. Manual Clone (Safe Mode)
If you already have Git installed:

```bash
git clone https://github.com/screamingearth/the_collective.git ~/the_collective
cd ~/the_collective

# Linux/Mac
./bootstrapper_unix.sh

# Windows (PowerShell)
.\bootstrapper_win.ps1
```

### 2. Python Fallback (No Git/Curl)
If you have Python installed but no Git/Curl:

```bash
python3 - <<'PY'
import urllib.request
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
   sudo apt update && sudo apt install -y nodejs npm git
   # macOS
   brew install node git
   ```
2. Run setup:
   ```bash
   git clone https://github.com/screamingearth/the_collective.git
   cd the_collective
   chmod +x setup.sh
   ./setup.sh
   ```

**Windows:**
1. Install [Node.js](https://nodejs.org/) (LTS).
2. Install [Git for Windows](https://git-scm.com/download/win) (Select "Git Bash" during install).
3. Open Git Bash:
   ```bash
   git clone https://github.com/screamingearth/the_collective.git
   cd the_collective
   ./setup.sh
   ```

---

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
| **Database Locked** | Close all VS Code windows, wait 5s, reopen. |
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