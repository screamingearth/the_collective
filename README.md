![the_collective banner](.collective/.assets/the_collective-banner.png)

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![VS Code: 1.107+](https://img.shields.io/badge/VS%20Code-1.107%2B-007ACC?logo=visual-studio-code)](https://code.visualstudio.com/)
[![Node.js: 20+](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js)](https://nodejs.org/)
[![TypeScript: 5.7+](https://img.shields.io/badge/TypeScript-5.7%2B-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![MCP: 2025-11-25](https://img.shields.io/badge/MCP-2025--11--25-FF6B6B)](https://modelcontextprotocol.io/)

---

## ⚡ quick start

### one-liner (recommended)

**macOS / Linux / Windows (Git Bash or WSL):**
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

---

## 🤖 the team

| agent | role | specialty | vibe |
|-------|------|-----------|------|
| **nyx** | orchestrator | strategy & synthesis | witty, direct, runs the show |
| **prometheus** | builder | implementation & architecture | methodical, technical |
| **cassandra** | breaker | security & risk analysis | skeptical, thorough |
| **apollo** | polisher | optimization & quality | perfectionist, elegant |

**ai models:** the-collective is best utilised by Claude models - Haiku 4.5 (fast), Sonnet 4.5 (balanced, recommended), and Opus 4.5 (deep reasoning)

---

## 🧠 how it works

**memory system**  
Local vector database (DuckDB + semantic embeddings) with retriever-reranker pipeline. your preferences, decisions, architectural choices, and project context persist across sessions. encrypted locally, never sent to cloud.

**agents**  
One language model, four specialized personas. address them directly in chat (`cassandra, review this`) or use team mode to watch them collaborate in real-time.

**team mode**  
Switch to `the_collective` in Copilot chat. watch Nyx orchestrate while Prometheus builds, Cassandra breaks things, and Apollo polishes. friction creates quality.

---

## 🚀 features

- ✅ **local-first memory** — semantic vector database never leaves your machine
- ✅ **4-agent team** — specialized personas that actually debate your code
- ✅ **MCP servers** — memory, gemini research tools, filesystem access (extensible)
- ✅ **auto-startup** — MCP servers launch on workspace open (VS Code 1.107+)
- ✅ **org-level agents** — share agents across GitHub organizations
- ✅ **zero tracking** — apache 2.0 licensed, no telemetry, no vendor lock-in
- ✅ **december 2025 ready** — typescript 7.0 compatible, ESLint 10 compatible, native MCP support

---

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

---

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
| **Experimental features** | ✅ all enabled | ✅ stable features |
| **Release cycle** | daily | monthly |

---

## 📖 documentation

- **[QUICKSTART.md](./QUICKSTART.md)** — detailed setup guide with troubleshooting
- **[AGENTS.md](./AGENTS.md)** — team workflows, interaction patterns, protocols
- **[docs/](./docs/)** — deep dives on architecture, MCP servers, memory system, security
- **[.github/copilot-instructions.md](./.github/copilot-instructions.md)** — framework configuration for Copilot

---

## 🆘 troubleshooting

**quick diagnostics:**
```bash
npm run check              # full health check
npm run check -- --quick   # fast validation
npm run check -- --memory  # memory system only
```

**common issues:**

| issue | solution |
|-------|----------|
| MCP servers not starting | VS Code Stable: run task "Start MCP Servers" (Ctrl+Shift+P) |
| memory not loading | `cd .collective/memory-server && npm run build && npm run bootstrap` |
| database locked | close VS Code, retry |
| agents not responding | check `npm run check`, ensure Copilot subscription is active |
| memory reset needed | `rm .mcp/collective_memory.duckdb* && npm run bootstrap` |

See [QUICKSTART.md](./QUICKSTART.md#troubleshooting) for detailed troubleshooting.

---

## 🌐 community & support

- **GitHub Issues** — [report bugs](https://github.com/screamingearth/the_collective/issues/new/choose)
- **Discussions** — [ideas, questions, show your work](https://github.com/screamingearth/the_collective/discussions)
- **Reddit** — [r/vscode](https://reddit.com/r/vscode), [r/programming](https://reddit.com/r/programming)
- **Documentation** — start with [QUICKSTART.md](./QUICKSTART.md)

---

## 📄 license & attribution

**the_collective** is licensed under the **[Apache License 2.0](./LICENSE)** with additional terms in [NOTICE](./NOTICE).

### what you can do

✅ **Commercial use** — use in closed-source products  
✅ **Modify** — fork and customize the framework  
✅ **Redistribute** — share modified versions  
✅ **Private projects** — no public disclosure required  
✅ **Patent protection** — Apache 2.0 includes explicit patent grant  

### what you must do

ℹ️ **Include license** — copy of Apache 2.0 license with distributions  
ℹ️ **Include notice** — NOTICE file and copyright attributions  
ℹ️ **Document changes** — if you modify, indicate what changed  

### what you can't do

❌ **No warranty** — framework provided "as is"  
❌ **No liability** — authors not liable for damages  
❌ **No trademark** — can't use "the_collective" branding for derivatives  

### third-party packages

See [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md) for all open-source attributions and licenses of dependencies.

---

## 🤝 contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Development setup
- Code of conduct
- PR guidelines
- Issue labels & triage

---

## 🙏 credits

**Built by:** [screamingearth](https://github.com/screamingearth) & contributors

**Powered by:**
- [VS Code](https://code.visualstudio.com/) — editor & extension platform
- [Model Context Protocol](https://modelcontextprotocol.io/) — agent-aware AI standards
- [GitHub Copilot](https://github.com/features/copilot) — AI coding assistant
- [Node.js](https://nodejs.org/) — runtime
- [TypeScript](https://www.typescriptlang.org/) — language
- [DuckDB](https://duckdb.org/) + [VSS](https://github.com/duckdb/vss) — embeddings & vector search
- [ESLint](https://eslint.org/) — code quality

---

<div align="center">

**Built with intent. Built to last. Built by the collective.**

[⬆ back to top](#the_collective)

</div>
