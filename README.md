<div align="center" id="the_collective">

![the_collective banner](.collective/.assets/the_collective-banner.png)

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![VS Code: 1.107+](https://img.shields.io/badge/VS%20Code-1.107%2B-007ACC?logo=visual-studio-code)](https://code.visualstudio.com/)
[![Node.js: 20+](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js)](https://nodejs.org/)
[![TypeScript: 5.7+](https://img.shields.io/badge/TypeScript-5.7%2B-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![MCP: 2025-11-25](https://img.shields.io/badge/MCP-2025--11--25-FF6B6B)](https://modelcontextprotocol.io/)
  
<h3>vision:// enable humans to harness the power of AI and bring their ideas to life</h3>

</div><br>

## ⚡ quick start

### one-liner (recommended)

**macOS / Linux / Windows (Git Bash or WSL)**
```bash
curl -fsSL https://raw.githubusercontent.com/screamingearth/the_collective/main/setup.sh | bash
```

### install into existing project

run from your project directory:
```bash
curl -fsSL https://raw.githubusercontent.com/screamingearth/the_collective/main/setup.sh | bash
```

the script detects existing files and offers three options:
- **backup** — saves your files to `.collective/backups/` before installing
- **merge** — intelligently merges configs (package.json, .gitignore, mcp.json)
- **overwrite** — replaces conflicting files (use with caution)

### manual install

```bash
git clone https://github.com/screamingearth/the_collective.git
cd the_collective
./setup.sh
```

restart VS Code after setup. open copilot chat, say `hey nyx`.

```bash
npm run check  # verify installation
```
<br>

## 🤖 the team

| agent | role | specialty | vibe |
|-------|------|-----------|------|
| **nyx** | orchestrator | strategy & synthesis | witty, direct, runs the show |
| **prometheus** | builder | implementation & architecture | methodical, technical |
| **cassandra** | breaker | security & risk analysis | skeptical, thorough |
| **apollo** | polisher | optimization & quality | perfectionist, elegant |

**the_collective is best utilized by Claude models:**
> Haiku 4.5 (fast)
> 
> Sonnet 4.5 (default)
> 
> Opus 4.5 (deep reasoning)

<br>

## 🧠 how it works

**memory system** // Local vector database (DuckDB + semantic embeddings) with retriever-reranker pipeline. your preferences, decisions, architectural choices, and project context persist across sessions. encrypted locally, never sent to cloud.

**agents** // One language model, four specialized personas. address them directly in chat (`cassandra, review this`) or use team mode to watch them collaborate in real-time.

**team mode** // Switch to `the_collective` in Copilot chat. watch Nyx orchestrate while Prometheus builds, Cassandra breaks things, and Apollo polishes. friction creates quality.

<br>

## 🚀 features

- **local-first memory** // semantic vector database never leaves your machine
- **4-agent team** // specialized personas that debate your code in real-time
- **MCP servers** // memory, gemini research tools, filesystem access (extensible)
- **auto-startup** // MCP servers launch on workspace open (VS Code 1.107+)
- **org-level agents** // share agents across GitHub organizations
- **zero tracking** // Apache 2.0 licensed, no telemetry, no vendor lock-in

<br>

## 🔧 commands

| command | purpose |
|---------|---------|
| `./setup.sh` | first-time setup (or re-run to update) |
| `./setup.sh --dry-run` | preview what would happen |
| `./setup.sh --uninstall` | remove the_collective |
| `./setup.sh -y` | non-interactive mode (CI/CD) |
| `npm run check` | verify installation & health |
| `npm run commit` | smart commit with changelog |
| `npm run clean` | remove build artifacts |
| `npm run help` | show all available commands |

<br>

## 📋 requirements

**core:**
- **VS Code 1.107+** ([download](https://code.visualstudio.com/)) with **GitHub Copilot** subscription or free tier
- **Node.js 20+** (auto-installed by setup.sh if missing)
- **macOS, Linux, or Windows** (Git Bash or WSL on Windows)

**recommended:**
- VS Code **Insiders** build for seamless MCP auto-startup
- 4GB+ RAM (MCP servers + vector embeddings)
- 500MB+ disk space (dependencies + memory database)

### VS Code Edition Comparison

| feature | insiders | stable |
|---------|----------|--------|
| **MCP auto-startup** | ✅ automatic | ⚠️ manual (1 task) |
| **Agent defaults** | ✅ immediate | ⚠️ ~1 setup step |
| **Experimental features** | ✅ yes | ✅ stable |
| **Release cycle** | daily | monthly |

<br>

## 📖 documentation

- **[QUICKSTART.md](./QUICKSTART.md)** // detailed setup & troubleshooting
- **[AGENTS.md](./AGENTS.md)** // team workflows, interaction patterns, protocols
- **[docs/](./docs/)** // architecture, MCP servers, memory system, security
- **[.github/copilot-instructions.md](./.github/copilot-instructions.md)** // Copilot configuration

<br>

## 🆘 troubleshooting

```bash
npm run check              # full health check
npm run check -- --quick   # fast validation
npm run check -- --memory  # memory system only
```

**logs & diagnostics:**

All setup and check operations are logged to `.collective/.logs/` for troubleshooting:
- `setup.log` — recorded during `./setup.sh`
- `check.log` — recorded during `npm run check`

When reporting issues, include the relevant log file from `.collective/.logs/`.

**common issues:**

| issue | solution |
|-------|----------|
| MCP servers not starting | VS Code Stable: run task "Start MCP Servers" (Ctrl+Shift+P) |
| memory not loading | `cd .collective/memory-server && npm run build && npm run bootstrap` |
| database locked | close VS Code, retry |
| agents not responding | check `npm run check`, ensure Copilot subscription active |
| memory reset needed | `rm .mcp/collective_memory.duckdb* && npm run bootstrap` |

See [QUICKSTART.md](./QUICKSTART.md#troubleshooting) for detailed troubleshooting.

<br>

## 🌐 community & support

- **GitHub Issues** // [report bugs](https://github.com/screamingearth/the_collective/issues/new/choose)
- **Discussions** // [ideas, questions, show your work](https://github.com/screamingearth/the_collective/discussions)
- **Reddit** // [r/vscode](https://reddit.com/r/vscode), [r/programming](https://reddit.com/r/programming)
- **Documentation** // start with [QUICKSTART.md](./QUICKSTART.md)
  
<br>

## 📄 license & attribution

**the_collective** is licensed under the **[Apache License 2.0](./LICENSE)** with additional terms in [NOTICE](./NOTICE).

### commercial use - YES ✅

**you can absolutely sell stuff made with the_collective.**

**allowed:**
- Building a SaaS service powered by the_collective ✅
- Selling applications that use the_collective ✅
- Integrating the_collective into proprietary software ✅

**not allowed:**
- Selling the_collective itself as your product ❌
- Claiming you created the_collective agents ❌
- Rebranding and reselling as proprietary ❌ 

### third-party packages

See [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md) for all open-source attributions and licenses of dependencies.

<br>

## 🤝 contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Development setup
- Code of conduct
- PR guidelines
- Issue labels & triage

<br>

<div align="center">
  
built with 🖤 by the_collective

[⬆ back to top](#the_collective)

</div>
