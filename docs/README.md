# Documentation

Complete guides for the_collective framework.

## Guides

| Doc | Purpose |
|-----|---------|
| [MEMORY_ARCHITECTURE.md](MEMORY_ARCHITECTURE.md) | Vector memory internals, retriever-reranker architecture, DuckDB schema |
| [MCP_SERVERS.md](MCP_SERVERS.md) | MCP server setup, configuration, troubleshooting |
| [GEMINI_BRIDGE.md](GEMINI_BRIDGE.md) | Gemini research tools: authentication, usage, API reference |
| [GITHUB_INTEGRATION.md](GITHUB_INTEGRATION.md) | Commit tool, changelog management, templates |

## Quick Start

```bash
./setup.sh              # First-time setup (builds everything)
npm run check           # Verify all systems
npm run commit          # Commit with changelog
npm run help            # Show all available commands
npm run reset:memories  # Clear memory database
```

## Key Concepts

### The Team
- **Nyx:** Strategic orchestration and user interface
- **Prometheus:** Implementation and architecture
- **Cassandra:** Validation, risk analysis, and security
- **Apollo:** Optimization and quality certification

### MCP Servers
- **github** (HTTP) — Issues, PRs, code search
- **memory** (stdio) — Semantic memory with vector search
- **gemini** (stdio) — Google Gemini for research & validation
- **filesystem** (stdio) — Safe workspace file operations

### Cognitive Diversity
The team uses Gemini tools for independent validation—a different AI model catches blind spots that shared architecture might miss.

## Troubleshooting

### General Issues
- **Something not working?** Run `npm run check` for diagnosis
- **Memory locked error?** Close VS Code and retry (normal with MCP servers)
- **Build failed?** Run `npm run clean && ./setup.sh`

### MCP Server Issues
See [MCP_SERVERS.md](MCP_SERVERS.md#troubleshooting)

### Gemini Tools Issues
See [GEMINI_BRIDGE.md](GEMINI_BRIDGE.md#troubleshooting)

### Memory Issues
See [MEMORY_ARCHITECTURE.md](MEMORY_ARCHITECTURE.md#troubleshooting) or `npm run check -- --memory`

## See Also

- [Main README](../README.md) — Framework overview
- [CONTRIBUTING.md](../CONTRIBUTING.md) — How to contribute
- [SECURITY.md](../SECURITY.md) — Security policy
