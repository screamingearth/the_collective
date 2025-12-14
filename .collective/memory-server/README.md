# NOTICE

**the_collective** — Multi-agent AI framework  
Copyright © 2025 screamingearth  
Licensed under Apache License 2.0

# memory-server

semantic memory for the_collective with retriever-reranker pipeline.

## quick start

```bash
npm install      # install dependencies
npm run build    # compile TypeScript
npm run test     # verify everything works
npm start        # start MCP server
```

## what it does

two-stage search: fast bi-encoder retrieval → precise cross-encoder reranking.

all models run locally. no API calls. first run downloads ~50MB of weights.

## api

| tool | purpose |
|------|---------|
| `store_memory` | save content with type, importance, tags |
| `search_memories` | semantic search with optional reranking |
| `get_recent_memories` | retrieve by recency |
| `delete_memory` | remove by id |

## development

```bash
npm run lint       # check code style
npm run format     # auto-format
npm run validate   # full check
```

## docs

see [MEMORY_ARCHITECTURE.md](../docs/MEMORY_ARCHITECTURE.md) for schema, query patterns, and technical details.
