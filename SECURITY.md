# Security

## Reporting a Vulnerability

**Please do NOT create public GitHub issues for security vulnerabilities.**

Email: security@screamingearth.com
PGP Key: [Coming Soon]

Response timeline:
- Acknowledgment: 48 hours
- Initial assessment: 5 business days  
- Resolution: Based on severity

Scope: Memory server, Gemini bridge, shell scripts, MCP configuration

## What's Protected

- `.gitignore` excludes secrets, API keys, and database files
- Memory database (`.mcp/`) stays local, never synced
- MCP servers scoped to workspace folder only
- All dependencies version-pinned

## Best Practices

- Don't store credentials in agent memories
- Run `npm audit` periodically
- Review `.vscode/mcp.json` before using in sensitive projects

## Resetting Data

```bash
rm -f .mcp/collective_memory.duckdb*
cd .collective/memory-server && npm run bootstrap
```
