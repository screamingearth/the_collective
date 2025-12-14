#!/usr/bin/env node

/**
 * the_collective Memory Server
 * 
 * Part of the_collective by screamingearth
 * Copyright © 2025 screamingearth. Licensed under Apache License 2.0.
 * the_collective, Nyx, Prometheus, Cassandra, and Apollo are trademarks of screamingearth.
 * See NOTICE and LICENSE files for details.
 *
 * MCP server providing semantic memory storage and retrieval.
 * Uses DuckDB with vector embeddings for similarity search.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { MemoryStore, type MemoryMetadata } from "./memory-store.js";
import { createLogger } from "./types.js";

const logger = createLogger("Server");

/**
 * Tool argument types for type-safe argument handling.
 */
interface StoreMemoryArgs {
  content: string;
  memory_type: string;
  importance?: number;
  tags?: string[];
  metadata?: MemoryMetadata;
}

interface SearchMemoriesArgs {
  query: string;
  memory_type?: string;
  limit?: number;
  min_similarity?: number;
  tags?: string[];
  use_reranker?: boolean;
  retrieval_multiplier?: number;
}

interface GetRecentMemoriesArgs {
  limit?: number;
  memory_type?: string;
  min_importance?: number;
}

interface DeleteMemoryArgs {
  memory_id: string;
}

type ToolArgs = StoreMemoryArgs | SearchMemoriesArgs | GetRecentMemoriesArgs | DeleteMemoryArgs;

const MEMORY_TOOLS: Tool[] = [
  {
    name: "store_memory",
    description: "Store a memory with semantic embeddings for later retrieval",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The content to remember",
        },
        memory_type: {
          type: "string",
          enum: ["conversation", "code", "decision", "context"],
          description: "Type of memory being stored",
        },
        importance: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Importance score (0-1)",
          default: 0.5,
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Optional tags for categorization",
        },
        metadata: {
          type: "object",
          description: "Additional metadata",
        },
      },
      required: ["content", "memory_type"],
    },
  },
  {
    name: "search_memories",
    description:
      "Search memories using semantic similarity with cross-encoder reranking for high precision. Uses a two-stage retriever-reranker pipeline: Stage 1 retrieves candidates with fast bi-encoder, Stage 2 reranks with accurate cross-encoder.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query text",
        },
        memory_type: {
          type: "string",
          enum: ["conversation", "code", "decision", "context"],
          description: "Filter by memory type",
        },
        limit: {
          type: "number",
          minimum: 1,
          maximum: 100,
          default: 10,
          description: "Maximum number of results",
        },
        min_similarity: {
          type: "number",
          minimum: 0,
          maximum: 1,
          default: 0.7,
          description: "Minimum similarity threshold (for bi-encoder stage)",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Filter by tags",
        },
        use_reranker: {
          type: "boolean",
          default: true,
          description:
            "Whether to use cross-encoder reranking for higher precision. Disable for faster but less accurate results.",
        },
        retrieval_multiplier: {
          type: "number",
          minimum: 1,
          maximum: 10,
          default: 3,
          description:
            "How many candidates to retrieve before reranking. Higher values increase recall but also latency.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_recent_memories",
    description: "Get recent memories with optional filters",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          minimum: 1,
          maximum: 100,
          default: 20,
        },
        memory_type: {
          type: "string",
          enum: ["conversation", "code", "decision", "context"],
        },
        min_importance: {
          type: "number",
          minimum: 0,
          maximum: 1,
          default: 0,
        },
      },
    },
  },
  {
    name: "delete_memory",
    description: "Delete a specific memory by ID",
    inputSchema: {
      type: "object",
      properties: {
        memory_id: {
          type: "string",
          description: "UUID of the memory to delete",
        },
      },
      required: ["memory_id"],
    },
  },
];

function isStoreMemoryArgs(args: ToolArgs): args is StoreMemoryArgs {
  return "content" in args && "memory_type" in args;
}

function isSearchMemoriesArgs(args: ToolArgs): args is SearchMemoriesArgs {
  return "query" in args;
}

function isGetRecentMemoriesArgs(args: ToolArgs): args is GetRecentMemoriesArgs {
  return !("content" in args) && !("query" in args) && !("memory_id" in args);
}

function isDeleteMemoryArgs(args: ToolArgs): args is DeleteMemoryArgs {
  return "memory_id" in args;
}

async function handleToolCall(
  name: string,
  args: ToolArgs,
  memoryStore: MemoryStore
): Promise<{ content: { type: string; text: string }[]; isError?: boolean }> {
  try {
    switch (name) {
      case "store_memory": {
        if (!isStoreMemoryArgs(args)) {
          throw new Error("Invalid arguments for store_memory");
        }
        const result = await memoryStore.storeMemory(
          args.content,
          args.memory_type,
          args.importance,
          args.tags,
          args.metadata
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, memory_id: result.id }),
            },
          ],
        };
      }

      case "search_memories": {
        if (!isSearchMemoriesArgs(args)) {
          throw new Error("Invalid arguments for search_memories");
        }
        const searchOptions = {
          ...(args.memory_type !== undefined && {
            memory_type: args.memory_type as "conversation" | "code" | "decision" | "context",
          }),
          ...(args.limit !== undefined && { limit: args.limit }),
          ...(args.min_similarity !== undefined && { min_similarity: args.min_similarity }),
          ...(args.tags !== undefined && { tags: args.tags }),
          ...(args.use_reranker !== undefined && { useReranker: args.use_reranker }),
          ...(args.retrieval_multiplier !== undefined && {
            retrievalMultiplier: args.retrieval_multiplier,
          }),
        };
        const results = await memoryStore.searchMemories(args.query, searchOptions);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case "get_recent_memories": {
        if (!isGetRecentMemoriesArgs(args)) {
          throw new Error("Invalid arguments for get_recent_memories");
        }
        const recentOptions = {
          ...(args.limit !== undefined && { limit: args.limit }),
          ...(args.memory_type !== undefined && {
            memory_type: args.memory_type as "conversation" | "code" | "decision" | "context",
          }),
          ...(args.min_importance !== undefined && { min_importance: args.min_importance }),
        };
        const results = await memoryStore.getRecentMemories(recentOptions);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case "delete_memory": {
        if (!isDeleteMemoryArgs(args)) {
          throw new Error("Invalid arguments for delete_memory");
        }
        await memoryStore.deleteMemory(args.memory_id);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true }),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: error instanceof Error ? error.message : "Unknown error",
          }),
        },
      ],
      isError: true,
    };
  }
}

async function main(): Promise<void> {
  const dbPath = process.env.MEMORY_DB_PATH ?? "../.mcp/collective_memory.duckdb";
  const memoryStore = new MemoryStore(dbPath);
  await memoryStore.initialize();

  const server = new Server(
    {
      name: "collective-memory-server",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: MEMORY_TOOLS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (!args) {
      throw new Error("Missing arguments");
    }

    return handleToolCall(name, args as ToolArgs, memoryStore);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("Collective Memory Server running on stdio");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  logger.error(`Fatal error: ${message}`);
  process.exit(1);
});
