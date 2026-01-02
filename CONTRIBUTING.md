# Contributing

We welcome improvements, bug fixes, and new features.

> By contributing, you agree that your contributions will be licensed under Apache License 2.0 or Mozilla Public License 2.0. See [NOTICE](NOTICE) for guidelines.

## Setup

**Prerequisites:**
- Docker Desktop (macOS/Windows) or Docker Engine (Linux) — auto-installed by setup script
- Git, Node.js 20+ — auto-installed by setup script

**macOS / Linux:**
```bash
git clone https://github.com/YOUR_USERNAME/the_collective.git
cd the_collective
./setup.sh
```

**Windows:**
```powershell
git clone https://github.com/YOUR_USERNAME/the_collective.git
cd the_collective
./setup.sh        # Run in Git Bash or WSL
```

**Development modes:**
- **Docker mode (default):** MCP servers run in containers (SSE transport)
- **Local mode:** MCP servers run via stdio (lighter, requires rebuild on changes)
- **Switch modes:**
  ```bash
  npx the_collective mode docker  # SSE transport (default)
  npx the_collective mode local   # stdio transport
  ```

## Making Changes

**Agent behavior:** Edit `.github/agents/*.agent.md`  
**Memory system:** Edit `.collective/memory-server/src/`  
**Gemini integration:** Edit `.collective/gemini-bridge/src/`  
**Core instructions:** Edit `.github/copilot-instructions.md`   
**CLI & scripts:** Edit `scripts/*.cjs` and `scripts/lib/*.cjs`  
**Documentation:** Edit `.md` files in root or `docs/`

**After code changes:**
- **Docker mode:** Rebuild containers: `docker compose up -d --build`
- **Local mode:** Restart VS Code to reload MCP servers

## Before You Push

Run validation checks:

```bash
npm run check           # Health check all systems
npm run validate        # ESLint + TypeScript

# Test individual packages
cd .collective/memory-server && npm test
cd .collective/gemini-bridge && npm test
```

Double check `.gitignore` to avoid committing sensitive data. By default, the memory database and logs are ignored along with other commonly ignored files.

## Commits & PRs

Use conventional commits:

```bash
npm run commit       # Interactive tool
# or: git commit -m "feat: description"
```

Prefixes: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

## PR Checklist

1. Fork and create a branch
2. Run `npm run check && npm run validate` locally
3. Use conventional commits
4. Submit PR with clear description
5. All CI checks must pass (see `.github/workflows/validate.yml`)

## Versioning

>the_collective follows semantic versioning:

| Level | When | Example |
|-------|------|---------|
| **Major** | Breaking changes | 2.0.0 |
| **Minor** | New features | 1.1.0 |
| **Patch** | Bug fixes | 1.0.1 |

## Questions?

Open an [issue](https://github.com/screamingearth/the_collective/issues), join the [discussions](https://github.com/screamingearth/the_collective/discussions), or [contact me directly](NOTICE#contact)
