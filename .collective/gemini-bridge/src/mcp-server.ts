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
import * as fs from "fs";
import http from "http";
import * as path from "path";
import { z } from "zod";
import {
  checkAuthStatus,
  ensureSettings,
  executeGeminiQuery,
  executeGeminiQueryWithTools,
  getAuthMethodDescription,
  type GeminiTool,
  type ToolCall,
  type ToolExecutor,
} from "./utils.js";

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

## tool usage (when available)

when you need more context about the codebase, you have tools available:
- **read_workspace_file**: read specific files when you need to see implementations
- **grep_search**: search codebase for patterns, imports, function names
- **list_directory**: explore directory structure

use tools strategically:
- start with provided context (if includeFiles were given)
- use grep_search to find relevant files
- read specific files only when needed
- don't read files you've already seen
- max 10 tool calls per query - be efficient

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
- **autonomous exploration**: can explore codebase when you need more context
- **parallel processing**: you research while they implement

respond with comprehensive, well-organized, well-cited information. functionality over personality.`;

/**
 * Load project-specific context from GEMINI.md if it exists
 * Returns empty string if file doesn't exist
 */
function loadGeminiContext(): string {
  const workspaceRoot = process.env.WORKSPACE_ROOT ?? process.cwd();
  const contextPath = path.join(workspaceRoot, "GEMINI.md");

  try {
    if (fs.existsSync(contextPath)) {
      const content = fs.readFileSync(contextPath, "utf-8");
      console.error("✓ Loaded project context from GEMINI.md");
      return content;
    }
  } catch (err) {
    const error = err as Error;
    console.error(`⚠️ Failed to load GEMINI.md: ${error.message}`);
  }

  return "";
}

/**
 * Build the complete system prompt including project context
 */
function buildSystemPrompt(): string {
  const projectContext = loadGeminiContext();

  if (projectContext) {
    return `${projectContext}\n\n---\n\n# Core Instructions\n\n${GEMINI_SYSTEM_PROMPT}`;
  }

  return GEMINI_SYSTEM_PROMPT;
}

// Cache the system prompt (loaded once at startup)
let cachedSystemPrompt: string | null = null;

function getSystemPrompt(): string {
  cachedSystemPrompt ??= buildSystemPrompt();
  return cachedSystemPrompt;
}

/**
 * Read workspace files and construct context string
 * Workspace root is determined by environment variable or current directory
 */
function readWorkspaceFiles(files: string[]): string {
  const workspaceRoot = process.env.WORKSPACE_ROOT ?? process.cwd();
  const fileContents: string[] = [];

  for (const file of files) {
    try {
      // Resolve absolute path from workspace root
      const absolutePath = path.isAbsolute(file)
        ? file
        : path.join(workspaceRoot, file);

      // Security check: resolve symlinks and ensure file is within workspace
      // fs.realpathSync resolves symlinks to their actual target path
      const realPath = fs.realpathSync(absolutePath);
      const realWorkspace = fs.realpathSync(workspaceRoot);
      if (!realPath.startsWith(realWorkspace)) {
        fileContents.push(`[ERROR: ${file} - path outside workspace]`);
        continue;
      }

      // Read file
      const content = fs.readFileSync(realPath, "utf-8");
      const relativePath = path.relative(workspaceRoot, realPath);
      fileContents.push(`// File: ${relativePath}\n${content}`);
    } catch (err) {
      const error = err as Error;
      fileContents.push(`[ERROR: ${file} - ${error.message}]`);
    }
  }

  return fileContents.length > 0
    ? `\n\n## Workspace Files\n\n${fileContents.join("\n\n---\n\n")}`
    : "";
}

/**
 * List directory contents with security checks
 */
function listWorkspaceDirectory(dirPath: string): string {
  const workspaceRoot = process.env.WORKSPACE_ROOT ?? process.cwd();

  try {
    // Resolve absolute path
    const absolutePath = path.isAbsolute(dirPath)
      ? dirPath
      : path.join(workspaceRoot, dirPath);

    // Security check: ensure within workspace
    const realPath = fs.realpathSync(absolutePath);
    const realWorkspace = fs.realpathSync(workspaceRoot);
    if (!realPath.startsWith(realWorkspace)) {
      return `[ERROR: ${dirPath} - path outside workspace]`;
    }

    // Read directory
    const entries = fs.readdirSync(realPath, { withFileTypes: true });
    const formatted = entries.map(entry => {
      const type = entry.isDirectory() ? "dir" : "file";
      return `${type}: ${entry.name}`;
    }).join("\n");

    return `Directory: ${path.relative(workspaceRoot, realPath)}\n${formatted}`;
  } catch (err) {
    const error = err as Error;
    return `[ERROR: ${dirPath} - ${error.message}]`;
  }
}

/**
 * Search workspace files using grep-like pattern matching
 */
