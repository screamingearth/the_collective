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

## first time setup

### setup

#### 🪟 Windows

**Step 1: Install dependencies**

Open VS Code and use Copilot Chat to install dependencies:

1. Open Copilot Chat (`Ctrl+Shift+I` or click the chat icon)
2. Ask: `Install Node.js 20 or later, Git for Windows, and ensure VS Code is in PATH`
3. Follow Copilot's installation guidance
4. Ask copilot "install screamingearth/the_collective"

**Step 2: Clone and setup**

Open a terminal in VS Code (`Ctrl+`` `) and run:

```powershell
git clone https://github.com/screamingearth/the_collective.git
cd the_collective
.\windows.ps1
```

The setup script will:
- Verify dependencies are installed
- Install npm packages
- Build MCP servers (memory + Gemini bridge)
- Bootstrap the memory system
- Optionally configure Gemini integration

**Troubleshooting:**
- **Bash not found:** Reinstall Git for Windows and ensure Git Bash is selected during installation
- **Node.js not found:** Use Copilot Chat to install Node.js, then rerun setup
- **Permission errors:** Run terminal as Administrator

#### 🍎 macOS / Linux
```bash
git clone https://github.com/screamingearth/the_collective.git
cd the_collective
./setup.sh
```

**Note:** If Git isn't installed, the setup script will offer to install it automatically:
- **macOS:** Uses Homebrew (installs automatically if you confirm)
- **Linux:** Uses apt/dnf/pacman (installs automatically if you confirm)

Then open the folder in VS Code and you're ready to go.

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