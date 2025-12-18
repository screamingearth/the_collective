# MCP Servers

Model Context Protocol servers extend the_collective with external capabilities. All servers auto-start when VS Code opens.

## Active Servers

| Server | Type | Purpose |
|--------|------|---------|
| **github** | HTTP | Issues, PRs, code search via Copilot |
| **memory** | stdio | Semantic memory with vector search |
| **gemini** | stdio | Google Gemini for research & validation |
| **filesystem** | stdio | Safe workspace file operations |

## Setup

```bash
# First-time setup (builds and configures everything)
./setup.sh

# Verify servers are running
npm run check

# Open folder normally
code .
```

**CRITICAL:** You must open the **root** `the_collective` folder in VS Code. 
*   **Why?** VS Code only looks for `.vscode/mcp.json` in the root of the opened workspace. If you open a subfolder (like `.collective/memory-server`), the MCP servers will not load, and the agents will lose their tools.
*   **Agent Personas:** Similarly, the agent instructions in `.github/copilot-instructions.md` are only loaded if the root folder is opened.

## Configuration

Servers are defined in `.vscode/mcp.json`:

```jsonc
{
  "servers": {
    "memory": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/.collective/memory-server/dist/index.js"],
      "env": { "MEMORY_DB_PATH": "${workspaceFolder}/.mcp/collective_memory.duckdb" }
    },
    "gemini": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/.collective/gemini-bridge/dist/mcp-server.js"]
    },
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "${workspaceFolder}"]
    }
  }
}
```

### Auto-Start Settings

Configured in `.vscode/settings.json`:

```jsonc
{
  "chat.mcp.autostart": "newAndOutdated",  // Auto-restart on config change
  "chat.mcp.access": true,                 // Enable trust prompts
  "chat.mcp.gallery.enabled": true         // Show server gallery
}
```

## VS Code Built-in Tools

These work without MCP configuration:

- **`fetch_webpage`** — HTTP requests to any URL
- **`runSubagent`** — Spawn autonomous research agents
- **`run_in_terminal`** — Execute shell commands
- **`grep_search` / `semantic_search`** — Code search

## Optional Servers

Add more servers to `.vscode/mcp.json` as needed:

```jsonc
{
  "servers": {
    "brave-search": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": { "BRAVE_API_KEY": "your-key" }
    },
    "postgres": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres", "postgresql://user:pass@localhost/db"]
    }
  }
}
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| **Servers not auto-starting** | Check `chat.mcp.autostart: "newAndOutdated"` in `.vscode/settings.json` |
| **Memory server not starting** | `cd .collective/memory-server && npm install && npm run build` |
| **Servers not loading** | Run `MCP: List Servers` command, restart any stopped servers |
| **Trust dialog appears** | Click "Allow" when prompted—stored for future sessions |
| **"database locked" error** | Normal! Close VS Code and retry. MCP servers hold locks while open |
| **Package not found** | Verify: `npm view @modelcontextprotocol/server-<name>` |

### Manual Server Management

If auto-start doesn't work:

1. Open Command Palette (`Ctrl+Shift+P`)
2. Run `MCP: List Servers`
3. Click "Start" on stopped servers
4. Or use code lenses in `.vscode/mcp.json`

### Reset MCP Cache

If servers behave unexpectedly:

```
Ctrl+Shift+P → MCP: Reset Cached Tools
Ctrl+Shift+P → MCP: Reset Trust
Ctrl+Shift+P → Developer: Reload Window
```

## Security

- **Filesystem** scoped to workspace only
- **Memory** stored locally (no cloud sync)
- **API keys** never committed—use environment variables
- **Gemini authentication** via OAuth (secure, no credentials stored)

## See Also

- [MEMORY_ARCHITECTURE.md](MEMORY_ARCHITECTURE.md) — How memory works internally
- [GEMINI_BRIDGE.md](GEMINI_BRIDGE.md) — Gemini research tools setup
- [MCP Specification](https://modelcontextprotocol.io/) — Protocol documentation
