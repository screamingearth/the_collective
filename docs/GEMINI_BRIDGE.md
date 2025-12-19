# Gemini Bridge - Research Tools

Google Gemini (gemini-3-flash-preview) via MCP. Provides cognitive diversity for the_collective team.

## Why Gemini Tools?

Different AI model = different perspective = catches blind spots. The team uses Gemini for:

- **Research** — Documentation lookup, best practices, alternatives
- **Code Review** — Issue identification, security analysis, explanations
- **Validation** — Second opinions on proposals, risk assessment
- **Cognitive Diversity** — Prevents team groupthink

**Free Tier:** 60 requests/minute, 1000-1500 requests/day (Google account only)

## Quick Start

```bash
# 1. Install dependencies
cd .collective/gemini-bridge
npm install

# 2. Set up authentication (choose one)
cp .env.example .env        # Then add your API key
# OR
npm run auth                 # Browser-based OAuth

# 3. Build
npm run build

# 4. Verify
npm test
```

## Authentication

### Option 1: API Key (Recommended)

Faster responses (~3-5s), higher daily limit.

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key (starts with `AIza...`)

```bash
cd .collective/gemini-bridge
cp .env.example .env
# Edit .env and paste your key:
# GEMINI_API_KEY=AIza...your-key-here
```

**Free tier:** 60 req/min, 1500 req/day

### Option 2: OAuth (Browser Login)

No API key needed, but slower (~10-20s per query).

```bash
cd .collective/gemini-bridge
npm run auth
# Follow browser prompt to sign in with Google
```

Tokens are stored in `~/.gemini/`.

**Free tier:** 60 req/min, 1000 req/day

## Usage

### Available Tools

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

## Docker Mode

When running via `docker compose`, you need to pass credentials into the container.

### API Key (Recommended)

Set the environment variable before starting:

```bash
export GEMINI_API_KEY=your-key-here
docker compose up -d
```

The compose file propagates it into the container:

```yaml
services:
  gemini-bridge:
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
```

**Performance:** ~3-5s per query

### OAuth (Fallback)

First authenticate on your host machine:

```bash
cd .collective/gemini-bridge
npm install
npm run auth
```

The compose file mounts your credentials:

```yaml
services:
  gemini-bridge:
    volumes:
      - ${HOME}/.gemini:/root/.gemini:rw
```

**Performance:** ~10-20s per query (subprocess overhead)

### Verify Docker Auth

```bash
docker logs collective-gemini --tail 5
```

You should see:

```
✓ Gemini ready (API key (direct HTTP))
```

or

```
✓ Gemini ready (OAuth (gemini-cli subprocess))
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| **"not authenticated"** | Set `GEMINI_API_KEY` in `.env` or run `npm run auth` |
| **"command not found"** | Run `cd .collective/gemini-bridge && npm install` |
| **Timeout errors** | Check network connection. Gemini typically responds in 2-5s |
| **Rate limit errors** | Free tier: 60 req/min. Wait a minute or check daily limit |
| **Docker auth issues** | Run `npm run auth` on host, then restart container |

## See Also

- [MCP_SERVERS.md](MCP_SERVERS.md) — Server configuration
- [Gemini Documentation](https://aistudio.google.com/) — Official docs
- [MCP Spec](https://modelcontextprotocol.io/) — Protocol details
