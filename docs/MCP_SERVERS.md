# MCP Servers

Model Context Protocol servers extend the_collective with external capabilities. Memory and Gemini servers auto-start via Docker when you open the workspace. GitHub integration is built-in.

## Active Servers

**Auto-Start (Docker Default):**

| Server | Type | Purpose |
|--------|------|----------|
| **github** | HTTP | Issues, PRs, code search via Copilot |
| **memory** | SSE | Semantic memory with vector search (containerized) |
| **gemini** | SSE | Google Gemini for research & validation (containerized) |

## Deployment Modes

### Docker (Default - Auto-Start)
- Memory and Gemini servers containerized with `docker compose`
- SSE transport over HTTP
- Auto-starts when folder opens
- Health check endpoints: `http://localhost:3100/health` (memory), `http://localhost:3101/health` (gemini)

**Docker is managed automatically.** If containers exit, restart with:
```bash
docker compose up -d

# Verify health
curl http://localhost:3100/health && echo "" && curl http://localhost:3101/health

# View logs
docker logs collective-memory --tail 30
docker logs collective-gemini --tail 30
```

### Local / Stdio (Optional - Manual Launch)
- Memory and Gemini run in VS Code process via stdio transport
- For development or testing
- Requires manual configuration and startup
- Configuration: `.vscode/mcp.json`

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
*   **Why?** Docker containers and agent instructions in `.github/copilot-instructions.md` are only loaded if the root folder is opened.
*   **Subfolder warning:** If you open a subfolder (like `.collective/memory-server`), MCP servers won't load and agents will lose their tools.

## Configuration

### Docker (Default)

Servers are containerized and configured in `docker-compose.yml`. They auto-start and are accessed via HTTP:

```bash
Memory:  http://localhost:3100
Gemini:  http://localhost:3101
```

No VS Code configuration needed for Docker mode—containers manage themselves.

### Local / Stdio (Development Only)

To run Memory and Gemini in VS Code via stdio (not recommended—Docker is the standard), modify `.vscode/mcp.json` to use stdio transport instead of SSE, then restart VS Code.

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

- **Memory** stored locally (no cloud sync)
- **API keys** never committed—use environment variables
- **Gemini authentication** via OAuth (secure, no credentials stored)
- **Filesystem operations** use VS Code built-in tools (scoped to workspace)

## See Also

- [MEMORY_ARCHITECTURE.md](MEMORY_ARCHITECTURE.md) — How memory works internally
- [GEMINI_BRIDGE.md](GEMINI_BRIDGE.md) — Gemini research tools setup
- [MCP Specification](https://modelcontextprotocol.io/) — Protocol documentation
