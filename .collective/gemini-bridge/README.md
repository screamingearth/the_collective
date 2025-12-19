# NOTICE

**the_collective** — Multi-agent AI framework  
Copyright © 2025 screamingearth  
Licensed under Mozilla Public License 2.0 (MPL 2.0)

See LICENSE file in this directory for full terms.

---

# gemini-bridge

MCP server providing Google Gemini research tools for >the_collective.

## What is this?

Gives the AI team access to Google's Gemini for research, code review, and second opinions. Different AI model = catches blind spots.

## Quick Start

```bash
# 1. Install
npm install

# 2. Authenticate (pick one)
cp .env.example .env   # Add your API key (recommended)
npm run auth           # Or use browser OAuth

# 3. Build & test
npm run build
npm test
```

## Get an API Key (Recommended)

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Sign in with Google
3. Click "Create API Key"
4. Copy to `.env`:

```bash
cp .env.example .env
# Edit .env: GEMINI_API_KEY=AIza...your-key
```

**Free tier:** 60 req/min, 1500 req/day, no credit card needed.

## Available Tools

| Tool | Purpose |
|------|---------|
| `mcp_gemini_query` | Research, docs, best practices |
| `mcp_gemini_analyze_code` | Code review, security analysis |
| `mcp_gemini_validate` | Second opinions on proposals |

## Switching from OAuth to API Key

Already using OAuth but want faster responses? Add an API key:

```bash
cp .env.example .env
# Edit .env: GEMINI_API_KEY=AIza...your-key
# Restart Docker: docker compose restart gemini-bridge
```

API key is checked first (fast), OAuth is fallback (slower).

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "not authenticated" | Add API key to `.env` or run `npm run auth` |
| Timeout errors | Check network; Gemini typically responds in 2-5s |
| Rate limit | Free tier: 60/min. Wait and retry |

## More Info

- **Full documentation:** [docs/GEMINI_BRIDGE.md](../../docs/GEMINI_BRIDGE.md)
- **System instructions:** [GEMINI.md](../../GEMINI.md)
