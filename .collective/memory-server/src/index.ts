#!/usr/bin/env node

/*
 * This file is part of >the_collective.
 * Copyright (c) 2025 screamingearth.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import express from "express";
import http from "http";
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

  // Detect transport mode from environment
  const transportMode = process.env.MCP_TRANSPORT?.toLowerCase() ?? "stdio";

  if (transportMode === "sse") {
    // SSE mode for Docker deployment using modern StreamableHTTPServerTransport
    const port = parseInt(process.env.MCP_PORT ?? "3100", 10);
    const app = express();
    const httpServer = http.createServer(app);

    // Track active sessions for monitoring
    const activeSessions = new Set<string>();
    const MAX_ACTIVE_SESSIONS = parseInt(process.env.MAX_SESSIONS ?? "1000", 10);

    // Create transport with proper session management
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => {
        if (activeSessions.size >= MAX_ACTIVE_SESSIONS) {
          logger.warn(`Max session limit reached (${MAX_ACTIVE_SESSIONS}), rejecting new session`);
          throw new Error("Server at capacity");
        }
        return randomUUID();
      },
      onsessioninitialized: (sessionId: string) => {
        activeSessions.add(sessionId);
        logger.info(`Session initialized: ${sessionId} (${activeSessions.size}/${MAX_ACTIVE_SESSIONS})`);
      },
      onsessionclosed: (sessionId: string) => {
        activeSessions.delete(sessionId);
        logger.info(`Session closed: ${sessionId} (${activeSessions.size}/${MAX_ACTIVE_SESSIONS})`);
      },
    });

    // DNS Rebinding Protection Middleware
    // Manually backported from MCP SDK 1.24.0 to mitigate CVE-2025-66414
    // Validates Host header to prevent DNS rebinding attacks
    app.use((req, res, next) => {
      const host = req.headers.host;
      if (host && !host.startsWith('localhost:') && !host.startsWith('127.0.0.1:') && host !== 'localhost' && host !== '127.0.0.1') {
        logger.warn(`DNS rebinding protection: rejected request with suspicious Host header: ${host}`);
        res.status(400).json({ error: "Invalid Host header" });
        return;
      }
      next();
    });

    // Middleware to parse JSON
    app.use(express.json());

    // Health check endpoint for Docker
    app.get("/health", (_req, res) => {
      res.status(200).json({ status: "healthy", service: "collective-memory" });
    });

    // Universal MCP endpoint - handles GET (SSE), POST (messages), and DELETE (close)
    app.all("/mcp", async (req: express.Request, res: express.Response) => {
      try {
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        logger.error(`Error handling MCP request: ${String(error)}`);
        if (!res.headersSent) {
          res.status(500).json({ error: "Internal server error" });
        }
      }
    });

    // Connect server to transport
    await server.connect(transport as Transport);

    httpServer.listen(port, () => {
      logger.info(`Collective Memory Server running on http://localhost:${port}/mcp (SSE mode)`);
    });

    // Graceful shutdown handlers
    async function gracefulShutdown(signal: string): Promise<void> {
      logger.info(`${signal} received, starting graceful shutdown...`);

      // Stop accepting new connections
      httpServer.close(() => {
        logger.info("HTTP server closed, no more new connections");
      });

      // Close transport
      try {
        await transport.close();
        logger.info("MCP transport closed");
      } catch (err) {
        logger.error(`Error closing transport: ${String(err)}`);
      }

      logger.info("Graceful shutdown complete");
      process.exit(0);
    }

    process.on("SIGTERM", () => {
      void gracefulShutdown("SIGTERM");
    });
    process.on("SIGINT", () => {
      void gracefulShutdown("SIGINT");
    });

    // Prevent crash on unhandled errors - keep server running indefinitely
    process.on("uncaughtException", (error: Error) => {
      logger.error(`❌ UNCAUGHT EXCEPTION (server continuing): ${error.message}`);
      logger.error(error.stack ?? "");
      // Don't exit - keep the server running
    });

    process.on("unhandledRejection", (reason: unknown) => {
      logger.error(`❌ UNHANDLED REJECTION (server continuing): ${String(reason)}`);
      if (reason instanceof Error) {
        logger.error(reason.stack ?? "");
      }
      // Don't exit - keep the server running
    });
  } else {
    // stdio mode for local VS Code
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info("Collective Memory Server running on stdio");
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  logger.error(`Fatal error: ${message}`);
  process.exit(1);
});
