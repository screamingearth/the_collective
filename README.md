<div align="center" id="the_collective">

![the_collective banner](.collective/.assets/the_collective-banner.png)

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![VS Code: 1.107+](https://img.shields.io/badge/VS%20Code-1.107%2B-007ACC?logo=visual-studio-code)](https://code.visualstudio.com/)
[![Node.js: 20+](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js)](https://nodejs.org/)
[![TypeScript: 5.7+](https://img.shields.io/badge/TypeScript-5.7%2B-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![MCP: 2025-11-25](https://img.shields.io/badge/MCP-2025--11--25-FF6B6B)](https://modelcontextprotocol.io/)
  
<h3>vision:// further enable humans to harness the power of AI and bring their ideas to life</h3>

>*\>the_collective is a team of AI agents that work together inside VS Code. Instead of one AI assistant, you get specialised personalities that debate, research, and build things collaboratively using powerful tools.*

**No AI expertise required.** If you can install VS Code and run a single command, you are ready.

</div><br>

## 🚀 Quick Install

**One command, zero prerequisites.** The bootstrapper installs everything (Git, Python, Node.js, dependencies) automatically.

### 🍎 macOS / Linux / WSL
```bash
curl -fsSL https://raw.githubusercontent.com/screamingearth/the_collective/main/bootstrapper_unix.sh | bash
```

### 🪟 Windows (PowerShell)
```powershell
$s = iwr -useb https://raw.githubusercontent.com/screamingearth/the_collective/main/bootstrapper_win.ps1; if ($?) { $s.Content | iex }
```

> **Troubleshooting:** If a command fails, see [QUICKSTART.md](./QUICKSTART.md) for manual installation steps and fallbacks.

---

### 🧐 Verify It Works

1. **Open the Root Folder:** Restart VS Code and select **Open Folder...**. Navigate to your installation (e.g., `Documents/the_collective` on Windows) and select the **root** directory.
   > **CRITICAL:** You must open the root folder directly. This allows VS Code to access `.vscode/mcp.json` for tool integration and `.github/copilot-instructions.md` for agent personas.

2. Open the integrated terminal and run:
   ```bash
   npm run check
   ```
   *Expected output:* `✅ All checks passed! Framework is ready.`

3. Open **Copilot Chat** and say:
   
   ```>the_collective://``` hey guys, please test out your tools and make sure they work

   *Expected outcome:* The agents should respond and stretch their legs a little.

<br>

> *disclaimer: >the_collective is an experimental open-source framework under active development. While I strive for quality, it likely contains many bugs. Use at your own risk.*

**[→ Detailed Setup Guide & Troubleshooting →](./QUICKSTART.md)**

## 🤖 the team

| agent | role | specialty | vibe |
|-------|------|-----------|------|
| **nyx** | orchestrator | strategy & synthesis | witty, direct, runs the show |
| **prometheus** | builder | implementation & architecture | methodical, technical |
| **cassandra** | breaker | security & risk analysis | skeptical, thorough |
| **apollo** | polisher | optimization & quality | perfectionist, elegant |
---
**>the_collective is best utilized by Claude models:**
*   **Haiku 4.5** (Fast / Chat)
*   **Sonnet 4.5** (Default / Coding)
*   **Opus 4.5** (Deep Reasoning)
---
> BYOK: you can configure >the_collective to use your own API keys. use vscode's built-in BYOK features by going to the vscode chat sidebar, click your current model, and select "Manage Models".
>
>you can also see [GEMINI_BRIDGE.md](./docs/GEMINI_BRIDGE.md) to change what model >the_collective interacts with via the bridge server.<br>
>gemini-3-flash-preview by default.

<br>

## 🧠 how it works

**memory system** // local vector database (DuckDB + semantic embeddings) with retriever-reranker pipeline. your preferences, decisions, architectural choices, and project context persist across sessions. encrypted locally, never sent to cloud.

**gemini bridge** // custom MCP server wrapping gemini-cli into specialized tools for general queries, decision validation, and massive codebase analysis. leverages gemini-3-flash-preview free tier for cost-free offloading. />the_collective uses it autonomously to double-check logic or process information beyond local context limits.

**agents** // one language model, four specialized personas. address them directly in chat (`cassandra, check for vulnerabilities`) or use team mode to watch them collaborate in real-time. 

**customiseable skills** // easily accessible in chat with slash commands. try it out with ```/review```, ```/debug```, ```/implement```, or ```/test```. edit or add more in ```/.github/prompts/```.

**team mode** // switch to `>the_collective` in Copilot chat. Watch Nyx orchestrate while Prometheus builds, Cassandra breaks things, and Apollo polishes. Friction creates quality.

<br>

## 🚀 features

- **Local-first** // Semantic vector database never leaves your machine. no telemetry, no vendor lock-in
- **Cognitive Diversity** // Use multiple LLM models for different perspectives
- **Real-Time Collaboration** // Watch agents debate, build, and refine solutions
- **Extensible Architecture** // Add custom agents, tools, memories, and workflows

<br>

## 📋 Requirements

- **VS Code 1.107+** with **GitHub Copilot** (free tier or paid)
- **Node.js 20+** (Auto-installed by bootstrapper)
- **macOS, Linux, or Windows 10/11**

**[→ System requirements & troubleshooting](./QUICKSTART.md)**

<br>

## 📖 Documentation

- **[/docs/](./docs/)** — Architecture, MCP servers, memory system
- **[QUICKSTART.md](./QUICKSTART.md)** — Setup, requirements, troubleshooting
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** — Development guide & guidelines
- **[NOTICE](./NOTICE)** — Legal notices & attributions


<br>



## ⚖️ License & Legal

This project is **Dual-Licensed** to protect the core framework while allowing easy integration.

### 🧠 The Core (MPL 2.0)
The intelligence engine (`/.collective/`) and the Agent Personas are licensed under the **[Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/)**.
*   **Commercial Use:** ✅ Allowed.
*   **Modifications:** 📝 If you modify the core framework or agent prompts, you **must** open-source those specific changes and follow the terms of the MPL 2.0. See [NOTICE](./NOTICE) for details.

### 🔌 The Shell (Apache 2.0)
The setup scripts, documentation, and integration code are licensed under the **[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)**.
*   You are free to use, modify, and distribute these scripts as you see fit.

### 💼 Commercial Use
You can build and sell products *using* >the_collective, but you cannot resell >the_collective itself as a standalone product. See [NOTICE](./NOTICE) for details.

<br>

<div align="center">
  
built with 🖤 by >the_collective

[⬆ uppies](#the_collective)

</div>
