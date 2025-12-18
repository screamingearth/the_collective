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
import { z } from "zod";
import type { GeminiJsonResponse } from "./types.js";
import { buildArgs, checkAuthStatus, spawnGemini } from "./utils.js";

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
  } catch {
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
    model: "gemini-3-flash-preview",
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
async function main(): Promise<void> {
  // Check auth status on startup (non-blocking)
  const authStatus = await checkAuthStatus();
  if (!authStatus.authenticated) {
    console.error(
      "⚠️ Warning: Gemini CLI may not be authenticated. " +
      "If Gemini tools fail, run: cd gemini-bridge && npm run auth"
    );
  } else {
    console.error("✓ Gemini CLI authenticated and ready");
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

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Gemini Bridge MCP server running on stdio");
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
