# Contributing

We welcome improvements, bug fixes, and new features.

> By contributing, you agree that your contributions will be licensed under Apache License 2.0 or Mozilla Public License 2.0. See [NOTICE](NOTICE) for guidelines.

## Setup

**macOS / Linux:**
```bash
git clone https://github.com/YOUR_USERNAME/the_collective.git
cd the_collective
./setup.sh
```

**Windows:**
```batch
git clone https://github.com/YOUR_USERNAME/the_collective.git
cd the_collective
setup.bat
```

## Making Changes

**Agent behavior:** Edit `.github/agents/*.agent.md`  
**Memory system:** Edit `.collective/memory-server/src/`  
**Gemini integration:** Edit `.collective/gemini-bridge/src/`  
**Core instructions:** Edit `.github/copilot-instructions.md`   
**Documentation:** Edit `.md` files in root or `.github/`

Restart VS Code after changes.

## Before You Push

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