function grepWorkspace(pattern: string, includePattern?: string): string {
  const workspaceRoot = process.env.WORKSPACE_ROOT ?? process.cwd();
  const results: string[] = [];
  const maxResults = 20; // Limit results to prevent token explosion

  try {
    // Simple recursive search (in production, use proper glob library)
    function searchDir(dir: string, depth = 0): void {
      if (depth > 5 || results.length >= maxResults) {
        return;
      } // Max depth and results

      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (results.length >= maxResults) {
          break;
        }

        // Skip common ignored directories
        if (entry.isDirectory()) {
          if (["node_modules", ".git", "dist", "build"].includes(entry.name)) {
            continue;
          }
          searchDir(path.join(dir, entry.name), depth + 1);
        } else {
          const filePath = path.join(dir, entry.name);

          // Filter by include pattern if provided
          if (includePattern && !filePath.includes(includePattern)) {
            continue;
          }

          try {
            const content = fs.readFileSync(filePath, "utf-8");
            const lines = content.split("\n");

            lines.forEach((line, idx) => {
              if (results.length >= maxResults) {
                return;
              }
              if (line.toLowerCase().includes(pattern.toLowerCase())) {
                const relativePath = path.relative(workspaceRoot, filePath);
                results.push(`${relativePath}:${idx + 1}: ${line.trim()}`);
              }
            });
          } catch {
            // Skip files that can't be read
          }
        }
      }
    }

    searchDir(workspaceRoot);

    if (results.length === 0) {
      return `No matches found for pattern: ${pattern}`;
    }

    const truncated = results.length >= maxResults ? " (truncated)" : "";
    return `Search results for "${pattern}"${truncated}:\n${results.join("\n")}`;
  } catch (err) {
    const error = err as Error;
    return `[ERROR: ${error.message}]`;
  }
}

/**
 * Tool definitions for Gemini's autonomous exploration
 */
const GEMINI_TOOLS: GeminiTool[] = [
  {
    name: "read_workspace_file",
    description: "Read contents of a file from the workspace. Use when you need to see specific implementations, configurations, or documentation.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path from workspace root (e.g., 'src/index.ts', 'package.json')",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "grep_search",
    description: "Search workspace files for text patterns. Use to find functions, classes, imports, or specific code patterns.",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Text pattern to search for (case-insensitive)",
        },
        include_pattern: {
          type: "string",
          description: "Optional: filter to files matching this pattern (e.g., '.ts', 'src/')",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "list_directory",
    description: "List contents of a directory. Use to explore project structure.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Directory path relative to workspace root (use '.' for root)",
        },
      },
      required: ["path"],
    },
  },
];

/**
 * Tool executor for Gemini's autonomous exploration
 */
const toolExecutor: ToolExecutor = async (toolCall: ToolCall): Promise<string> => {
  switch (toolCall.name) {
    case "read_workspace_file":
      return readWorkspaceFiles([toolCall.arguments.path as string]);
    case "grep_search":
      return grepWorkspace(
        toolCall.arguments.pattern as string,
        toolCall.arguments.include_pattern as string | undefined
      );
    case "list_directory":
      return listWorkspaceDirectory(toolCall.arguments.path as string);
    default:
      return `[ERROR: Unknown tool ${toolCall.name}]`;
  }
};

/**
 * Execute gemini query with optional tool calling support
 * Expected latency: 2-5s without tools, 10-30s with autonomous exploration
 */
