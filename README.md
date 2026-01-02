<div align="center" id="the_collective">

![the_collective banner](.collective/.assets/the_collective-banner.png)

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![VS Code: 1.107+](https://img.shields.io/badge/VS%20Code-1.107%2B-007ACC?logo=visual-studio-code)](https://code.visualstudio.com/)
[![Node.js: 20+](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js)](https://nodejs.org/)
[![TypeScript: 5.7+](https://img.shields.io/badge/TypeScript-5.7%2B-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![MCP: 2025-11-25](https://img.shields.io/badge/MCP-2025--11--25-FF6B6B)](https://modelcontextprotocol.io/)
  
<h3>vision:// further enable humans to harness the power of AI and bring their ideas to life</h3>

\>the_collective is a team of AI agents that work together inside VS Code. instead of one AI assistant, you get specialised personalities that debate, research, and build things collaboratively using powerful tools.

**no AI expertise required:** if you can handle installing vscode and running a single terminal command, you're good to go.

</div><br>

### 🍎 macOS / Linux / WSL
```bash
curl -fsSL https://raw.githubusercontent.com/screamingearth/the_collective/main/setup.sh | bash
cd the_collective
```

### 🪟 Windows
> *if you don't have Git or Node.js installed and the command line is spooky, don't worry! just follow these steps:*
>
>\>*this installation process is experimental, manual instructions [here](./QUICKSTART.md)*

Open VS Code and use the default Copilot Chat to install dependencies:

1. Open Copilot Chat (`ctrl+shift+I` or click the chat icon)
2. Say: ```Autonomously install Node.js 20 or later, Git Bash for Windows, and ensure VS Code is in PATH ```
3. Do the things, restart vscode, go to explorer (`ctrl+shift+E`), open ```>the_collective```
4. Say: ```install screamingearth/the_collective```

Restart VS Code, then select the `>the_collective` chat mode in Copilot Chat.
> *hey guys, I'd like to make...*

### 🧐 verify it works

open the terminal in vs code inside ```>the_collective``` workspace and run:
```bash
npm run check
```

expected output:

```
✅ All checks passed! Framework is ready.
```
then say,

```>the_collective://``` *"hey guys, please test out your tools and make sure they work"*


**[→ detailed setup guide →](./QUICKSTART.md)**

---

## 📦 adding to existing projects

already have a project? install the_collective alongside your existing code:

```bash
npx the_collective install
```

this will:
- add the `.collective/` framework to your project
- merge MCP server configs with your existing `.vscode/` settings
- preserve your existing files (with backups)

**other commands:**
```bash
npx the_collective doctor     # check installation health
npx the_collective update     # update to latest version
npx the_collective uninstall  # clean removal
npx the_collective mode docker|local  # switch modes
```

---

## 🤖 the team

| agent | role | specialty | vibe |
|-------|------|-----------|------|
| **nyx** | orchestrator | strategy & synthesis | witty, direct, runs the show |
| **prometheus** | builder | implementation & architecture | methodical, technical |
| **cassandra** | breaker | security & risk analysis | skeptical, thorough |
| **apollo** | polisher | optimization & quality | perfectionist, elegant |
<br>

**>the_collective is best utilized by Claude models:**

\>Haiku 4.5 (fast)

\>Sonnet 4.5 (default)

\>Opus 4.5 (deep reasoning)

<h5>but of course, you can use whatever you want!</h5>

<br>

## 🧠 how it works

**memory system** // Local vector database (DuckDB + semantic embeddings) with retriever-reranker pipeline. your preferences, decisions, architectural choices, and project context persist across sessions. encrypted locally, never sent to cloud.

**agents** // One language model, four specialized personas. address them directly in chat (`cassandra, review this`) or use team mode to watch them collaborate in real-time.

**team mode** // Switch to `>the_collective` in Copilot chat. Watch Nyx orchestrate while Prometheus builds, Cassandra breaks things, and Apollo polishes. Friction creates quality.

**docker mode** // MCP servers run in containers for isolation. starts automatically when you open the workspace. switch with `npx the_collective mode docker|local`.

<br>

## 🚀 features

- **local memory** // semantic vector database never leaves your machine
- **zero tracking** // Apache 2.0 licensed, no telemetry, no vendor lock-in
- **cognitive diversity** // use multiple LLM models for different perspectives
- **real-time collaboration** // watch agents debate, build, and refine solutions
- **extensible architecture** // add custom agents, tools, memories, and workflows
- **dual-licensed** // Apache 2.0 for integration, MPL 2.0 for core framework
- **open-source** // fully transparent, community-driven development

<br>

## 📋 requirements

- **VS Code 1.107+** with **GitHub Copilot**
- **Node.js 20+** (auto-installed on macOS/Linux)
- **macOS, Linux, or Windows 10/11**

**[→ System requirements & troubleshooting](./QUICKSTART.md)**

<br>

## 📖 documentation

- **[/docs/](./docs/)** — architecture, MCP servers, memory system
- **[NOTICE](./NOTICE)** — legal notices & attributions
- **[QUICKSTART.md](./QUICKSTART.md)** — setup, requirements, troubleshooting
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — development guide & guidelines
- **[THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md)** — open-source attributions & licenses - thank you FOSS developers 🖤


<br>



## ⚖️ License & Legal

This project is **Dual-Licensed** to protect the core framework while allowing easy integration.

### 🧠 The Core (MPL 2.0)
The intelligence engine (`/.collective/`) and the Agent Personas (System Prompts) are licensed under the **[Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/)**. 
*   **Commercial Use:** ✅ Allowed.
*   **Modifications:** 📝 If you modify the core framework or agent prompts, you **must** open-source those specific changes and include required documentation.

### 🔌 The Shell (Apache 2.0)
The setup scripts, documentation, and integration code are licensed under the **[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)**.
*   You are free to use, modify, and distribute these scripts as you see fit.

### 🛡️ Attribution

">the_collective" is the name of this framework. The agent names (Nyx, Prometheus, Cassandra, Apollo) are inspired by mythology and are not trademarked - feel free to use those names for your own custom agents. 

What matters: if you use code from this project, respect the licenses (MPL 2.0 for core, Apache 2.0 for integration) and give proper attribution. See [NOTICE](./NOTICE) for details.

### 💼 Commercial use - YES ✅

*you can absolutely sell stuff made with >the_collective*

**allowed:**
- Building a SaaS service powered by >the_collective ✅
- Selling applications that use >the_collective ✅
- Integrating >the_collective into proprietary software ✅

**not allowed:**
- Selling >the_collective itself as your product ❌
- Claiming you created >the_collective agents ❌
- Rebranding and reselling >the_collective as proprietary ❌ 

### 📦 Third-party packages

See [THIRD_PARTY_LICENSES.md](./THIRD_PARTY_LICENSES.md) for all open-source attributions and licenses of dependencies.

## 🤝 contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Development setup
- Code of conduct
- PR guidelines
- Issue labels & triage

<br>

<div align="center">
  
built with 🖤 by >the_collective

[⬆ uppies](#the_collective)

</div>
