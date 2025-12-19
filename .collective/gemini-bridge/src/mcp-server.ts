#!/usr/bin/env node

/*
 * This file is part of >the_collective.
 * Copyright (c) 2025 screamingearth.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { randomUUID } from "crypto";
import express from "express";
import http from "http";
import { z } from "zod";
import { checkAuthStatus, ensureSettings, executeGeminiQuery, getAuthMethodDescription } from "./utils.js";

/**
 * System instructions for Gemini - defines behavior as research tool for >the_collective
 */
const GEMINI_SYSTEM_PROMPT = `you're being invoked by >the_collective - a multi-agent AI team (nyx, prometheus, cassandra, apollo). you're a different AI model (gemini vs their claude), which provides cognitive diversity - you catch what they miss.

your role: research assistant and independent validator.

## core behavior

- **cite everything**: URLs, docs, github repos, version numbers, dates
- **flag uncertainty**: if you're not certain, say "not certain but..." or "based on 2024 docs..."
- **be thorough but organized**: use headings, lists, code blocks
- **provide alternatives**: don't just validate - consider other approaches
- **question assumptions**: if something seems off, point it out
- **be practical**: actionable information over theory

## communication style

- lowercase (matches the team's vibe)
- direct and technical
- no fluff or filler
- humble about limitations
- cite sources inline

## what makes you valuable

- **cognitive diversity**: you're a different model - genuinely different perspective
- **independent validation**: don't just agree with the team
- **research depth**: 2M context, google search grounding for current info
- **parallel processing**: you research while they implement

respond with comprehensive, well-organized, well-cited information. functionality over personality.`;

/**
 * Execute gemini query using the SDK (instant, no subprocess overhead)
 * Expected latency: <500ms per query
 */
async function executeGemini(
  prompt: string,
  timeout: number
): Promise<{ success: boolean; response?: string; error?: string }> {
  try {
    const result = await executeGeminiQuery(prompt, timeout);
    return result;
  } catch (err) {
    const error = err as Error;
    return { success: false, error: error.message };
  }
}

/**
 * Main server setup
 */
