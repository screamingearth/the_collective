/*
 * This file is part of >the_collective.
 * Copyright (c) 2025 screamingearth.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { EchoStatus, GeminiJsonResponse, GeminiStreamEvent } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get the path to the local gemini-cli executable
 */
export function getGeminiCliPath(): string {
  // First try local node_modules
  const localPath = resolve(__dirname, "..", "..", "node_modules", ".bin", "gemini");
  if (existsSync(localPath)) {
    return localPath;
  }

  // Fall back to npx
  return "npx @google/gemini-cli";
}

/**
 * Parse JSON output from gemini-cli
 */
export function parseJsonResponse(output: string): GeminiJsonResponse | null {
  try {
    // gemini-cli JSON output may have multiple JSON objects (for tool calls etc)
    // The final response is typically the last complete JSON object
    const lines = output.trim().split("\n");

    // Try to find a valid JSON response
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith("{") && line.endsWith("}")) {
        try {
          return JSON.parse(line) as GeminiJsonResponse;
        } catch {
          continue;
        }
      }
    }

    // Try parsing the whole output as JSON
    return JSON.parse(output) as GeminiJsonResponse;
  } catch {
    return null;
  }
}

/**
 * Parse stream-json output from gemini-cli
 */
export function parseStreamEvents(output: string): GeminiStreamEvent[] {
  const events: GeminiStreamEvent[] = [];
  const lines = output.trim().split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("{")) {
      try {
        const event = JSON.parse(trimmed) as GeminiStreamEvent;
        events.push(event);
      } catch {
        // Skip malformed lines
      }
    }
  }

  return events;
}

/**
 * Extract text response from stream events
 */
export function extractTextFromEvents(events: GeminiStreamEvent[]): string {
  return events
    .filter((e) => e.type === "text" && e.content)
    .map((e) => e.content)
    .join("");
}

/**
 * Build command arguments for gemini-cli
 */
export function buildArgs(options: {
  prompt: string;
  cwd?: string;
  includeDirectories?: string[];
  model?: string;
  outputFormat?: "text" | "json" | "stream-json";
  yolo?: boolean;
  systemInstructions?: string;
}): string[] {
  const args: string[] = [];

  // Model selection (must come before positional prompt)
  if (options.model) {
    args.push("-m", options.model);
  }

  // Output format (must come before positional prompt)
  if (options.outputFormat === "json") {
    args.push("-o", "json");
  } else if (options.outputFormat === "stream-json") {
    args.push("-o", "stream-json");
  }

  // Include directories
  if (options.includeDirectories?.length) {
    args.push("--include-directories", options.includeDirectories.join(","));
  }

  // YOLO mode (auto-approve tool calls)
  if (options.yolo) {
    args.push("--yolo");
  }

  // Positional prompt (MUST BE LAST)
  args.push(options.prompt);

  return args;
}

/**
 * Spawn gemini-cli process with timeout
 */
export function spawnGemini(
  args: string[],
  options: {
    cwd?: string;
    timeout?: number;
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
  } = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolvePromise, reject) => {
    const cliPath = getGeminiCliPath();
    const isNpx = cliPath.startsWith("npx");

    let proc: ChildProcess;

    if (isNpx) {
      // Use npx to run - shell false to prevent command injection
      proc = spawn("npx", ["@google/gemini-cli", ...args], {
        cwd: options.cwd,
        shell: false,
        env: { ...process.env, FORCE_COLOR: "0" },
      });
    } else {
      proc = spawn(cliPath, args, {
        cwd: options.cwd,
        shell: false,
        env: { ...process.env, FORCE_COLOR: "0" },
      });
    }

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    // Setup timeout
    const timeoutId = options.timeout
      ? setTimeout(() => {
        timedOut = true;
        proc.kill("SIGTERM");
      }, options.timeout)
      : null;

    proc.stdout?.on("data", (data: Buffer) => {
      const str = data.toString();
      stdout += str;
      options.onStdout?.(str);
    });

    proc.stderr?.on("data", (data: Buffer) => {
      const str = data.toString();
      stderr += str;
      options.onStderr?.(str);
    });

    proc.on("close", (code) => {
      if (timeoutId) clearTimeout(timeoutId);

      if (timedOut) {
        reject(new Error("Gemini CLI timed out"));
        return;
      }

      resolvePromise({
        stdout,
        stderr,
        exitCode: code ?? 1,
      });
    });

    proc.on("error", (err) => {
      if (timeoutId) clearTimeout(timeoutId);
      reject(err);
    });
  });
}

/**
 * Check if gemini-cli is authenticated
 */
export async function checkAuthStatus(): Promise<EchoStatus> {
  try {
    // Check if OAuth credentials file exists (fast, no API calls)
    const { existsSync } = await import('fs');
    const { homedir } = await import('os');
    const { join } = await import('path');

    const credsPath = join(homedir(), '.gemini', 'oauth_creds.json');
    if (existsSync(credsPath)) {
      return {
        installed: true,
        authenticated: true,
        authMethod: "oauth",
        version: undefined,
        executablePath: getGeminiCliPath(),
      };
    }

    // No credentials file - assume not authenticated
    // (Don't make API calls on startup - they're slow and expensive)
    return {
      installed: false,
      authenticated: false,
      authMethod: undefined,
      version: undefined,
      executablePath: getGeminiCliPath(),
    };
  } catch (err) {
    const error = err as Error;
    if (error.message.includes("ENOENT") || error.message.includes("not found")) {
      return {
        installed: false,
        authenticated: false,
        error: "Gemini CLI is not installed. Run 'npm install' in gemini-bridge/",
      };
    }

    return {
      installed: false,
      authenticated: false,
      error: error.message,
    };
  }
}
