# Memory System Architecture

Production-grade semantic memory for the_collective, featuring a two-stage **Retriever-Reranker** pipeline.

## Quick Start

```bash
cd .collective/memory-server
npm install
npm run build
npm test

# Optional: Pre-load core memories about the_collective
npm run bootstrap
```

**Models auto-download on first use** (~50MB). All inference runs locally via ONNX Runtime.

## Why Retriever-Reranker?

Most RAG implementations use naive vector similarity:

```
S_naive = sim(BiEncoder(query), BiEncoder(document))
```

This fails on:

- **Precision** — Similar vectors ≠ relevant results
- **Negation** — "Not Python" still matches Python content
- **Nuance** — Complex queries get averaged into meaningless embeddings

### The Production Solution

We implement a two-stage pipeline that decouples **recall** from **precision**:

```
┌─────────────────────────────────────────────────────────────┐
│  Stage 1: RETRIEVER (High Recall)                           │
│  ─────────────────────────────────                          │
│  • Input: Query → BiEncoder → 384-dim embedding             │
│  • Search: HNSW index, O(log n) lookup                      │
│  • Output: Top-K candidates (K = limit × multiplier)        │
│  • Model: all-MiniLM-L6-v2 (local via `@huggingface/transformers` + ONNX Runtime)                           │
│  • Latency: ~10-50ms                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Stage 2: RERANKER (High Precision)                         │
│  ──────────────────────────────────                         │
│  • Input: (query, candidate) pairs                          │
│  • Model: Cross-encoder evaluates jointly                   │
│  • Output: Relevance scores, re-sorted                      │
│  • Model: ms-marco-MiniLM-L-6-v2 (local via `@huggingface/transformers` + ONNX Runtime)                     │
│  • Latency: ~10-30ms per candidate                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Final Results: Top-N, precisely ranked                     │
└─────────────────────────────────────────────────────────────┘
```

### Why Cross-Encoders Win

| Aspect                  | Bi-Encoder                 | Cross-Encoder                 |
| ----------------------- | -------------------------- | ----------------------------- |
| **How it works**        | Encodes q and d separately | Encodes (q, d) together       |
| **Speed**               | Fast (pre-computed)        | Slow (computed at query time) |
| **Accuracy**            | Approximate                | Precise                       |
| **Handles negation**    | ❌                         | ✅                            |
| **Understands context** | Limited                    | Full                          |

The cross-encoder sees the query and document _together_, allowing it to understand relationships that bi-encoders miss.

## Technology Stack

| Component     | Technology                    | Purpose                      |
| ------------- | ----------------------------- | ---------------------------- |
| Database      | DuckDB + VSS extension        | Vector storage + SQL         |
| Bi-Encoder    | Xenova/all-MiniLM-L6-v2       | Fast embedding generation    |
| Cross-Encoder | Xenova/ms-marco-MiniLM-L-6-v2 | Precision reranking          |
| Index         | HNSW                          | Approximate nearest neighbor |
| Interface     | Model Context Protocol        | VS Code integration          |

All models run locally via `@huggingface/transformers` with ONNX Runtime (no external API calls).

## Usage

### Available Tools

**`store_memory`** — Save content with metadata

```typescript
store_memory({
  content: "User prefers TypeScript over JavaScript",
  memory_type: "conversation",  // conversation | code | decision | context
  importance: 0.8,               // 0.0 - 1.0
  tags: ["preference", "typescript"]
})
```

**`search_memories`** — Semantic search with optional reranking

```typescript
// Precise search (default - uses reranker)
search_memories({
  query: "What languages does the user prefer?",
  limit: 5,
  use_reranker: true,           // High precision (default)
  min_similarity: 0.7,           // Bi-encoder threshold
  retrieval_multiplier: 3        // Retrieve 15 candidates, rerank to 5
})

// Fast search (skip reranker)
search_memories({
  query: "recent architecture decisions",
  limit: 10,
  use_reranker: false,           // Speed over precision
  memory_type: "decision"        // Filter by type
})
```

