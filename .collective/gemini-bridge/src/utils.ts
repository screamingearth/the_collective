/*
 * This file is part of >the_collective.
 * Copyright (c) 2025 screamingearth.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { EchoStatus, GeminiJsonResponse } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.5-flash";

/**
 * Get API key from environment or config file
 * Priority: GEMINI_API_KEY env > GOOGLE_API_KEY env > .env file
 */
function getApiKey(): string | null {
  // Check environment variables first
  if (process.env.GEMINI_API_KEY?.trim()) {
    return process.env.GEMINI_API_KEY.trim();
  }
  if (process.env.GOOGLE_API_KEY?.trim()) {
    return process.env.GOOGLE_API_KEY.trim();
  }

  // Check .env file in gemini-bridge directory
  const envPath = join(__dirname, "..", ".env");
  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, "utf-8");
      const match = /^GEMINI_API_KEY=(.+)$/m.exec(content);
      if (match?.[1]?.trim()) {
        return match[1].trim();
      }
    } catch {
      // Ignore read errors
    }
  }

  return null;
}

/**
 * Check if gemini-cli OAuth is configured
 */
function hasOAuthCredentials(): boolean {
  // gemini-cli stores active account info in google_accounts.json
  const accountsPath = join(homedir(), ".gemini", "google_accounts.json");
  if (!existsSync(accountsPath)) {
    return false;
  }

  try {
    const content = readFileSync(accountsPath, "utf-8");
    const data = JSON.parse(content) as { active?: string };
    return Boolean(data.active);
  } catch {
    return false;
  }
}

// ============================================================================
// Direct HTTP Path (API Key - Fast)
// ============================================================================

/**
 * Execute Gemini query using API key via direct HTTP
 * Expected latency: ~100-500ms (no subprocess overhead)
 */
async function executeViaApiKey(
  prompt: string,
  timeout: number,
  apiKey: string
): Promise<{ success: boolean; response?: string; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(
      `${GEMINI_API_URL}/${DEFAULT_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[gemini] HTTP ${response.status}: ${errorText}`);

      if (response.status === 400) {
        return { success: false, error: `Invalid request: ${response.statusText}` };
      }
      if (response.status === 401 || response.status === 403) {
        return { success: false, error: "Invalid API key. Check your GEMINI_API_KEY." };
      }
      if (response.status === 429) {
        return { success: false, error: "Rate limit exceeded. Wait and try again." };
      }

      return { success: false, error: `API error ${response.status}: ${response.statusText}` };
    }

    const data = (await response.json()) as {
      candidates?: { content: { parts: { text: string }[] } }[];
      error?: { message: string };
    };

    if (data.error) {
      return { success: false, error: data.error.message };
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return { success: false, error: "No text in response" };
    }

    return { success: true, response: text };
  } catch (err) {
    clearTimeout(timeoutId);
    const error = err as Error;

    if (error.name === "AbortError") {
      return { success: false, error: `Request timed out after ${timeout}ms` };
    }
    return { success: false, error: error.message };
  }
}

// ============================================================================
// Subprocess Path (OAuth via gemini-cli)
// ============================================================================

/**
 * Get the path to the local gemini-cli executable
 */
function getGeminiCliPath(): string {
  const localPath = resolve(__dirname, "..", "node_modules", ".bin", "gemini");
  if (existsSync(localPath)) {
    return localPath;
  }
  return "npx";
}

/**
 * Spawn gemini-cli process with timeout
 */
function spawnGemini(
  args: string[],
  options: { cwd?: string; timeout?: number } = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolvePromise, reject) => {
    const cliPath = getGeminiCliPath();
    const isNpx = cliPath === "npx";

    let proc: ChildProcess;

    if (isNpx) {
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

    const timeoutId = options.timeout
      ? setTimeout(() => {
        timedOut = true;
        proc.kill("SIGTERM");
      }, options.timeout)
      : null;

    proc.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code: number | null) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (timedOut) {
        reject(new Error(`Gemini CLI timed out after ${options.timeout}ms`));
        return;
      }

      resolvePromise({ stdout, stderr, exitCode: code ?? 1 });
    });

    proc.on("error", (err: Error) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      reject(err);
    });
  });
}

