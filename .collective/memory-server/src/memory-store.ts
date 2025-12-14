import { pipeline } from "@xenova/transformers";
import Database from "duckdb";
import { mkdir } from "fs/promises";
import { dirname } from "path";
import { v4 as uuidv4 } from "uuid";
import type {
  EmbedderFunction,
  Logger,
  Memory,
  MemoryMetadata,
  MemoryRow,
  MemoryType,
  RecentMemoriesOptions,
  RerankerConfig,
  RerankerFunction,
  SearchOptions,
  SearchResult,
  SearchResultRow,
  TagRow,
} from "./types.js";
import { createLogger } from "./types.js";

// Re-export types for consumers
export type { Memory, MemoryMetadata, MemoryType, SearchResult };

const VALID_MEMORY_TYPES: readonly MemoryType[] = ["conversation", "code", "decision", "context"];
const MAX_CONTENT_LENGTH = 100_000;
const MAX_TAG_LENGTH = 100;
const EMBEDDING_DIMENSIONS = 384;

// Model configuration
const EMBEDDER_MODEL = "Xenova/all-MiniLM-L6-v2";
const RERANKER_MODEL = "Xenova/ms-marco-MiniLM-L-6-v2";

// Default retriever-reranker settings
const DEFAULT_USE_RERANKER = true;
const DEFAULT_RETRIEVAL_MULTIPLIER = 3;
const MAX_RETRIEVAL_MULTIPLIER = 10;

/**
 * Memory store with vector embeddings and cross-encoder reranking using DuckDB.
 *
 * Implements a production-grade Retriever-Reranker pattern:
 * - Stage 1 (Retriever): Fast bi-encoder (MiniLM) for high-recall candidate retrieval
 * - Stage 2 (Reranker): Cross-encoder (MS-MARCO) for high-precision reranking
 *
 * This two-stage approach solves the precision problem inherent in naive
 * vector similarity search by using a more powerful cross-encoder model
 * that can understand query-document relationships jointly.
 */
export class MemoryStore {
  private db!: Database.Database;
  private connection: Database.Connection | null = null;
  private embedder: EmbedderFunction | null = null;
  private reranker: RerankerFunction | null = null;
  private rerankerConfig: RerankerConfig = { enabled: false, model: RERANKER_MODEL };
  private readonly dbPath: string;
  private readonly logger: Logger;
  private isInitialized = false;
  private isClosing = false;

  constructor(dbPath: string) {
    if (!dbPath || typeof dbPath !== "string") {
      throw new Error("Database path must be a non-empty string");
    }
    this.dbPath = dbPath;
    this.logger = createLogger("MemoryStore");
  }

  // ============================================================
  // Validation Methods
  // ============================================================

  private validateMemoryContent(content: string): void {
    if (!content || typeof content !== "string") {
      throw new Error("Memory content must be a non-empty string");
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      throw new Error(`Memory content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters`);
    }
  }

  private validateMemoryType(type: string): asserts type is MemoryType {
    if (!VALID_MEMORY_TYPES.includes(type as MemoryType)) {
      throw new Error(
        `Invalid memory type: ${type}. Must be one of: ${VALID_MEMORY_TYPES.join(", ")}`
      );
    }
  }

  private validateImportance(importance: number): void {
    if (typeof importance !== "number" || importance < 0 || importance > 1) {
      throw new Error("Importance must be a number between 0 and 1");
    }
  }

  private validateTags(tags?: string[]): void {
    if (tags === undefined) {
      return;
    }
    if (!Array.isArray(tags)) {
      throw new Error("Tags must be an array");
    }
    for (const tag of tags) {
      if (typeof tag !== "string" || tag.length === 0) {
        throw new Error("Each tag must be a non-empty string");
      }
      if (tag.length > MAX_TAG_LENGTH) {
        throw new Error(`Tag length must not exceed ${MAX_TAG_LENGTH} characters`);
      }
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error("MemoryStore must be initialized before use. Call initialize() first.");
    }
    if (this.isClosing) {
      throw new Error("MemoryStore is closing and cannot accept new operations");
    }
  }