**`get_recent_memories`** — Retrieve by recency

```typescript
get_recent_memories({
  limit: 20,
  memory_type: "conversation",
  min_importance: 0.5
})
```

**`delete_memory`** — Remove by ID

```typescript
delete_memory({
  memory_id: "uuid-here"
})
```

## Schema Design

### Structured Tables

#### `memories`

```sql
CREATE TABLE memories (
    id UUID PRIMARY KEY,
    content TEXT NOT NULL,
    memory_type VARCHAR(50),  -- 'conversation', 'code', 'decision', 'context'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON,
    importance_score FLOAT DEFAULT 0.5,
    access_count INTEGER DEFAULT 0,
    last_accessed TIMESTAMP
);
```

#### `embeddings`

```sql
CREATE TABLE embeddings (
    memory_id UUID REFERENCES memories(id),
    embedding FLOAT[384],  -- Dimension depends on model
    PRIMARY KEY (memory_id)
);
CREATE INDEX embedding_idx ON embeddings USING HNSW(embedding);
```

#### `tags`

```sql
CREATE TABLE tags (
    id UUID PRIMARY KEY,
    tag_name VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE memory_tags (
    memory_id UUID REFERENCES memories(id),
    tag_id UUID REFERENCES tags(id),
    PRIMARY KEY (memory_id, tag_id)
);
```

#### `sessions`

```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY,
    session_name VARCHAR(200),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    metadata JSON
);

CREATE TABLE session_memories (
    session_id UUID REFERENCES sessions(id),
    memory_id UUID REFERENCES memories(id),
    sequence_order INTEGER,
    PRIMARY KEY (session_id, memory_id)
);
```

## Query Patterns

### Two-Stage Search (Default)

```typescript
// Stage 1: Retrieve candidates with bi-encoder
const candidates = await vectorSearch(query, {
  limit: requestedLimit * 3, // Over-fetch for recall
  minSimilarity: 0.3, // Relaxed threshold
});

// Stage 2: Rerank with cross-encoder
const reranked = await crossEncoder.rank(query, candidates);
return reranked.slice(0, requestedLimit);
```

### Semantic Search (SQL)

```sql
-- Stage 1: Vector similarity retrieval
SELECT m.id, m.content, m.memory_type,
       array_cosine_similarity(e.embedding, ?::FLOAT[]) as similarity
FROM memories m
JOIN embeddings e ON m.id = e.memory_id
WHERE memory_type = ?
ORDER BY similarity DESC
LIMIT ?;  -- Fetch 3x requested for reranking
```

### Temporal Queries

```sql
-- Recent memories with high importance
SELECT * FROM memories
WHERE created_at > NOW() - INTERVAL '7 days'
  AND importance_score > 0.7
ORDER BY created_at DESC;
```

### Hybrid Search

```sql
-- Combine semantic similarity with metadata filters
SELECT m.id, m.content, similarity
FROM memories m
JOIN embeddings e ON m.id = e.memory_id,
     LATERAL (
         SELECT array_cosine_similarity(e.embedding, ?::FLOAT[]) as similarity
     ) sim
WHERE m.memory_type = ?
  AND similarity > 0.3  -- Relaxed for reranking stage
  AND m.created_at > ?
ORDER BY similarity DESC
LIMIT ?;  -- Over-fetch, then rerank
```

## Search Options

| Option                 | Default | Description                     |
| ---------------------- | ------- | ------------------------------- |
| `limit`                | 10      | Final results after reranking   |
| `min_similarity`       | 0.7     | Bi-encoder threshold            |
| `use_reranker`         | true    | Enable cross-encoder stage      |
| `retrieval_multiplier` | 3       | Candidates = limit × multiplier |
| `memory_type`          | —       | Filter by type                  |
| `tags`                 | —       | Filter by tags                  |

### Speed vs Precision Tradeoff

