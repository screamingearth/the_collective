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

### Option 1: API Key (Recommended - Fast)

Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

```bash
# Add to .env file in gemini-bridge/
echo "GEMINI_API_KEY=your-key-here" > .collective/gemini-bridge/.env

# Or set environment variable
export GEMINI_API_KEY="your-key-here"
```

**Performance:** ~3-5s per query (direct HTTP)  
**Free tier:** 60 req/min, 1000 req/day

### Option 2: Google OAuth (Fallback)

```bash
cd .collective/gemini-bridge
npm run auth
# Follow browser prompt
```

**Performance:** ~10-20s per query (subprocess overhead)  
**Free tier:** 60 req/min, 1000 req/day  
**Note:** Uses gemini-cli subprocess - slower but no API key needed

### Docker Mode: Auth Options

When running the Gemini Bridge in Docker (via `docker compose`), you have two ways to provide credentials to the container:

#### 1) API Key (Recommended - Faster)

- Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- Set it before starting Docker:

```bash
export GEMINI_API_KEY=YOUR_KEY
docker compose up -d
```

- The compose file propagates the variable into the container:

```yaml
services:
  gemini-bridge:
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
```

**Performance:** ~3-5s per query (5x faster than OAuth)

#### 2) OAuth (Fallback)

- Authenticate once on the host:

```bash
cd .collective/gemini-bridge
npm install
npm run auth
```

- The compose file mounts your host credentials directory:

```yaml
services:
  gemini-bridge:
    volumes:
      - ${HOME}/.gemini:/root/.gemini:ro
```

The container detects OAuth credentials in `~/.gemini/google_accounts.json` and uses gemini-cli subprocess.

**Performance:** ~10-20s per query (subprocess overhead)

- Set your API key in the shell before starting compose:

```bash
export GEMINI_API_KEY=YOUR_KEY
docker compose up -d
```

- The compose file propagates the variable into the container:

```yaml
services:
  gemini-bridge:
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
```

The server detects the API key and treats it as authenticated (`authMethod: "api-key"`).

### Verify Authentication (Docker)

```bash
docker logs collective-gemini --tail 30
```

You should see one of:

```
✓ Gemini ready (API key (direct HTTP))
Gemini Bridge running on http://localhost:3101 (SSE mode)
```

or

```
✓ Gemini ready (OAuth (gemini-cli subprocess))
Gemini Bridge running on http://localhost:3101 (SSE mode)
```

If you see a warning about authentication:

- Set `GEMINI_API_KEY` in the shell before `docker compose up`, or
- Run `npm run auth` on the host to set up OAuth credentials

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
