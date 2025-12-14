# Security

## Reporting Issues

For security vulnerabilities, open a GitHub issue or contact the maintainers directly.

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
cd memory-server && npm run bootstrap
```