```typescript
// Maximum precision (default)
{ useReranker: true, retrievalMultiplier: 3 }
// Latency: ~200-500ms, Precision: High

// Balanced
{ useReranker: true, retrievalMultiplier: 2 }
// Latency: ~150-300ms, Precision: Good

// Speed priority
{ useReranker: false }
// Latency: ~50-100ms, Precision: Lower
```

## Data Flow

### Storage Pipeline

```
User Input
    │
    ▼
┌─────────────────────────────┐
│  Bi-Encoder (MiniLM)        │
│  Text → 384-dim embedding   │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  DuckDB                     │
│  • memories table (content) │
│  • embeddings table (vec)   │
│  • HNSW index               │
└─────────────────────────────┘
```

### Retrieval Pipeline

```
Search Query
    │
    ▼
┌─────────────────────────────┐
│  Stage 1: Retriever         │
│  Query → Embedding → HNSW   │
│  Output: Top-K candidates   │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  Stage 2: Reranker          │
│  CrossEncoder(q, doc)       │
│  Output: Re-sorted by       │
│  relevance score            │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  Post-processing            │
│  • Update access counts     │
│  • Apply final filters      │
│  • Return top N             │
└─────────────────────────────┘
```

## Autonomous Memory Formation

the_collective uses autonomous memory—agents decide when to remember without explicit user commands.

### Automatic Storage Triggers

**High Importance (0.8-1.0):**

- User corrections or explicit feedback
- Architectural decisions ("using PostgreSQL for persistence")
- Critical bugs or security issues discovered
- Project requirements or constraints

**Medium Importance (0.5-0.7):**

- User preferences and workflow patterns
- Tool choices and configuration decisions
- Coding style preferences
- Library/framework evaluations

**Low Importance (0.3-0.5):**

- General project context
- File structure observations
- Minor implementation details

### Proactive Recall Triggers

- **Conversation start:** Search for prior workspace context
- **Similar problems:** Query when user describes an issue you've seen before
- **Major decisions:** Check if you've already evaluated an approach
- **User mentions past work:** Recall details automatically

### Memory Hygiene Rules

- **Tag everything:** Project name, language, domain, file paths
- **Use metadata:** Store file paths, dates, related issues, git branches
- **No duplicates:** Update importance instead of creating duplicate memories
- **Consolidate:** Merge similar memories to reduce noise
- **Ephemeral data:** Don't store temporary debugging info or throwaway code

## Portability

- **Single file:** DuckDB database is one portable file
- **No server:** Embedded database, no process management
- **Local models:** Weights cached in `~/.cache/huggingface`
- **Export:** Use Parquet for data migration

---

## Testing & Management

### Quick Commands

```bash
# Full setup (first time)
./setup.sh

# Test memory system (from workspace root)
cd .collective/memory-server && npm run test

# Bootstrap fresh memories
cd .collective/memory-server
rm -f ../../.mcp/collective_memory.duckdb*
npm run bootstrap
```

### Troubleshooting

| Problem              | Fix                                                                            |
| -------------------- | ------------------------------------------------------------------------------ |
| No embeddings        | First run downloads ~50MB models                                               |
| Database corruption  | `rm .mcp/collective_memory.duckdb* && cd .collective/memory-server && npm run bootstrap`   |
| TypeScript errors    | `cd .collective/memory-server && rm -rf dist node_modules && npm install && npm run build` |
| Reranker not loading | Check memory—cross-encoder needs ~200MB RAM                                    |

---

## Future Considerations

### What We Don't Use (and Why)

**Query Transformers (HyDE, Multi-Query):**

- Adds LLM call latency _before_ retrieval
- Useful for bad queries, but our use case has well-formed agent queries

**Graph RAG:**

- Requires upfront schema design and ETL
- Best for structured, multi-hop queries
- Our memories are unstructured—vector search fits better

### Potential Enhancements

1. **Hybrid BM25 + Vector** — RRF combination for lexical + semantic
2. **Adaptive Retrieval** — Adjust multiplier based on query complexity
3. **Memory Consolidation** — Merge similar memories over time
