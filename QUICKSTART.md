<div id="the_collective">

# >the_collective // quick start

</div>

### requirements

- **VS Code 1.107+** (December 2025) // [download here](https://code.visualstudio.com/) (free, Stable or Insiders)
- **Node.js 20+** // auto-installed by setup script on macOS/Linux, or [download here](https://nodejs.org/)
- **GitHub Copilot** // free plan or subscription with chat access

**Recommended:**
- 4GB+ RAM (for MCP servers + vector embeddings)
- 500MB+ disk space (dependencies + memory database)

### vs code edition comparison

| Feature | Insiders | Stable |
|---------|----------|--------|
| **MCP auto-startup** | ✅ Automatic | ⚠️ Manual (run task once) |
| **Experimental features** | ✅ Yes | ✅ Stable only |
| **Release cycle** | Daily | Monthly |

Both editions work great. Insiders just auto-starts MCP servers on workspace open.

### supported platforms

| Platform | Status | Notes |
|----------|--------|-------|
| **Linux** | ✅ Supported | Ubuntu, Fedora, Debian, Arch, etc. |
| **macOS** | ✅ Supported | Intel and Apple Silicon |
| **Windows** | ✅ Supported | Windows 10/11 |

## first time setup (manual dependencies)
The following instructions guide you through installing dependencies and setting up `>the_collective` manually on your platform.

## 🐧 Linux