async function executeGemini(
  prompt: string,
  timeout: number,
  enableTools = false
): Promise<{ success: boolean; response?: string; error?: string }> {
  try {
    if (enableTools) {
      return await executeGeminiQueryWithTools(prompt, GEMINI_TOOLS, toolExecutor, timeout);
    }
    return await executeGeminiQuery(prompt, timeout);
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

  // Load project context early (caches on first call)
  getSystemPrompt();

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
        "Uses gemini-3-flash-preview (2M context, 2-5s response time). " +
        "Free tier: 60 req/min, 1000 req/day. " +
        "HYBRID MODE: Set enableTools=true to let Gemini explore codebase autonomously (10-30s). " +
        "Fast path: Provide includeFiles for quick 2-5s response. " +
        "Thorough path: Enable tools for autonomous exploration when you're unsure what files are relevant.",
      inputSchema: z.object({
        prompt: z.string().describe("The research question or query"),
        context: z
          .string()
          .optional()
          .describe("Optional additional context to include"),
        includeFiles: z
          .array(z.string())
          .optional()
          .describe(
            "Workspace files to include for context (relative paths from workspace root). " +
            "Example: ['setup.sh', 'scripts/check.cjs', '.github/copilot-instructions.md']. " +
            "Fast path: provide these for 2-5s response. Leave empty with enableTools=true for autonomous exploration."
          ),
        enableTools: z
          .boolean()
          .default(false)
          .describe(
            "Enable autonomous codebase exploration (10-30s). Gemini can search files, read implementations, " +
            "and explore directories to build full context. Use when you're unsure what files are relevant."
          ),
        timeout: z
          .number()
          .default(120000)
          .describe("Timeout in milliseconds (default: 120000)"),
      }),
    },
    async ({ prompt, context, includeFiles, enableTools, timeout }) => {
      const filesContext = includeFiles ? readWorkspaceFiles(includeFiles) : "";
      const userPrompt = context
        ? `Context:\n${context}${filesContext}\n\nQuestion:\n${prompt}`
        : `${filesContext ? filesContext + "\n\n" : ""}Question:\n${prompt}`;
      const fullPrompt = `${getSystemPrompt()}\n\n---\n\n${userPrompt}`;

      const result = await executeGemini(fullPrompt, timeout ?? 120000, enableTools);

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
        "Uses gemini-3-flash-preview with 2M context window. " +
        "HYBRID MODE: Set enableTools=true to let Gemini explore dependencies autonomously.",
      inputSchema: z.object({
        code: z.string().describe("The code to analyze"),
        question: z.string().describe("What you want to know about the code"),
        language: z
          .string()
          .optional()
          .describe("Programming language (optional, helps with context)"),
        includeFiles: z
          .array(z.string())
          .optional()
          .describe(
            "Related workspace files for context (relative paths). " +
            "Example: ['src/types.ts', 'src/utils.ts'] when analyzing a file that imports them. " +
            "Fast path: provide these explicitly. Or enable tools for Gemini to explore."
          ),
        enableTools: z
          .boolean()
          .default(false)
          .describe(
            "Enable autonomous dependency exploration. Gemini can read imported files and follow dependency chains."
          ),
        timeout: z
          .number()
          .default(120000)
          .describe("Timeout in milliseconds (default: 120000)"),
      }),
    },
    async ({ code, question, language, includeFiles, enableTools, timeout }) => {
      const filesContext = includeFiles ? readWorkspaceFiles(includeFiles) : "";
      const userPrompt = language
        ? `Analyze this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`${filesContext}\n\nQuestion: ${question}`
        : `Analyze this code:\n\n\`\`\`\n${code}\n\`\`\`${filesContext}\n\nQuestion: ${question}`;
      const fullPrompt = `${getSystemPrompt()}\n\n---\n\n${userPrompt}`;

      const result = await executeGemini(fullPrompt, timeout ?? 120000, enableTools);

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
        "Useful for independent validation from a different model. " +
        "HYBRID MODE: Set enableTools=true to let Gemini explore relevant implementation files.",
      inputSchema: z.object({
        proposal: z
          .string()
          .describe("The proposal, approach, or decision to validate"),
        context: z.string().describe("Background context for the validation"),
        criteria: z
          .string()
          .optional()
          .describe("Specific criteria to validate against (optional)"),
        includeFiles: z
          .array(z.string())
          .optional()
          .describe(
            "Implementation files relevant to the proposal (relative paths). " +
            "Example: ['docker-compose.yml', 'setup.sh'] when validating Docker setup. " +
            "Fast path: provide explicitly. Or enable tools for Gemini to explore."
          ),
        enableTools: z
          .boolean()
          .default(false)
          .describe(
            "Enable autonomous exploration of related files. Gemini can search for relevant implementations and configurations."
          ),
        timeout: z
          .number()
          .default(120000)
          .describe("Timeout in milliseconds (default: 120000)"),
      }),
    },
    async ({ proposal, context, criteria, includeFiles, enableTools, timeout }) => {
      const filesContext = includeFiles ? readWorkspaceFiles(includeFiles) : "";
      const userPrompt = criteria
        ? `Validate this proposal:\n\n${proposal}\n\nContext:\n${context}${filesContext}\n\nCriteria:\n${criteria}\n\nProvide an independent assessment considering potential issues, alternatives, and improvements.`
        : `Validate this proposal:\n\n${proposal}\n\nContext:\n${context}${filesContext}\n\nProvide an independent assessment considering potential issues, alternatives, and improvements.`;
      const fullPrompt = `${getSystemPrompt()}\n\n---\n\n${userPrompt}`;

      const result = await executeGemini(fullPrompt, timeout ?? 120000, enableTools);

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

    // DNS Rebinding Protection Middleware
    // Manually backported from MCP SDK 1.24.0 to mitigate CVE-2025-66414
    // Validates Host header to prevent DNS rebinding attacks
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      const host = req.headers.host;
      if (host && !host.startsWith('localhost:') && !host.startsWith('127.0.0.1:') && host !== 'localhost' && host !== '127.0.0.1') {
        console.error(`DNS rebinding protection: rejected request with suspicious Host header: ${host}`);
        res.status(400).json({ error: "Invalid Host header" });
        return;
      }
      next();
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
