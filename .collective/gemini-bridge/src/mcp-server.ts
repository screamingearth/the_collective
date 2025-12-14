#!/usr/bin/env node

/**
 * Gemini Bridge MCP Server
 *
 * MCP server providing access to Google's Gemini via CLI.
 * Enables research, code analysis, and validation through structured tools.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
} from "@modelcontextprotocol/sdk/types.js";
import type { GeminiJsonResponse } from "./types.js";
import { buildArgs, checkAuthStatus, spawnGemini } from "./utils.js";

/**
 * Tool argument types
 */
interface QueryArgs {
  prompt: string;
  context?: string;
  timeout?: number;
}

interface AnalyzeCodeArgs {
  code: string;
  question: string;
  language?: string;
  timeout?: number;
}

interface ValidateArgs {
  proposal: string;
  context: string;
  criteria?: string;
  timeout?: number;
}

const GEMINI_TOOLS: Tool[] = [
  {
    name: "gemini_query",
    description:
      "Query Gemini for research, documentation lookup, or general questions. Uses gemini-2.5-flash (128k context, 2-5s response time). Free tier: 60 req/min, 1000 req/day.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The research question or query",
        },
        context: {
          type: "string",
          description: "Optional additional context to include",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds (default: 120000)",
          default: 120000,
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "gemini_analyze_code",
    description:
      "Analyze code with Gemini. Explain logic, identify issues, suggest improvements. Uses gemini-2.5-flash with 128k context window.",
    inputSchema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "The code to analyze",
        },
        question: {
          type: "string",
          description: "What you want to know about the code",
        },
        language: {
          type: "string",
          description: "Programming language (optional, helps with context)",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds (default: 120000)",
          default: 120000,
        },
      },
      required: ["code", "question"],
    },
  },
  {
    name: "gemini_validate",
    description:
      "Get a second opinion from Gemini on a proposal, approach, or decision. Useful for independent validation from a different model.",
    inputSchema: {
      type: "object",
      properties: {
        proposal: {
          type: "string",
          description: "The proposal, approach, or decision to validate",
        },
        context: {
          type: "string",
          description: "Background context for the validation",
        },
        criteria: {
          type: "string",
          description: "Specific criteria to validate against (optional)",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds (default: 120000)",
          default: 120000,
        },
      },
      required: ["proposal", "context"],
    },
  },
];

/**
 * Parse JSON response from gemini-cli
 */
function parseJsonResponse(output: string): GeminiJsonResponse | null {
  try {
    const lines = output.trim().split("\n");
    for (const line of lines) {
      if (line.trim().startsWith("{")) {
        return JSON.parse(line) as GeminiJsonResponse;
      }
    }
  } catch (err) {
    // Not JSON, return null
  }
  return null;
}

/**
 * Execute gemini-cli with prompt
 */
async function executeGemini(
  prompt: string,
  timeout: number
): Promise<{ success: boolean; response?: string; error?: string }> {
  const args = buildArgs({
    prompt,
    model: "gemini-2.5-flash",
    outputFormat: "json",
  });

  try {
    const result = await spawnGemini(args, { timeout });

    if (result.exitCode !== 0) {
      return {
        success: false,
        error: result.stderr || `Process exited with code ${result.exitCode}`,
      };
    }

    const json = parseJsonResponse(result.stdout);
    if (json?.response) {
      return { success: true, response: json.response };
    }

    // Fallback to raw stdout if JSON parsing fails
    return { success: true, response: result.stdout };
  } catch (err) {
    const error = err as Error;
    return { success: false, error: error.message };
  }
}

/**
 * Main server setup
 */
async function main() {
  // Check auth status on startup
  const authStatus = await checkAuthStatus();
  if (!authStatus.authenticated) {
    console.error("Gemini CLI not authenticated. Run: cd gemini-bridge && npm run auth");
    process.exit(1);
  }

  const server = new Server(
    {
      name: "gemini-bridge",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: GEMINI_TOOLS,
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "gemini_query": {
          const typedArgs = args as unknown as QueryArgs;
          const { prompt, context, timeout = 120000 } = typedArgs;
          const fullPrompt = context
            ? `Context:\n${context}\n\nQuestion:\n${prompt}`
            : prompt;

          const result = await executeGemini(fullPrompt, timeout);

          return {
            content: [
              {
                type: "text",
                text: result.success
                  ? result.response!
                  : `Error: ${result.error}`,
              },
            ],
            isError: !result.success,
          };
        }

        case "gemini_analyze_code": {
          const typedArgs = args as unknown as AnalyzeCodeArgs;
          const { code, question, language, timeout = 120000 } = typedArgs;

          const prompt = language
            ? `Analyze this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nQuestion: ${question}`
            : `Analyze this code:\n\n\`\`\`\n${code}\n\`\`\`\n\nQuestion: ${question}`;

          const result = await executeGemini(prompt, timeout);

          return {
            content: [
              {
                type: "text",
                text: result.success
                  ? result.response!
                  : `Error: ${result.error}`,
              },
            ],
            isError: !result.success,
          };
        }

        case "gemini_validate": {
          const typedArgs = args as unknown as ValidateArgs;
          const { proposal, context, criteria, timeout = 120000 } = typedArgs;

          const prompt = criteria
            ? `Validate this proposal:\n\n${proposal}\n\nContext:\n${context}\n\nCriteria:\n${criteria}\n\nProvide an independent assessment considering potential issues, alternatives, and improvements.`
            : `Validate this proposal:\n\n${proposal}\n\nContext:\n${context}\n\nProvide an independent assessment considering potential issues, alternatives, and improvements.`;

          const result = await executeGemini(prompt, timeout);

          return {
            content: [
              {
                type: "text",
                text: result.success
                  ? result.response!
                  : `Error: ${result.error}`,
              },
            ],
            isError: !result.success,
          };
        }

        default:
          return {
            content: [
              {
                type: "text",
                text: `Unknown tool: ${name}`,
              },
            ],
            isError: true,
          };
      }
    } catch (error) {
      const err = error as Error;
      return {
        content: [
          {
            type: "text",
            text: `Error executing tool: ${err.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Gemini Bridge MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
