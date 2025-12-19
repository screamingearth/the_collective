# NOTICE

**the_collective** — Multi-agent AI framework  
Copyright © 2025 screamingearth  
Licensed under Mozilla Public License 2.0 (MPL 2.0)

See LICENSE file in this directory for full terms.

---

# memory-server

Semantic memory with production-grade retriever-reranker pipeline.

## What is this?

Persistent memory for >the_collective that actually remembers important context. Uses two-stage search: fast bi-encoder finds candidates, precise cross-encoder ranks them.

**All local.** No API calls, models run on your machine (~50MB download first time).

## Quick Start

```bash
# 1. Install
npm install

# 2. Build & test
npm run build
npm test

# 3. Bootstrap (optional - pre-loads core memories)
npm run bootstrap
```

## Available Tools

| Tool | Purpose |
|------|---------|
| `store_memory` | Save content with type, importance, tags |
| `search_memories` | Semantic search (with optional reranking) |
| `get_recent_memories` | Retrieve by recency |
| `delete_memory` | Remove by ID |

## Quick Examples

```typescript
// Store a memory
store_memory({
  content: "User prefers TypeScript over JavaScript",
  memory_type: "conversation",
  importance: 0.8,
  tags: ["preference", "typescript"]
})

// Search with reranking (default)
search_memories({
  query: "What languages does the user like?",
  limit: 5,
  use_reranker: true  // Precise results
})

// Fast search without reranking
search_memories({
  query: "recent decisions",
  limit: 10,
  use_reranker: false  // Speed over precision
})
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Models not downloading | Check network; ~50MB download on first run |
| Out of memory | Reduce `retrieval_multiplier` in search options |
| Slow queries | Set `use_reranker: false` for speed over precision |

## More Info

- **Architecture deep-dive:** [docs/MEMORY_ARCHITECTURE.md](../../docs/MEMORY_ARCHITECTURE.md)
- **Schema & queries:** [docs/MEMORY_ARCHITECTURE.md#schema-design](../../docs/MEMORY_ARCHITECTURE.md#schema-design)
