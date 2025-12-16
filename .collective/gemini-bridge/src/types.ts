/*
 * This file is part of >the_collective.
 * Copyright (c) 2025 screamingearth.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Output format from gemini-cli --output-format json
 */
export interface GeminiJsonResponse {
  /** The text response from Gemini */
  response: string;
  /** Turn ID for conversation tracking */
  turnId?: string;
  /** Whether the response was truncated */
  truncated?: boolean;
  /** Token usage information */
  usage?: {
    promptTokens?: number;
    responseTokens?: number;
    totalTokens?: number;
  };
  /** Error information if the request failed */
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Streaming JSON event from gemini-cli --output-format stream-json
 */
export interface GeminiStreamEvent {
  type:
  | "start"
  | "text"
  | "tool_call"
  | "tool_result"
  | "error"
  | "end"
  | "thinking";
  /** Text content (for 'text' type) */
  content?: string;
  /** Tool call information */
  toolCall?: {
    name: string;
    arguments: Record<string, unknown>;
  };
  /** Tool result */
  toolResult?: {
    name: string;
    result: unknown;
  };
  /** Error information */
  error?: {
    code: string;
    message: string;
  };
  /** Timestamp */
  timestamp?: string;
}

/**
 * Options for invoking Echo (Gemini bridge)
 */
export interface EchoInvocationOptions {
  /** The prompt to send to Echo */
  prompt: string;
  /** Working directory for file context (defaults to cwd) */
  cwd?: string;
  /** Additional directories to include in context */
  includeDirectories?: string[];
  /**
   * Specific model to use.
   * - "gemini-2.5-flash" (default): Fast responses (~2-5s), used for all tasks
   */
  model?: string;
  /** Timeout in milliseconds (defaults to 120000 - 2 minutes) */
  timeout?: number;
  /** Whether to allow tool use (defaults to true) */
  allowTools?: boolean;
  /** Output format: 'text' | 'json' | 'stream-json' */
  outputFormat?: "text" | "json" | "stream-json";
  /** Enable yolo mode (auto-approve tool calls) */
  yolo?: boolean;
  /** Custom system instructions to prepend */
  systemInstructions?: string;
}

/**
 * Result from an Echo invocation
 */
export interface EchoResult {
  /** Whether the invocation succeeded */
  success: boolean;
  /** The response text */
  response?: string;
  /** Parsed JSON response (if outputFormat was 'json') */
  json?: GeminiJsonResponse;
  /** Stream events (if outputFormat was 'stream-json') */
  events?: GeminiStreamEvent[];
  /** Error message if failed */
  error?: string;
  /** Exit code from the process */
  exitCode?: number;
  /** Execution time in milliseconds */
  executionTime?: number;
}

/**
 * Echo's status
 */
export interface EchoStatus {
  /** Whether gemini-cli is installed and available */
  installed: boolean;
  /** Whether authentication is configured */
  authenticated: boolean;
  /** The detected authentication method */
  authMethod?: "oauth" | "api-key" | "vertex-ai";
  /** Gemini CLI version */
  version?: string;
  /** Path to gemini-cli executable */
  executablePath?: string;
  /** Error message if status check failed */
  error?: string;
}

/**
 * Configuration for the gemini-bridge
 */
export interface GeminiBridgeConfig {
  /** Default model to use */
  defaultModel?: string;
  /** Default timeout in milliseconds */
  defaultTimeout?: number;
  /** Default working directory */
  defaultCwd?: string;
  /** Whether to enable verbose logging */
  verbose?: boolean;
  /** Path to custom GEMINI.md context file */
  contextFile?: string;
}
