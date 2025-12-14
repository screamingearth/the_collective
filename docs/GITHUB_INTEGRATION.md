# GitHub Integration

Streamlined commit and changelog management.

## Smart Commit Tool

```bash
npm run commit                        # Interactive commit with changelog
npm run commit -- -t feat -m "msg"    # Non-interactive commit
npm run commit -- --push              # Commit and push in one step
npm run commit -- --dry-run           # Preview without changes
```

## Commit Types

| Type | Emoji | Description |
|------|-------|-------------|
| `feat` | ✨ | New feature |
| `fix` | 🐛 | Bug fix |
| `docs` | 📝 | Documentation |
| `refactor` | ♻️ | Refactoring |
| `perf` | ⚡ | Performance |
| `test` | ✅ | Tests |
| `chore` | 🔧 | Build/auxiliary |
| `breaking` | 💥 | Breaking changes |
| `security` | 🔒 | Security fixes |

## GitHub Templates

Minimal issue and PR templates included:

- **Bug Report** — `.github/ISSUE_TEMPLATE/bug_report.md`
- **Pull Request** — `.github/PULL_REQUEST_TEMPLATE.md`

Customize in `.github/` directory as needed.

## See Also

- [README.md](../README.md) — Framework overview
