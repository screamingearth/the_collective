# MCP Servers

Model Context Protocol servers extend the_collective with external capabilities. Memory and Gemini servers run in Docker containers (default) or locally via stdio. GitHub integration is built-in.

## Prerequisites

**Docker Required (Default Mode):**
- **macOS**: Docker Desktop (auto-installed via Homebrew during setup)
- **Linux**: Docker Engine (auto-installed via package manager during setup)
- **Windows**: Docker Desktop ([download manually](https://docs.docker.com/desktop/install/windows-install/))

The `setup.sh` script detects Docker and offers to install it automatically on macOS/Linux.

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

### Docker Mode (Default, Recommended)

Servers run as containers, configured in `docker-compose.yml`:

```bash
Memory Server:  http://localhost:3100 (SSE transport)
Gemini Bridge:  http://localhost:3101 (SSE transport)
```

**Benefits:**
- Auto-start with `docker compose up -d`
- Isolated environments
- Easy updates (just rebuild containers)
- No VS Code restart needed for server updates

**Requirements:**
- Docker Desktop (macOS/Windows) or Docker Engine (Linux)
- 2GB disk space for images
- Ports 3100-3101 available

**Volume Mounts:**
- **Memory server:** `./.mcp` (database persistence)
- **Gemini bridge:** `~/.gemini` (OAuth credentials)

**Networking Notes:**
- Containers communicate with each other via Docker bridge network
- If you add MCP servers that need to reach host services, use:
  - **macOS/Windows:** `host.docker.internal` instead of `localhost`
  - **Linux:** Add `--network="host"` to docker-compose.yml service config

### Stdio Mode (Alternative)

Servers run natively via Node.js, launched by VS Code:

```bash
Memory Server:  stdio (VS Code spawns process)
Gemini Bridge:  stdio (VS Code spawns process)
```

**Benefits:**
- Lighter weight (no Docker overhead)
- Direct debugging via VS Code
- No port conflicts

**Drawbacks:**
- Requires VS Code restart after code changes
- Locks database file during VS Code session

### Configuration Files

- `.vscode/mcp.docker.json` — Docker mode config (SSE transport)
- `.vscode/mcp.stdio.json` — Stdio mode config (stdio transport)
- `.vscode/mcp.json` — Active config (copied from above)

**Switching modes:**
```bash
npx the_collective mode docker   # Switch to Docker (SSE)
npx the_collective mode stdio    # Switch to Node.js (stdio)
```

Or use VS Code tasks: "Switch to Docker Mode" / "Switch to stdio Mode"

## Docker Mode Details

### Starting Containers

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
