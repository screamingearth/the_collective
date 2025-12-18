# Gemini Bridge - Research Tools

Google Gemini (gemini-2.5-flash) via MCP. Provides cognitive diversity for the_collective team.

## Why Gemini Tools?

Different AI model = different perspective = catches blind spots. The team uses Gemini for:

- **Research** — Documentation lookup, best practices, alternatives
- **Code Review** — Issue identification, security analysis, explanations
- **Validation** — Second opinions on proposals, risk assessment
- **Cognitive Diversity** — Prevents team groupthink

**Free Tier:** 60 requests/minute, 1000 requests/day (Google account only)

## Setup

**All commands below run from workspace root unless specified otherwise.**

### 1. Install Dependencies

```bash
cd .collective/gemini-bridge
npm install
```

### 2. Authenticate

```bash
npm run auth
```

Opens browser for Google OAuth (secure, no credentials stored).

### 3. Build

```bash
npm run build
```

### 4. Verify

```bash
npm test
```

## Usage

### Three Research Tools

**`mcp_gemini_query`** — Research, documentation, best practices

```typescript
mcp_gemini_query({
  prompt: "What are current JWT best practices for Node.js?"
})
```

**`mcp_gemini_analyze_code`** — Code review, security, explanations

```typescript
mcp_gemini_analyze_code({
  code: "const hash = md5(password);",
  question: "Security issues?"
})
```

**`mcp_gemini_validate`** — Second opinions, risk assessment

```typescript
mcp_gemini_validate({
  proposal: "Use MongoDB for flexible schema",
  context: "This is a financial application with ACID requirements"
})
```

### How the_collective Uses It

| Agent | Typical Use |
|-------|------------|
| **Nyx** | Strategic research, validate decisions |
| **Prometheus** | API/docs research, architecture validation |
| **Cassandra** | Security review, risk validation |
| **Apollo** | Code quality, best practices research |

**Workflow Example:**

```
**Nyx:** need to validate this JWT approach

**Prometheus:** [invokes mcp_gemini_query] checking JWT best practices...

**Gemini:** jose library recommended, Ed25519 keys preferred

**Prometheus:** switching to jose

**Cassandra:** [invokes mcp_gemini_validate] validating session rotation...

**Gemini:** approach solid, add refresh token rotation

**Cassandra:** agreed, adding rotation logic
```

User sees unified conversation—Gemini consultation happens seamlessly.

## Configuration

Server auto-starts via `.vscode/mcp.json`:

```jsonc
{
  "servers": {
    "gemini": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/gemini-bridge/dist/mcp-server.js"]
    }
  }
}
```

## Authentication

### Option 1: Google OAuth (Recommended)

```bash
npm run auth
# Follow browser prompt
# Free: 60 req/min, 1000 req/day
```

### Option 2: API Key

```bash
export GEMINI_API_KEY="your-key-from-aistudio.google.com"
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| **"not authenticated"** | Run `npm run auth` |
| **"command not found"** | Run `cd .collective/gemini-bridge && npm install` |
| **Timeout errors** | Gemini typically 2-5s. Check network connection |
| **Rate limit errors** | Free tier: 60 req/min, 1000 req/day. Wait or upgrade |

## See Also

- [MCP_SERVERS.md](MCP_SERVERS.md) — Server configuration
- [Gemini Documentation](https://aistudio.google.com/) — Official docs
- [MCP Spec](https://modelcontextprotocol.io/) — Protocol details