  // ============================================================
  // Initialization
  // ============================================================

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.logger.warn("MemoryStore is already initialized");
      return;
    }

    try {
      await this.createDatabase();
      await this.setupSchema();
      await this.initializeEmbedder();
      await this.initializeReranker();
      this.isInitialized = true;
      this.logger.info("MemoryStore initialized successfully");
      if (this.rerankerConfig.enabled) {
        this.logger.info(`Reranker enabled: ${this.rerankerConfig.model}`);
      } else {
        this.logger.warn("Reranker not available - using bi-encoder only");
      }
    } catch (error) {
      await this.cleanup();
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to initialize MemoryStore: ${message}`);
    }
  }

  private async createDatabase(): Promise<void> {
    try {
      // Ensure parent directory exists before opening database
      const dirPath = dirname(this.dbPath);
      await mkdir(dirPath, { recursive: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to create database directory: ${message}`);
    }

    await new Promise<void>((resolve, reject) => {
      this.db = new Database.Database(this.dbPath, (err) => {
        if (err) {
          reject(new Error(`Database creation failed: ${err.message}`));
        } else {
          resolve();
        }
      });
    });

    this.connection = this.db.connect();
    if (!this.connection) {
      throw new Error("Failed to create database connection");
    }
  }

  private async initializeEmbedder(): Promise<void> {
    try {
      const embedder = await pipeline("feature-extraction", EMBEDDER_MODEL);
      if (!embedder) {
        throw new Error("Embedder initialization returned null");
      }
      this.embedder = embedder as EmbedderFunction;
      this.logger.info(`Bi-encoder loaded: ${EMBEDDER_MODEL}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to initialize embedder: ${message}`);
    }
  }

  /**
   * Initialize the cross-encoder reranker for Stage 2 precision.
   * If initialization fails, we gracefully degrade to bi-encoder only.
   */
  private async initializeReranker(): Promise<void> {
    try {
      // The MS-MARCO model is a cross-encoder trained for passage reranking
      const reranker = await pipeline("text-classification", RERANKER_MODEL);
      if (!reranker) {
        throw new Error("Reranker initialization returned null");
      }
      this.reranker = reranker as RerankerFunction;
      this.rerankerConfig = { enabled: true, model: RERANKER_MODEL };
      this.logger.info(`Cross-encoder loaded: ${RERANKER_MODEL}`);
    } catch (error) {
      // Graceful degradation - reranker is optional for precision
      const message = error instanceof Error ? error.message : "Unknown error";
      this.logger.warn(`Reranker initialization failed (will use bi-encoder only): ${message}`);
      this.rerankerConfig = { enabled: false, model: RERANKER_MODEL };
    }
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.connection) {
        await new Promise<void>((resolve) => {
          this.connection?.close(() => resolve());
        });
        this.connection = null;
      }
      if (this.db) {
        await new Promise<void>((resolve) => {
          this.db.close(() => resolve());
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Error during cleanup: ${message}`);
    }
  }

  // ============================================================
  // Schema Setup
  // ============================================================

  private async setupSchema(): Promise<void> {
    if (!this.connection) {
      throw new Error("Database connection not established");
    }

    const schemas: { sql: string; desc: string }[] = [
      { sql: "INSTALL vss;", desc: "Installing VSS extension" },
      { sql: "LOAD vss;", desc: "Loading VSS extension" },
      {
        sql: "SET hnsw_enable_experimental_persistence = true;",
        desc: "Enabling HNSW persistence",
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS memories (
          id VARCHAR PRIMARY KEY,
          content TEXT NOT NULL,
          memory_type VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSON,
          importance_score DOUBLE DEFAULT 0.5,
          access_count INTEGER DEFAULT 0,
          last_accessed TIMESTAMP
        );`,
        desc: "Creating memories table",
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS embeddings (
          memory_id VARCHAR PRIMARY KEY,
          embedding FLOAT[${EMBEDDING_DIMENSIONS}]
        );`,
        desc: "Creating embeddings table",
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS tags (
          id VARCHAR PRIMARY KEY,
          tag_name VARCHAR(100) UNIQUE NOT NULL
        );`,
        desc: "Creating tags table",
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS memory_tags (
          memory_id VARCHAR,
          tag_id VARCHAR,
          PRIMARY KEY (memory_id, tag_id)
        );`,
        desc: "Creating memory_tags table",
      },
      {
        sql: `CREATE INDEX IF NOT EXISTS embedding_hnsw_idx ON embeddings USING HNSW(embedding);`,
        desc: "Creating HNSW index",
      },
    ];

    for (const { sql, desc } of schemas) {
      try {
        await this.execAsync<unknown[]>(sql);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        throw new Error(`Failed ${desc}: ${message}`);
      }
    }
  }

  // ============================================================
  // Database Operations
  // ============================================================

  /**
   * Execute a SQL query and return typed results.
   * Uses generics to provide type safety for different query results.
   *
   * Note: DuckDB's TypeScript types are incomplete, so we use type assertions
   * at the boundary. All internal code maintains proper type safety.
   */
  private async execAsync<T>(sql: string, ...params: unknown[]): Promise<T> {
    if (!this.connection) {
      throw new Error("Database connection not established");
    }

    const connection = this.connection;
    return new Promise((resolve, reject) => {
      try {
        // DuckDB's .all() method has incomplete TypeScript definitions.
        // We construct the callback-style call manually and cast as needed.
        (connection.all as (...args: unknown[]) => void)(
          sql,
          ...params,
          (err: Error | null, result: unknown) => {
            if (err) {
              reject(err);
            } else {
              resolve(result as T);
            }
          }
        );
      } catch (error) {
        reject(new Error(String(error)));
      }
    });
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embedder) {
      throw new Error("Embedder not initialized");
    }

    const output = await this.embedder(text, {
      pooling: "mean",
      normalize: true,
    });

    return Array.from(output.data);
  }

  /**
   * Rerank candidates using cross-encoder for higher precision.
   *
   * The cross-encoder evaluates each (query, document) pair jointly,
   * which is fundamentally more powerful than bi-encoder similarity
   * for understanding nuance, negation, and complex relationships.
   *
   * @param query The search query
   * @param candidates Results from Stage 1 retrieval
   * @param limit Final number of results to return
   * @returns Reranked results sorted by cross-encoder relevance
   */
  private async rerankResults(
    query: string,
    candidates: SearchResultRow[],
    limit: number
  ): Promise<SearchResultRow[]> {
    if (!this.reranker || candidates.length === 0) {
      return candidates.slice(0, limit);
    }

    try {
      // Prepare inputs for cross-encoder: "query [SEP] document" format
      // The MS-MARCO model expects this format for passage reranking
      const inputs = candidates.map((candidate) => `${query} [SEP] ${candidate.content}`);

      // Batch rerank all candidates
      const scores = await this.reranker(inputs);

      // Handle both single and batch outputs
      const scoreArray = Array.isArray(scores[0])
        ? (scores as unknown as { score: number }[][]).map((s) => s[0]?.score ?? 0)
        : (scores as unknown as { score: number }[]).map((s) => s.score ?? 0);

      // Attach reranker scores to candidates
      const rerankedCandidates = candidates.map((candidate, idx) => ({
        ...candidate,
        similarity: scoreArray[idx] ?? candidate.similarity,
        _originalSimilarity: candidate.similarity,
      }));

      // Sort by cross-encoder score (higher = more relevant)
      rerankedCandidates.sort((a, b) => b.similarity - a.similarity);

      // Return top results after reranking
      return rerankedCandidates.slice(0, limit);
    } catch (error) {
      // If reranking fails, fall back to original bi-encoder ranking
      const message = error instanceof Error ? error.message : "Unknown error";
      this.logger.warn(`Reranking failed, using bi-encoder results: ${message}`);
      return candidates.slice(0, limit);
    }
  }

  private formatEmbeddingForSQL(embedding: number[]): string {
    return `[${embedding.join(",")}]::FLOAT[${EMBEDDING_DIMENSIONS}]`;
  }

  // ============================================================
  // Public API
  // ============================================================

  async storeMemory(
    content: string,
    memoryType: string,
    importance = 0.5,
    tags?: string[],
    metadata?: MemoryMetadata
  ): Promise<Memory> {
    this.ensureInitialized();

    this.validateMemoryContent(content);
    this.validateMemoryType(memoryType);
    this.validateImportance(importance);
    this.validateTags(tags);

    try {
      const id = uuidv4();
      const embedding = await this.generateEmbedding(content);

      // Insert memory
      await this.execAsync<unknown[]>(
        `INSERT INTO memories (id, content, memory_type, importance_score, metadata)
         VALUES (?, ?, ?, ?, ?)`,
        id,
        content,
        memoryType,
        importance,
        metadata ? JSON.stringify(metadata) : null
      );

      // Insert embedding
      const embeddingSQL = this.formatEmbeddingForSQL(embedding);
      await this.execAsync<unknown[]>(
        `INSERT INTO embeddings (memory_id, embedding) VALUES (?, ${embeddingSQL})`,
        id
      );

      // Handle tags
      if (tags && tags.length > 0) {
        await this.linkTags(id, tags);
      }

      const result = await this.execAsync<MemoryRow[]>(`SELECT * FROM memories WHERE id = ?`, id);

      if (!result || result.length === 0) {
        throw new Error("Failed to retrieve stored memory");
      }

      return this.rowToMemory(result[0]!);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to store memory: ${message}`);
    }
  }

  private async linkTags(memoryId: string, tags: string[]): Promise<void> {
    for (const tagName of tags) {
      const tagResult = await this.execAsync<TagRow[]>(
        `SELECT id FROM tags WHERE tag_name = ?`,
        tagName
      );

      let tagId: string;
      if (tagResult.length === 0) {
        tagId = uuidv4();
        await this.execAsync<unknown[]>(
          `INSERT INTO tags (id, tag_name) VALUES (?, ?)`,
          tagId,
          tagName
        );
      } else {
        tagId = tagResult[0]!.id;
      }

      await this.execAsync<unknown[]>(
        `INSERT INTO memory_tags (memory_id, tag_id) VALUES (?, ?)`,
        memoryId,
        tagId
      );
    }
  }

  private rowToMemory(row: MemoryRow): Memory {
    return {
      id: row.id,
      content: row.content,
      memory_type: row.memory_type as MemoryType,
      created_at: row.created_at,
      updated_at: row.updated_at,
      metadata: row.metadata ? (JSON.parse(row.metadata) as MemoryMetadata) : undefined,
      importance_score: row.importance_score,
      access_count: row.access_count,
      last_accessed: row.last_accessed ?? undefined,
    };
  }

  private searchRowToResult(row: SearchResultRow): SearchResult {
    return {
      ...this.rowToMemory(row),
      similarity: row.similarity,
    };
  }

  async searchMemories(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    this.ensureInitialized();

    if (!query || typeof query !== "string") {
      throw new Error("Search query must be a non-empty string");
    }

    const {
      memory_type,
      limit = 10,
      min_similarity = 0.7,
      tags,
      useReranker = DEFAULT_USE_RERANKER,
      retrievalMultiplier = DEFAULT_RETRIEVAL_MULTIPLIER,
    } = options;

    if (memory_type) {
      this.validateMemoryType(memory_type);
    }
    if (limit < 1 || limit > 100) {
      throw new Error("Limit must be between 1 and 100");
    }
    if (min_similarity < 0 || min_similarity > 1) {
      throw new Error("Minimum similarity must be between 0 and 1");
    }
    if (retrievalMultiplier < 1 || retrievalMultiplier > MAX_RETRIEVAL_MULTIPLIER) {
      throw new Error(`Retrieval multiplier must be between 1 and ${MAX_RETRIEVAL_MULTIPLIER}`);
    }
    this.validateTags(tags);

    try {
      const queryEmbedding = await this.generateEmbedding(query);
      const embeddingSQL = this.formatEmbeddingForSQL(queryEmbedding);

      // Stage 1: Retrieve candidates using bi-encoder (high recall)
      // If reranking is enabled, fetch more candidates for better recall
      const shouldRerank = useReranker && this.rerankerConfig.enabled;
      const retrievalLimit = shouldRerank ? limit * retrievalMultiplier : limit;

      // Use a lower similarity threshold for initial retrieval when reranking
      // The reranker will handle precision, so we optimize for recall here
      const retrievalMinSimilarity = shouldRerank
        ? Math.max(0.3, min_similarity - 0.3)
        : min_similarity;

      const { sql, params } = this.buildSearchQuery(
        embeddingSQL,
        memory_type,
        tags,
        retrievalMinSimilarity,
        retrievalLimit
      );
      const candidates = await this.execAsync<SearchResultRow[]>(sql, ...params);

      // Stage 2: Rerank candidates using cross-encoder (high precision)
      let results: SearchResultRow[];
      if (shouldRerank && candidates.length > 0) {
        results = await this.rerankResults(query, candidates, limit);
      } else {
        results = candidates.slice(0, limit);
      }

      // Filter by min_similarity after reranking (cross-encoder scores are 0-1)
      // Note: Cross-encoder scores are logits, so we don't apply the same threshold
      const filteredResults = shouldRerank
        ? results // Trust the reranker's ordering
        : results.filter((r) => r.similarity >= min_similarity);

      // Update access counts asynchronously (don't block return)
      void this.updateAccessCounts(filteredResults);

      return filteredResults.map((row) => this.searchRowToResult(row));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to search memories: ${message}`);
    }
  }

  private buildSearchQuery(
    embeddingSQL: string,
    memoryType?: MemoryType,
    tags?: string[],
    minSimilarity?: number,
    limit?: number
  ): { sql: string; params: unknown[] } {
    let sql = `
      SELECT 
        m.*,
        array_cosine_similarity(e.embedding, ${embeddingSQL}) as similarity
      FROM memories m
      JOIN embeddings e ON m.id = e.memory_id
    `;

    const params: unknown[] = [];
    const conditions: string[] = [];

    if (memoryType) {
      conditions.push("m.memory_type = ?");
      params.push(memoryType);
    }

    if (tags && tags.length > 0) {
      const placeholders = tags.map(() => "?").join(",");
      conditions.push(`m.id IN (
        SELECT mt.memory_id 
        FROM memory_tags mt 
        JOIN tags t ON mt.tag_id = t.id 
        WHERE t.tag_name IN (${placeholders})
      )`);
      params.push(...tags);
    }

    conditions.push(`array_cosine_similarity(e.embedding, ${embeddingSQL}) >= ?`);
    params.push(minSimilarity ?? 0.7);

    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY similarity DESC LIMIT ?";
    params.push(limit ?? 10);

    return { sql, params };
  }

  private async updateAccessCounts(results: SearchResultRow[]): Promise<void> {
    for (const result of results) {
      try {
        await this.execAsync<unknown[]>(
          `UPDATE memories 
           SET access_count = access_count + 1, 
           last_accessed = CURRENT_TIMESTAMP 
           WHERE id = ?`,
          result.id
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        this.logger.warn(`Failed to update access count for memory ${result.id}: ${message}`);
      }
    }
  }

  async getRecentMemories(options: RecentMemoriesOptions = {}): Promise<Memory[]> {
    this.ensureInitialized();

    const { limit = 20, memory_type, min_importance = 0 } = options;

    if (limit < 1 || limit > 100) {
      throw new Error("Limit must be between 1 and 100");
    }
    if (memory_type) {
      this.validateMemoryType(memory_type);
    }
    if (min_importance < 0 || min_importance > 1) {
      throw new Error("Minimum importance must be between 0 and 1");
    }

    try {
      let sql = "SELECT * FROM memories WHERE importance_score >= ?";
      const params: unknown[] = [min_importance];

      if (memory_type) {
        sql += " AND memory_type = ?";
        params.push(memory_type);
      }

      sql += " ORDER BY created_at DESC LIMIT ?";
      params.push(limit);

      const results = await this.execAsync<MemoryRow[]>(sql, ...params);
      return results.map((row) => this.rowToMemory(row));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to get recent memories: ${message}`);
    }
  }

  async deleteMemory(memoryId: string): Promise<void> {
    this.ensureInitialized();

    if (!memoryId || typeof memoryId !== "string") {
      throw new Error("Memory ID must be a non-empty string");
    }

    try {
      await this.execAsync<unknown[]>("DELETE FROM memory_tags WHERE memory_id = ?", memoryId);
      await this.execAsync<unknown[]>("DELETE FROM embeddings WHERE memory_id = ?", memoryId);
      await this.execAsync<unknown[]>("DELETE FROM memories WHERE id = ?", memoryId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to delete memory: ${message}`);
    }
  }

  async close(): Promise<void> {
    if (!this.isInitialized) {
      this.logger.warn("MemoryStore is not initialized, nothing to close");
      return;
    }

    if (this.isClosing) {
      this.logger.warn("MemoryStore is already closing");
      return;
    }

    this.isClosing = true;

    try {
      await new Promise<void>((resolve) => {
        if (this.connection) {
          this.connection.close(() => {
            this.connection = null;
            if (this.db) {
              this.db.close(() => {
                this.finishClose();
                resolve();
              });
            } else {
              this.finishClose();
              resolve();
            }
          });
        } else if (this.db) {
          this.db.close(() => {
            this.finishClose();
            resolve();
          });
        } else {
          this.finishClose();
          resolve();
        }
      });
      this.logger.info("MemoryStore closed successfully");
    } catch (error) {
      this.isClosing = false;
      const message = error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to close MemoryStore: ${message}`);
    }
  }

  private finishClose(): void {
    this.isInitialized = false;
    this.isClosing = false;
  }

  /**
   * Check if the reranker (cross-encoder) is available.
   * Useful for diagnostics and testing.
   */
  isRerankerEnabled(): boolean {
    return this.rerankerConfig.enabled;
  }

  /**
   * Get the current reranker configuration.
   */
  getRerankerConfig(): RerankerConfig {
    return { ...this.rerankerConfig };
  }
}
