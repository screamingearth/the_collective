# Contributing

We welcome improvements, bug fixes, and new features.

> By contributing, you agree that your contributions will be licensed under Apache License 2.0. See [NOTICE](NOTICE) for trademark guidelines.

## Setup

```bash
git clone https://github.com/YOUR_USERNAME/the_collective.git
cd the_collective
./setup.sh
```

## Making Changes

**Agent behavior:** Edit `.github/agents/*.agent.md`  
**Memory system:** Edit `.collective/memory-server/src/`  
**Core instructions:** Edit `.github/copilot-instructions.md`

Restart VS Code after changes.

## Before You Push

```bash
npm run check        # Validate framework
npm run validate     # Lint & type check
npm run reset:memories -- --force --keep-core  # Clear project-specific context
```

> **Memory note:** Memories are local-only. This command clears your project context before pushing so you don't share unintended context.

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

the_collective follows semantic versioning:

| Level | When | Example |
|-------|------|---------|
| **Major** | Breaking changes | 2.0.0 |
| **Minor** | New features | 1.1.0 |
| **Patch** | Bug fixes | 1.0.1 |

---

## Questions?

Open a [GitHub issue](https://github.com/screamingearth/the_collective/issues).