**Step 1: Dependencies**

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install -y nodejs npm git
```

**Fedora/RHEL:**
```bash
sudo dnf install -y nodejs npm git
```

**Arch:**
```bash
sudo pacman -S nodejs npm git
```

**Step 2: Clone and setup**
```bash
git clone https://github.com/screamingearth/the_collective.git
cd the_collective
./setup.sh
```

## 🍎 macOS

**Step 1: Install Homebrew** (if not already installed)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**Step 2: Install dependencies**
```bash
brew install node git
```

**Step 3: Clone and setup**
```bash
git clone https://github.com/screamingearth/the_collective.git
cd the_collective
./setup.sh
```

## 🪟 Windows

**Step 1: Install Node.js**
- Download from [nodejs.org](https://nodejs.org/) (LTS version recommended)
- Run the installer, follow prompts (accept defaults)
- Restart your terminal/VS Code after installation

**Step 2: Install Git for Windows**
- Download from [git-scm.com](https://git-scm.com/download/win)
- Run the installer
- **Important:** When prompted, select **"Git Bash"** to include bash (required for setup.sh)
- Complete installation and restart terminal

**Step 3: Clone and setup**

Open Git Bash (or a terminal in VS Code using Bash) and run:
```bash
git clone https://github.com/screamingearth/the_collective.git
cd the_collective
./setup.sh
```

This downloads and extracts the repo automatically, then runs setup.

## what setup.sh does

The setup script handles the rest of the installation:
1. Verifies Node.js and Git are installed
2. Installs npm dependencies
3. Builds MCP servers (memory server + Gemini bridge)
4. Bootstraps core memories
5. Optionally sets up Gemini authentication

**Note:** Node.js and Git Bash must be installed before running `setup.sh`

## troubleshooting

**I don't have Git installed:**

Option 1: Install Git for your platform (see setup instructions above)

Option 2: Use bootstrap with curl (no Git required):
```bash
curl -fsSL https://raw.githubusercontent.com/screamingearth/the_collective/main/setup.sh | bash
```

**I don't have Node.js installed:**

Install Node.js for your platform:
- **macOS:** `brew install node`
- **Linux:** `sudo apt install nodejs npm` (or `dnf`/`pacman` depending on distro)
- **Windows:** Download from [nodejs.org](https://nodejs.org/)

Then rerun `./setup.sh`

**Permission errors (Linux/macOS):**
- Run setup.sh with `sudo`: `sudo bash setup.sh`
- Or use password-less sudo setup (not recommended for security)

**Bash not found (Windows):**
- Reinstall Git for Windows
- Select **"Git Bash"** during installation
- Ensure `C:\Program Files\Git\bin` is in your PATH

**"Database locked" error:**
- Close VS Code completely, then retry

## automatic mcp server startup

When you open the workspace in VS Code for the first time, you might see two prompts:

```
"Start Memory Server" is configured to run when the workspace opens. Allow?
"Start Gemini Bridge" is configured to run when the workspace opens. Allow?
```

**Click "Allow" (or "Trust this folder")** to enable automatic startup. After that:

- Memory server and Gemini Bridge start automatically every time you open the workspace (VS Code Insiders v1.107+ only)
- Both run silently in the background (no terminal windows)
- Copilot has instant access to the memory system and research tools
- Processes stop automatically when you close VS Code

**Why?** Eager-loading the servers eliminates startup latency. When you ask Copilot a question, memory is already available for context retrieval.

### disabling auto-startup

If you prefer lazy-loading (servers start only when Copilot needs them), you can disable this:

1. Open `.vscode/tasks.json`
2. Find and delete these tasks:
   - `"Start Memory Server"`
   - `"Start Gemini Bridge"`
3. Save the file

Restart VS Code and the servers will start on-demand instead.

## verify it works

open the terminal in vs code inside `>the_collective` workspace and run:
```bash
npm run check
```

expected output:

```
✅ All checks passed! Framework is ready.
```
then say,
```
>the_collective:// hey guys, test out your tools and make sure they work
```


## organization-level custom agents

VS Code 1.107+ supports custom agents at the **organization level** in GitHub. If you want to share the agents from this workspace across your GitHub organization:

1. Create a `.github/agents/` directory in your organization's `.github` repository
2. Copy the agent files (`.agent.md`) from this workspace to that directory
3. Set the VS Code setting `github.copilot.chat.customAgents.showOrganizationAndEnterpriseAgents` to `true`
4. Your organization members will see these agents in the Copilot agent dropdown

This makes **Nyx, Prometheus, Cassandra, and Apollo** available to your entire team without manual distribution.

## how to use them

**Use the agent selector** in Copilot chat to choose:
- **>the_collective** // All four agents work together (recommended for most tasks)
- **Nyx** // Strategic decisions and orchestration
- **Prometheus** // Implementation and architecture
- **Cassandra** // Security review and risk analysis
- **Apollo** // Code quality and optimization

**Natural language works:** no syntax needed. Just talk:
- "Cassandra, review this authentication flow"
- "Prometheus, implement JWT login"
- "Apollo, make this database query faster"
- "Explain how the memory system works"
- "Help me debug this race condition"

## choosing your claude model

The agents work best with Claude models. You can select which Claude model to use in your Copilot chat settings:

| Model | Speed | Best For | When to Use |
|-------|-------|----------|------------|
| **Claude Haiku 4.5** | ⚡⚡⚡ Fast (instant) | Quick answers, chat | "I need an answer right now" |
| **Claude Sonnet 4.5** | ⚡⚡ Medium (1-3s) | Most work (default) | Balanced speed + quality, implementation |
| **Claude Opus 4.5** | ⚡ Slow (3-5s) | Deep analysis | Security review, complex architecture, hard problems |

**Quick recommendation:** Start with **Sonnet 4.5**. It's fast enough for real-time chat and smart enough for complex problems. Switch to Haiku if you want instant responses, or Opus if you're doing security analysis or complex architecture.

## memory system

Agents automatically store and retrieve:
- Coding patterns and preferences
- Architectural decisions
- Bugs and fixes
- Project context

Memory uses **semantic vector search** (retriever-reranker pipeline) for intelligent retrieval. Stored locally in `.mcp/collective_memory.duckdb`—never sent to cloud.

For technical details, see [MEMORY_ARCHITECTURE.md](docs/MEMORY_ARCHITECTURE.md).

## enabling gemini tools (optional)

gemini tools provide access to Google's Gemini (gemini-2.5-flash) for independent research and validation from a different AI model.

**what gemini tools add:**
- 128k token context window (substantial analysis capability)
- cognitive diversity (different AI model = different perspective)
- independent validation of team decisions
- research on best practices and alternatives

**to enable gemini tools:**

```bash
cd .collective/gemini-bridge
npm install
npm run auth     # opens browser for google oauth
npm run build
npm test         # verify it works
```

the free tier gives you:
- 60 requests/minute
- 1,000 requests/day
- 128k token context window
- no API key or credit card needed - just your google account

**Using Gemini Tools:**
- Agents automatically invoke Gemini when they need independent validation
- Consultation happens seamlessly behind the scenes
- You only see synthesized results
- Full setup guide: [docs/GEMINI_BRIDGE.md](docs/GEMINI_BRIDGE.md)

## next steps

- **[docs](docs/)** // Technical deep dives (memory, MCP servers, CI/CD)
- **[AGENTS.md](AGENTS.md)** // Team dynamics, interaction patterns, and workflows
- **[CONTRIBUTING.md](CONTRIBUTING.md)** // How to extend the framework

## troubleshooting

### health checks

```bash
npm run check              # full health check
npm run check -- --quick   # fast validation
npm run check -- --memory  # memory system only
```

### logs & diagnostics

All operations are logged to `.collective/.logs/`:
- `setup.log` — setup script output
- `check.log` — health check results

When reporting issues, include relevant logs from `.collective/.logs/`.

### common issues

| Issue | Solution |
|-------|----------|
| **MCP servers not starting** | VS Code Stable: Ctrl+Shift+P → "Run Task" → "Start Memory Server" |
| **Memory not loading** | `cd .collective/memory-server && npm run build && npm run bootstrap` |
| **Database locked** | Close VS Code completely, then retry |
| **Agents not responding** | Run `npm run check`, ensure Copilot subscription active |
| **Build failed** | `npm run clean && ./setup.sh` (or `.\windows.ps1`) |
| **Memory reset needed** | `rm .mcp/collective_memory.duckdb* && npm run bootstrap` |

### windows-specific issues

| Issue | Solution |
|-------|----------|
| **Bash not found** | Reinstall Git for Windows, select "Git Bash" during install |
| **Node.js not found** | Ask Copilot Chat: `Install Node.js 20 or later` |
| **Permission errors** | Run terminal as Administrator |

### advanced troubleshooting

**Reset memory but keep core knowledge:**
```bash
npm run reset:memories -- --keep-core
```

**Rebuild everything from scratch:**
```bash
npm run clean
./setup.sh  # or .\windows.ps1 on Windows
```

For technical deep dives, see [docs/README.md](docs/README.md).

<br><div align="center">
  
built with 🖤 by >the_collective

[⬆ uppies](#the_collective)

</div>