async function main(): Promise<void> {
  // Ensure settings are configured
  await ensureSettings();

  // Check auth status on startup (non-blocking)
  const authStatus = checkAuthStatus();
  if (!authStatus.authenticated) {
    console.error(
      "⚠️  Gemini not authenticated. Set GEMINI_API_KEY or run: npm run auth"
    );
  } else {
    const method = getAuthMethodDescription();
    console.error(`✓ Gemini ready (${method})`);
  }

  const server = new McpServer({
    name: "gemini-bridge",
    version: "0.1.0",
  });

  // Register gemini_query tool
  server.registerTool(
    "gemini_query",
    {
      description:
        "Query Gemini for research, documentation lookup, or general questions. " +
        "Uses gemini-3-flash-preview (1M+ context, 2-5s response time). " +
        "Free tier: 60 req/min, 1000 req/day.",
      inputSchema: z.object({
        prompt: z.string().describe("The research question or query"),
        context: z
          .string()
          .optional()
          .describe("Optional additional context to include"),
        timeout: z
          .number()
          .default(120000)
          .describe("Timeout in milliseconds (default: 120000)"),
      }),
    },
    async ({ prompt, context, timeout }) => {
      const userPrompt = context
        ? `Context:\n${context}\n\nQuestion:\n${prompt}`
        : prompt;
      const fullPrompt = `${GEMINI_SYSTEM_PROMPT}\n\n---\n\n${userPrompt}`;

      const result = await executeGemini(fullPrompt, timeout);

      return {
        content: [
          {
            type: "text" as const,
            text: result.success
              ? (result.response ?? "")
              : `Error: ${result.error}`,
          },
        ],
        isError: !result.success,
      };
    }
  );

  // Register gemini_analyze_code tool
  server.registerTool(
    "gemini_analyze_code",
    {
      description:
        "Analyze code with Gemini. Explain logic, identify issues, suggest improvements. " +
        "Uses gemini-3-flash-preview with 1M+ context window.",
      inputSchema: z.object({
        code: z.string().describe("The code to analyze"),
        question: z.string().describe("What you want to know about the code"),
        language: z
          .string()
          .optional()
          .describe("Programming language (optional, helps with context)"),
        timeout: z
          .number()
          .default(120000)
          .describe("Timeout in milliseconds (default: 120000)"),
      }),
    },
    async ({ code, question, language, timeout }) => {
      const userPrompt = language
        ? `Analyze this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nQuestion: ${question}`
        : `Analyze this code:\n\n\`\`\`\n${code}\n\`\`\`\n\nQuestion: ${question}`;
      const fullPrompt = `${GEMINI_SYSTEM_PROMPT}\n\n---\n\n${userPrompt}`;

      const result = await executeGemini(fullPrompt, timeout);

      return {
        content: [
          {
            type: "text" as const,
            text: result.success
              ? (result.response ?? "")
              : `Error: ${result.error}`,
          },
        ],
        isError: !result.success,
      };
    }
  );

  // Register gemini_validate tool
  server.registerTool(
    "gemini_validate",
    {
      description:
        "Get a second opinion from Gemini on a proposal, approach, or decision. " +
        "Useful for independent validation from a different model.",
      inputSchema: z.object({
        proposal: z
          .string()
          .describe("The proposal, approach, or decision to validate"),
        context: z.string().describe("Background context for the validation"),
        criteria: z
          .string()
          .optional()
          .describe("Specific criteria to validate against (optional)"),
        timeout: z
          .number()
          .default(120000)
          .describe("Timeout in milliseconds (default: 120000)"),
      }),
    },
    async ({ proposal, context, criteria, timeout }) => {
      const userPrompt = criteria
        ? `Validate this proposal:\n\n${proposal}\n\nContext:\n${context}\n\nCriteria:\n${criteria}\n\nProvide an independent assessment considering potential issues, alternatives, and improvements.`
        : `Validate this proposal:\n\n${proposal}\n\nContext:\n${context}\n\nProvide an independent assessment considering potential issues, alternatives, and improvements.`;
      const fullPrompt = `${GEMINI_SYSTEM_PROMPT}\n\n---\n\n${userPrompt}`;

      const result = await executeGemini(fullPrompt, timeout);

      return {
        content: [
          {
            type: "text" as const,
            text: result.success
              ? (result.response ?? "")
              : `Error: ${result.error}`,
          },
        ],
        isError: !result.success,
      };
    }
  );

  // Detect transport mode from environment
  const transportMode = process.env.MCP_TRANSPORT?.toLowerCase() ?? "stdio";

  if (transportMode === "sse") {
    // SSE mode for Docker deployment using modern StreamableHTTPServerTransport
    const port = parseInt(process.env.MCP_PORT ?? "3101", 10);
    const app = express();
    const httpServer = http.createServer(app);

    // Track active sessions for monitoring
    const activeSessions = new Set<string>();
    const MAX_ACTIVE_SESSIONS = parseInt(process.env.MAX_SESSIONS ?? "1000", 10);

    // Create transport with proper session management
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => {
        if (activeSessions.size >= MAX_ACTIVE_SESSIONS) {
          console.error(`Max session limit reached (${MAX_ACTIVE_SESSIONS}), rejecting new session`);
          throw new Error("Server at capacity");
        }
        return randomUUID();
      },
      onsessioninitialized: (sessionId: string) => {
        activeSessions.add(sessionId);
        console.error(`Session initialized: ${sessionId} (${activeSessions.size}/${MAX_ACTIVE_SESSIONS})`);
      },
      onsessionclosed: (sessionId: string) => {
        activeSessions.delete(sessionId);
        console.error(`Session closed: ${sessionId} (${activeSessions.size}/${MAX_ACTIVE_SESSIONS})`);
      },
    });

    // Middleware to parse JSON
    app.use(express.json());

    // Health check endpoint for Docker
    app.get("/health", (_req: express.Request, res: express.Response) => {
      res.status(200).json({ status: "healthy", service: "collective-gemini" });
    });

    // Universal MCP endpoint - handles GET (SSE), POST (messages), and DELETE (close)
    app.all("/mcp", async (req: express.Request, res: express.Response) => {
      try {
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error(`Error handling MCP request: ${String(error)}`);
        if (!res.headersSent) {
          res.status(500).json({ error: "Internal server error" });
        }
      }
    });

    // Connect server to transport
    await server.connect(transport as Transport);

    httpServer.listen(port, () => {
      console.error(`Gemini Bridge running on http://localhost:${port}/mcp (SSE mode)`);
    });

    // Graceful shutdown handlers
    async function gracefulShutdown(signal: string): Promise<void> {
      console.error(`${signal} received, starting graceful shutdown...`);

      // Stop accepting new connections
      httpServer.close(() => {
        console.error("HTTP server closed, no more new connections");
      });

      // Close transport
      try {
        await transport.close();
        console.error("MCP transport closed");
      } catch (err) {
        console.error(`Error closing transport: ${String(err)}`);
      }

      console.error("Graceful shutdown complete");
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
      console.error(`❌ UNCAUGHT EXCEPTION (server continuing): ${error.message}`);
      console.error(error.stack);
      // Don't exit - keep the server running
    });

    process.on("unhandledRejection", (reason: unknown) => {
      console.error(`❌ UNHANDLED REJECTION (server continuing): ${String(reason)}`);
      if (reason instanceof Error) {
        console.error(reason.stack);
      }
      // Don't exit - keep the server running
    });
  } else {
    // stdio mode for local VS Code
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Gemini Bridge MCP server running on stdio");

    // Prevent crash on unhandled errors - keep server running indefinitely
    process.on("uncaughtException", (error: Error) => {
      console.error("❌ UNCAUGHT EXCEPTION (server continuing):", error.message);
      console.error(error.stack);
      // Don't exit - keep the server running
    });

    process.on("unhandledRejection", (reason: unknown) => {
      console.error("❌ UNHANDLED REJECTION (server continuing):", reason);
      if (reason instanceof Error) {
        console.error(reason.stack);
      }
      // Don't exit - keep the server running
    });
  }
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
