/*
 * This file is part of >the_collective.
 * Copyright (c) 2025 screamingearth.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Valid memory types that can be stored in the system.
 */
export type MemoryType = "conversation" | "code" | "decision" | "context";

/**
 * Metadata that can be attached to a memory.
 * Uses `unknown` instead of `any` for type safety.
 */
export type MemoryMetadata = Record<string, unknown>;

/**
 * A stored memory record.
 */
export interface Memory {
  id: string;
  content: string;
  memory_type: MemoryType;
  created_at: string;
  updated_at: string;
  metadata?: MemoryMetadata | undefined;
  importance_score: number;
  access_count: number;
  last_accessed?: string | undefined;
}

/**
 * A memory with similarity score from semantic search.
 */
export interface SearchResult extends Memory {
  similarity: number;
}

/**
 * Options for searching memories.
 */
export interface SearchOptions {
  memory_type?: MemoryType | undefined;
  limit?: number | undefined;
  min_similarity?: number | undefined;
  tags?: string[] | undefined;
  /**
   * Whether to use cross-encoder reranking for higher precision.
   * When enabled, retrieves more candidates with bi-encoder, then
   * reranks with cross-encoder for better accuracy.
   * @default true
   */
  useReranker?: boolean | undefined;
  /**
   * How many candidates to retrieve before reranking.
   * Higher values increase recall but also latency.
   * Only used when useReranker is true.
   * @default 3
   */
  retrievalMultiplier?: number | undefined;
}

/**
 * Options for getting recent memories.
 */
export interface RecentMemoriesOptions {
  limit?: number | undefined;
  memory_type?: MemoryType | undefined;
  min_importance?: number | undefined;
}

/**
 * DuckDB row result - typed based on expected query results.
 * We use generics to allow proper typing of different query results.
 */
export interface MemoryRow {
  id: string;
  content: string;
  memory_type: string;
  created_at: string;
  updated_at: string;
  metadata: string | null;
  importance_score: number;
  access_count: number;
  last_accessed: string | null;
}

export interface SearchResultRow extends MemoryRow {
  similarity: number;
}

export interface TagRow {
  id: string;
  tag_name: string;
}

/**
 * Embedder output from @xenova/transformers.
 * The library doesn't export proper types, so we define our own.
 */
export interface EmbedderOutput {
  data: Float32Array;
}

/**
 * Embedder function signature from @xenova/transformers.
 */
export type EmbedderFunction = (
  text: string,
  options: { pooling: string; normalize: boolean }
) => Promise<EmbedderOutput>;

/**
 * Reranker (cross-encoder) output from @xenova/transformers.
 * Returns an array of classification results with relevance scores.
 */
export interface RerankerOutput {
  label: string;
  score: number;
}

/**
 * Reranker function signature from @xenova/transformers.
 * Cross-encoder that scores (query, document) pairs for relevance.
 */
export type RerankerFunction = (
  input: string | string[],
  options?: { topk?: number }
) => Promise<RerankerOutput[] | RerankerOutput[][]>;

/**
 * Configuration for the retriever-reranker pipeline.
 */
export interface RerankerConfig {
  /** Whether reranker is available and initialized */
  enabled: boolean;
  /** Model name used for reranking */
  model: string;
}

/**
 * Logger interface for consistent logging across the application.
 * Uses console.error for MCP server compatibility (stdout is for protocol).
 */
export interface Logger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

/**
 * Creates a logger that outputs to stderr (MCP compatible).
 */
export function createLogger(prefix = ""): Logger {
  const formatPrefix = prefix ? `[${prefix}] ` : "";
  return {
    info: (message: string) => {
      process.stderr.write(`${formatPrefix}${message}\n`);
    },
    warn: (message: string) => {
      console.warn(`${formatPrefix}${message}`);
    },
    error: (message: string) => {
      console.error(`${formatPrefix}${message}`);
    },
  };
}
