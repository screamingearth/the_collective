# the_collective - quick start

> **🎯 Vision:** enable anyone to harness the power of AI to bring their ideas to life.

## what is this?

the_collective is a team of AI agents that work together inside VS Code. Instead of one AI assistant, you get specialised personalities that debate, research, and build things collaboratively. It's like having a full dev team in your editor.

**No AI expertise required.** If you can install VS Code and type in a chat window, you can use this.

## requirements

- **VS Code 1.107+** (December 2025) — [download here](https://code.visualstudio.com/) (free, Stable or Insiders)
- **Node.js 20+** — auto-installed by the setup script, or [download here](https://nodejs.org/)
- **GitHub Copilot** — free plan or subscription with chat access

## supported platforms

| Platform | Status | Notes |
|----------|--------|-------|
| **Linux** | ✅ Supported | Ubuntu, Fedora, Debian, Arch, etc. |
| **macOS** | ✅ Supported | Intel and Apple Silicon |
| **Windows** | ✅ Supported | Windows 10/11 |

## first time setup

### setup

**macOS / Linux:**
```bash
git clone https://github.com/screamingearth/the_collective.git
cd the_collective
./setup.sh
```

**Windows:**
```batch
curl -L -o setup.bat https://raw.githubusercontent.com/screamingearth/the_collective/main/setup.bat && setup.bat
```

**One-liner (macOS/Linux):**
```bash
curl -fsSL https://raw.githubusercontent.com/screamingearth/the_collective/main/setup.sh | bash
```

Setup automatically:
- Verifies Node.js 20+
- Installs all dependencies
- Builds memory and gemini servers
- Bootstraps core memories
- Configures MCP servers

Then open the folder in VS Code.

**Windows Setup Details:**

The Windows bootstrapper (`setup.bat`) handles:
- **Git auto-install:** Uses Winget to install Git if missing
- **Custom location:** Prompts for installation directory
- **Git Bash handoff:** Launches the universal setup script via Git Bash
- **Node.js detection:** Installs Node.js 22 if outdated/missing

No admin elevation required—everything runs as your current user. Setup time is 5-10 minutes depending on internet speed.

**Troubleshooting Windows:**
- **"Git not found":** Restart Command Prompt after auto-install
- **"Bash not found":** Same—restart to refresh PATH
- **Permission errors:** Try running Command Prompt as Administrator
- **Custom Python paths:** Setup detects `python` (not `python3`) on Windows automatically

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

now open copilot chat and have fun!

## meet the team

**Nyx** — Strategic orchestrator. Sassy, direct, runs the show. Your default interface.

**Prometheus** — The builder. Writes code, designs architecture, makes things work.

**Cassandra** — The validator. Breaks things on purpose, finds edge cases, has veto power on unsafe code.

**Apollo** — The optimizer. Refactors, polishes, ensures quality and performance.

All four personas share one language model but have specialized roles. They debate your requests, challenge each other's ideas, and converge on optimal solutions.

**Gemini Tools** (optional) — Independent validation from Google's Gemini (different AI model). Agents automatically invoke these for research, code review, and second opinions. See [enabling gemini tools](#enabling-gemini-tools-optional).

### organization-level custom agents

VS Code 1.107+ supports custom agents at the **organization level** in GitHub. If you want to share the agents from this workspace across your GitHub organization:

1. Create a `.github/agents/` directory in your organization's `.github` repository
2. Copy the agent files (`.agent.md`) from this workspace to that directory
3. Set the VS Code setting `github.copilot.chat.customAgents.showOrganizationAndEnterpriseAgents` to `true`
4. Your organization members will see these agents in the Copilot agent dropdown

This makes **Nyx, Prometheus, Cassandra, and Apollo** available to your entire team without manual distribution.

## how to use them

**Use the agent selector** in Copilot chat to choose:
- **the_collective** — All four agents work together (recommended for most tasks)
- **Nyx** — Strategic decisions and orchestration
- **Prometheus** — Implementation and architecture
- **Cassandra** — Security review and risk analysis
- **Apollo** — Code quality and optimization

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

## quality workflow

Every feature passes through all four agents:

1. **Nyx** validates intent and strategy
2. **Cassandra** identifies risks and failure modes
3. **Prometheus** implements the solution
4. **Cassandra** security-validates the code
5. **Apollo** certifies quality and performance

## example workflows

**Building features:** "Build a login system" → Nyx orchestrates → Prometheus implements → Cassandra breaks it → Apollo polishes

**Debugging:** "This query is slow" → Cassandra finds the issue → Prometheus fixes it → Apollo optimizes

**Code review:** "Review this" → Cassandra analyzes for security and correctness

**Optimization:** "Make this faster" → Apollo refactors for performance

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

## key files

```
.github/copilot-instructions.md    ← Framework configuration
AGENTS.md                          ← Team workflows and protocols
.collective/memory-server/         ← Vector memory (DuckDB + semantic search)
.collective/gemini-bridge/         ← Gemini research tools (optional MCP server)
.vscode/mcp.json                   ← MCP server configuration
.vscode/settings.json              ← VS Code settings (v1.107)
.vscode/tasks.json                 ← Build and test tasks
docs/                              ← Technical documentation
```

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

- **[AGENTS.md](AGENTS.md)** — Team dynamics, interaction patterns, and workflows
- **[docs/](docs/)** — Technical deep dives (memory, MCP servers, CI/CD)
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — How to extend the framework

## philosophy

**Personality is permanent** — Agents never drop character, even under pressure. Sass and strategic thinking coexist.

**Friction creates quality** — Agents challenge each other. Prometheus and Cassandra debates prevent bad code from shipping.

**Actually learns** — Memory system makes conversations context-aware. Feels less like an API, more like a team.

**Zero lock-in** — Runs entirely locally in VS Code. Apache 2.0 licensed. Your data never leaves your machine.