/**
 * Execute Gemini query using gemini-cli subprocess (OAuth)
 * Expected latency: ~1-3s (subprocess overhead + API call)
 */
async function executeViaSubprocess(
  prompt: string,
  timeout: number
): Promise<{ success: boolean; response?: string; error?: string }> {
  try {
    const args = ["-m", DEFAULT_MODEL, "-o", "json", prompt];
    const result = await spawnGemini(args, { timeout });

    if (result.exitCode !== 0) {
      if (result.stderr.includes("not authenticated") || result.stderr.includes("login")) {
        return {
          success: false,
          error: "Not authenticated. Run: cd .collective/gemini-bridge && npm run auth",
        };
      }
      return {
        success: false,
        error: result.stderr || `gemini-cli exited with code ${result.exitCode}`,
      };
    }

    // Parse JSON output - gemini-cli outputs JSON with response field
    const parsed = parseJsonResponse(result.stdout);
    if (parsed?.response) {
      return { success: true, response: parsed.response };
    }

    // Fallback: use raw stdout if it has content
    const text = result.stdout.trim();
    if (text) {
      return { success: true, response: text };
    }

    return { success: false, error: "Failed to parse gemini-cli output" };
  } catch (err) {
    const error = err as Error;
    return { success: false, error: error.message };
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Execute Gemini query using the best available auth method
 * Priority: API key (fast HTTP) > OAuth (subprocess)
 */
export async function executeGeminiQuery(
  prompt: string,
  timeout = 120000
): Promise<{ success: boolean; response?: string; error?: string }> {
  // Try API key first (fast path)
  const apiKey = getApiKey();
  if (apiKey) {
    return executeViaApiKey(prompt, timeout, apiKey);
  }

  // Fall back to OAuth via gemini-cli subprocess
  if (hasOAuthCredentials()) {
    return executeViaSubprocess(prompt, timeout);
  }

  // No auth available
  return {
    success: false,
    error: "No authentication available. Set GEMINI_API_KEY or run: cd .collective/gemini-bridge && npm run auth",
  };
}

/**
 * Parse JSON output from gemini-cli
 */
export function parseJsonResponse(output: string): GeminiJsonResponse | null {
  try {
    const lines = output.trim().split("\n");

    // Try to find valid JSON (last one usually contains the response)
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (line?.trim().startsWith("{") && line.trim().endsWith("}")) {
        try {
          return JSON.parse(line.trim()) as GeminiJsonResponse;
        } catch {
          continue;
        }
      }
    }

    // Try parsing whole output
    return JSON.parse(output) as GeminiJsonResponse;
  } catch {
    return null;
  }
}

/**
 * Check authentication status
 */
export function checkAuthStatus(): EchoStatus {
  const apiKey = getApiKey();
  if (apiKey) {
    return {
      installed: true,
      authenticated: true,
      authMethod: "api-key",
      executablePath: "Direct HTTP with API key",
    };
  }

  if (hasOAuthCredentials()) {
    return {
      installed: true,
      authenticated: true,
      authMethod: "oauth",
      executablePath: getGeminiCliPath(),
    };
  }

  return {
    installed: true,
    authenticated: false,
    error: "No credentials found. Set GEMINI_API_KEY or run: npm run auth",
  };
}

/**
 * Get auth method description for logging
 */
export function getAuthMethodDescription(): string {
  const apiKey = getApiKey();
  if (apiKey) {
    return "API key (direct HTTP)";
  }
  if (hasOAuthCredentials()) {
    return "OAuth (gemini-cli subprocess)";
  }
  return "none";
}

/**
 * Ensure settings (no-op - for compatibility)
 */
export async function ensureSettings(): Promise<void> {
  // No settings files needed
}
