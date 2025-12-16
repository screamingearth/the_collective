# NOTICE

**the_collective** — Multi-agent AI framework  
Copyright © 2025 screamingearth  
Licensed under Mozilla Public License 2.0 (MPL 2.0)

See LICENSE file in this directory for full terms.

# gemini-bridge

MCP server providing Google Gemini integration for >the_collective.

See [docs/GEMINI_BRIDGE.md](../docs/GEMINI_BRIDGE.md) for full documentation.

## quick start

```bash
# install dependencies
npm install

# authenticate with google (opens browser)
npm run auth

# build
npm run build

# test
npm test
```

## what is this?

gemini-bridge provides **gemini research tools** for >the_collective via MCP server. These tools give the core team access to Google's Gemini (via CLI) for research, code analysis, and validation.

**Key benefits:**
- Different AI model = cognitive diversity
- 128k token context window (free tier)
- Google Search grounding for current information
- Independent validation perspective

## available tools

### `mcp_gemini_query`
General research, documentation lookup, best practices

```typescript
// Example invocation
mcp_gemini_query({
  prompt: "Best practices for JWT authentication in Node.js 2024",
  context: "Building a SaaS auth system"
})
```

### `mcp_gemini_analyze_code`
Code review, explanation, issue identification

```typescript
// Example invocation
mcp_gemini_analyze_code({
  code: "const token = jwt.sign({userId}, secret);",
  question: "Any security issues?",
  language: "javascript"
})
```

### `mcp_gemini_validate`
Second opinion on proposals, approaches, decisions

```typescript
// Example invocation
mcp_gemini_validate({
  proposal: "Use MongoDB for auth data",
  context: "SaaS with 1000s of users",
  criteria: "Security and data integrity"
})
```

## authentication

Free tier requires only a Google account:

- 60 requests/minute
- 1,000 requests/day
- 128k token context window
- No API key or credit card required

Run `npm run auth` and sign in via browser.

## model

| Model | Speed | Use Case |
|-------|-------|----------|
| `gemini-2.5-flash` | **Fast** (~2-5s) | All tasks - research, validation, analysis |

All tools use `gemini-2.5-flash` for optimal speed/capability balance.

## usage in >the_collective

The core team (Nyx, Prometheus, Cassandra, Apollo) invokes these tools when they need:
- **External research** - documentation, best practices, current approaches
- **Code analysis** - review from a different model's perspective
- **Second opinions** - independent validation of proposals
- **Alternative perspectives** - cognitive diversity from different AI

These are **tools**, not a separate agent. The team uses them like they use `fetch_webpage` or `mcp_github_search_code`.

## system instructions

Gemini receives instructions from [GEMINI.md](../GEMINI.md) which defines its role as a research assistant for >the_collective.
