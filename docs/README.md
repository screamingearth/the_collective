# Documentation

Complete guides for the_collective framework.

## Guides

| Doc | Purpose |
|-----|---------|
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | **Start here if something's broken** — common issues and solutions |
| [MEMORY_ARCHITECTURE.md](MEMORY_ARCHITECTURE.md) | Vector memory internals, retriever-reranker architecture, DuckDB schema |
| [MCP_SERVERS.md](MCP_SERVERS.md) | MCP server setup, configuration, troubleshooting |
| [GEMINI_BRIDGE.md](GEMINI_BRIDGE.md) | Gemini research tools: authentication, usage, API reference |
| [GITHUB_INTEGRATION.md](GITHUB_INTEGRATION.md) | Commit tool, changelog management, templates |

## Quick Start

**CRITICAL:** Always open the **root** `the_collective` folder in VS Code. This ensures `.vscode/mcp.json` and `.github/copilot-instructions.md` are loaded correctly.

**Framework commands (from workspace root):**
```bash
./setup.sh              # First-time setup (builds everything)
npm run check           # Verify all systems
npm run commit          # Commit with changelog
npm run help            # Show all available commands
npm run reset:memories  # Clear memory database
```

**CLI commands (works anywhere):**
```bash
npx the_collective install    # Add to existing project
npx the_collective uninstall  # Remove from project
npx the_collective update     # Update to latest version
npx the_collective doctor     # Diagnose and fix issues
npx the_collective mode docker|local  # Switch modes
```

**Package-specific commands** (require `cd` first):
```bash
# Memory server
cd .collective/memory-server
npm run test            # Run vitest tests
npm run bootstrap       # Populate core memories
npm run doctor          # Health check utility

# Gemini bridge
cd .collective/gemini-bridge
npm run test            # Run vitest tests
npm run auth            # Authenticate with Google
npm run doctor          # Health check utility
```

## Testing

The project uses [Vitest](https://vitest.dev/) for modern, fast testing:

- **memory-server:** 11 tests covering storage, search, retrieval, deletion
- **gemini-bridge:** 13 tests covering utilities, arg building, response parsing

Run tests from each package directory:
```bash
cd .collective/memory-server && npm test
cd .collective/gemini-bridge && npm test
```

**Doctor utilities** provide health checks without running the full test suite:
```bash
cd .collective/memory-server && npm run doctor    # Check DuckDB, embeddings
cd .collective/gemini-bridge && npm run doctor    # Check Gemini auth, API
```

## Key Concepts

### The Team
- **Nyx:** Strategic orchestration and user interface
- **Prometheus:** Implementation and architecture
- **Cassandra:** Validation, risk analysis, and security
- **Apollo:** Optimization and quality certification

### MCP Servers

**Transport Modes:** MCP servers can run in **Docker mode** (SSE over HTTP, auto-start) or **Local mode** (stdio, VS Code spawned).

- **github** (HTTP) — Issues, PRs, code search
- **memory** (Docker: SSE | Local: stdio) — Semantic memory with vector search
- **gemini** (Docker: SSE | Local: stdio) — Google Gemini for research & validation
- **filesystem** (stdio) — Safe workspace file operations

**Switch modes:** Use VS Code tasks "Switch to Docker Mode" or "Switch to stdio Mode", then reload window.

### Cognitive Diversity
The team uses Gemini tools for independent validation—a different AI model catches blind spots that shared architecture might miss.

## Troubleshooting

**See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for the complete guide.**

Quick fixes:
- **Something not working?** Run `npm run check` for diagnosis
- **Memory locked error?** Close VS Code and retry (normal with MCP servers)
- **Build failed?** Run `npm run clean && ./setup.sh`
- **Setup failed?** Check `.collective/.logs/setup.log`

## See Also

- [Main README](../README.md) — Framework overview
- [CONTRIBUTING.md](../CONTRIBUTING.md) — How to contribute
- [SECURITY.md](../SECURITY.md) — Security policy
