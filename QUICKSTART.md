<div id="the_collective">

# >the_collective // quick start

</div>

### requirements

- **VS Code 1.107+** (December 2025) // [download here](https://code.visualstudio.com/) (free, Stable or Insiders)
- **Node.js 20+** // auto-installed by the setup script, or [download here](https://nodejs.org/)
- **GitHub Copilot** // free plan or subscription with chat access

### supported platforms

| Platform | Status | Notes |
|----------|--------|-------|
| **Linux** | ✅ Supported | Ubuntu, Fedora, Debian, Arch, etc. |
| **macOS** | ✅ Supported | Intel and Apple Silicon |
| **Windows** | ✅ Supported | Windows 10/11 (native PowerShell, no dependencies) |

## first time setup

### setup

**macOS / Linux:**
```bash
git clone https://github.com/screamingearth/the_collective.git
cd the_collective
./setup.sh
```

**Windows (Recommended):**
```powershell
git clone https://github.com/screamingearth/the_collective.git
cd the_collective
.\setup.bat       # Double-click works too!
```

**Windows (Manual - requires Git Bash or WSL):**
```bash
git clone https://github.com/screamingearth/the_collective.git
cd the_collective
./setup.sh
```

Setup automatically:
- Verifies Node.js 20+
- Installs all dependencies
- Builds memory and gemini servers
- Bootstraps core memories
- Configures MCP servers

Then open the folder in VS Code.

**Note:** The recommended setup.bat launcher requires no dependencies and handles everything automatically. Advanced users can use setup.ps1 directly or run setup.sh via Git Bash/WSL.

**macOS / Linux:** `setup.sh` will prompt to install Git automatically using the system package manager if Git is not found (you must confirm before any changes). This is optional — you can install Git manually and re-run the script.

**🔒 Security & Trust:**
- **Session-only:** ExecutionPolicy -Bypass - Only affects the current PowerShell session, doesn't change system settings
- **No admin required:** Runs with your normal user permissions
- **Antivirus still active:** Windows Defender and other security software remain fully functional
- **Open source:** Both setup.bat and setup.ps1 are readable before you run them

**Note for macOS / Linux:** If `git` is not found, `setup.sh` will offer to install Git using your package manager (apt/dnf/pacman/brew). You must confirm before any changes are made. If you prefer, install Git manually and re-run the script.


**Common Issues:**
- **"setup.bat not recognized":** You're in PowerShell—use `.\setup.bat` (with `.\` prefix)
- **"execution policy" error:** Use setup.bat launcher (session-only bypass) OR run `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`
- **"Failed to download setup.ps1":** Check internet connection. Alternatively, clone the full repo instead of using one-liner
- **Permission errors:** Try running terminal as Administrator
- **Node install fails:** Manually install from https://nodejs.org/ and rerun setup

## automatic mcp server startup

When you open the workspace in VS Code for the first time, you'll see two prompts:

```
"Start Memory Server" is configured to run when the workspace opens. Allow?
"Start Gemini Bridge" is configured to run when the workspace opens. Allow?
```

**Click "Allow" (or "Trust this folder")** to enable automatic startup. After that:

- Memory server and Gemini Bridge start automatically every time you open the workspace
- Both run silently in the background (no terminal windows)
- Copilot has instant access to your memory system and research tools
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

```bash
npm run check
```

expected output:

```
✅ All checks passed! Framework is ready.
```

open copilot chat and have fun!

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

**Something not working?**
```bash
npm run check
```

**Memory issues:**
```bash
npm run check -- --memory
```

**Reset memory (but keep core knowledge):**
```bash
npm run reset:memories -- --keep-core
```

**"Database locked" error:**
Normal when VS Code is open. Close VS Code first, then retry.

**Build failed?**
```bash
npm run clean
./setup.sh
```

For detailed troubleshooting, see [docs/README.md](docs/README.md#troubleshooting).

<br><div align="center">
  
built with 🖤 by >the_collective

[⬆ uppies](#the_collective)

</div>