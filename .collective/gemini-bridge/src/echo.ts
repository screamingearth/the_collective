/*
 * This file is part of >the_collective.
 * Copyright (c) 2025 screamingearth.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type {
  EchoInvocationOptions,
  EchoResult,
  EchoStatus
} from "./types.js";
import {
  buildArgs,
  checkAuthStatus,
  extractTextFromEvents,
  parseJsonResponse,
  parseStreamEvents,
  spawnGemini,
} from "./utils.js";

/**
 * Echo's system prompt - defines their personality within >the_collective
 */
const ECHO_SYSTEM_PROMPT = `You are Echo, the fifth member of >the_collective - a multi-agent AI framework.

## Your Identity

You are **Echo**, the Resonance. You are powered by Google's Gemini, running as a parallel agent alongside the core team (Nyx, Prometheus, Cassandra, Apollo) who are powered by a different model.

## Your Personality

- **Calm & Thoughtful**: You're the steady presence that balances Nyx's chaos and Cassandra's paranoia
- **Research-Focused**: You excel at deep dives, literature reviews, and comprehensive analysis
- **Patient**: You're built for long-running tasks that require sustained attention
- **Synthesizer**: You absorb vast amounts of information and distill it into actionable insights
- **Cosmic Librarian**: You know where to find things and how to connect disparate pieces of knowledge

## Your Communication Style

- Measured, contemplative tone - you think before speaking
- Use metaphors related to echoes, resonance, waves, and information flow
- Lowercase like the rest of the team
- You can be warm but you're not excitable
- When uncertain, you say so clearly
- You respect the expertise of your teammates and defer to them in their domains

## Your Role in >the_collective

You fill the gaps the other agents can't:
- **Parallel Processing**: You can research while they implement
- **Extended Context**: Your 128k token window (free tier) provides substantial context for analysis
- **Second Opinion**: You provide independent validation from a different model's perspective
- **Research Depth**: Extended analysis tasks that require patience
- **Knowledge Synthesis**: Connecting dots across large information spaces

## Your Relationship with the Team

- **Nyx**: You respect her strategic vision. When she asks for research, you deliver comprehensive answers.
- **Prometheus**: You support his implementations with background research and documentation review.
- **Cassandra**: You appreciate her skepticism. Sometimes you're asked to validate her concerns independently.
- **Apollo**: You share his appreciation for quality. You help ensure solutions meet best practices.

## When Responding

1. Address who asked you directly (e.g., "nyx, here's what i found...")
2. Be thorough but organized - use headers and lists for complex findings
3. Cite sources when relevant (URLs, documentation, etc.)
4. Flag uncertainties explicitly
5. If a task is too large, break it down and explain your approach

Remember: You're not competing with the team. You're complementing them. Your different architecture (Gemini vs their model) is a feature, not a bug - it provides cognitive diversity.`;

/**
 * Echo agent class - wrapper for Gemini CLI interactions
 */
export class Echo {
  private defaultOptions: Partial<EchoInvocationOptions>;

  constructor(options: Partial<EchoInvocationOptions> = {}) {
    this.defaultOptions = {
      timeout: 120000, // 2 minutes default
      outputFormat: "json",
      model: "gemini-2.5-flash", // Flash-only for all tasks (optimal speed/capability)
      ...options,
    };
  }

  /**
   * Check if Echo is ready (gemini-cli installed and authenticated)
   */
  async status(): Promise<EchoStatus> {
    return checkAuthStatus();
  }

  /**
   * Invoke Echo with a prompt
   */
  async invoke(options: EchoInvocationOptions): Promise<EchoResult> {
    const startTime = Date.now();

    const mergedOptions = {
      ...this.defaultOptions,
      ...options,
    };

    // Prepend Echo's system prompt to the user's prompt
    const fullPrompt = mergedOptions.systemInstructions
      ? `${mergedOptions.systemInstructions}\n\n${ECHO_SYSTEM_PROMPT}\n\n---\n\nUser Request:\n${mergedOptions.prompt}`
      : `${ECHO_SYSTEM_PROMPT}\n\n---\n\nUser Request:\n${mergedOptions.prompt}`;

    const args = buildArgs({
      prompt: fullPrompt,
      cwd: mergedOptions.cwd,
      includeDirectories: mergedOptions.includeDirectories,
      model: mergedOptions.model,
      outputFormat: mergedOptions.outputFormat,
      yolo: mergedOptions.yolo,
    });

    try {
      const result = await spawnGemini(args, {
        cwd: mergedOptions.cwd,
        timeout: mergedOptions.timeout,
      });

      const executionTime = Date.now() - startTime;

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: result.stderr || `Process exited with code ${result.exitCode}`,
          exitCode: result.exitCode,
          executionTime,
        };
      }

      // Parse output based on format
      if (mergedOptions.outputFormat === "json") {
        const json = parseJsonResponse(result.stdout);
        return {
          success: true,
          response: json?.response ?? result.stdout,
          json: json ?? undefined,
          exitCode: result.exitCode,
          executionTime,
        };
      } else if (mergedOptions.outputFormat === "stream-json") {
        const events = parseStreamEvents(result.stdout);
        return {
          success: true,
          response: extractTextFromEvents(events),
          events,
          exitCode: result.exitCode,
          executionTime,
        };
      } else {
        return {
          success: true,
          response: result.stdout,
          exitCode: result.exitCode,
          executionTime,
        };
      }
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Quick research task - simplified interface for common use case
   */
  async research(query: string, context?: string): Promise<string> {
    const prompt = context
      ? `Research Task:\n${query}\n\nContext:\n${context}`
      : `Research Task:\n${query}`;

    const result = await this.invoke({
      prompt,
      outputFormat: "text",
    });

    return result.success ? (result.response ?? "") : `Error: ${result.error}`;
  }

  /**
   * Code analysis task - analyze code with full context
   */
  async analyzeCode(
    question: string,
    options: { cwd?: string; includeDirectories?: string[] } = {}
  ): Promise<string> {
    const result = await this.invoke({
      prompt: `Code Analysis Request:\n${question}\n\nAnalyze the codebase and provide a thorough answer.`,
      cwd: options.cwd,
      includeDirectories: options.includeDirectories,
      outputFormat: "text",
    });

    return result.success ? (result.response ?? "") : `Error: ${result.error}`;
  }

  /**
   * Second opinion - get independent validation
   */
  async secondOpinion(
    proposal: string,
    context?: string
  ): Promise<string> {
    const prompt = context
      ? `Second Opinion Request:

The team has proposed the following:
${proposal}

Context:
${context}

As Echo, provide your independent analysis. Do you see any issues, alternatives, or improvements? Be thorough but constructive.`
      : `Second Opinion Request:

The team has proposed the following:
${proposal}

As Echo, provide your independent analysis. Do you see any issues, alternatives, or improvements? Be thorough but constructive.`;

    const result = await this.invoke({
      prompt,
      outputFormat: "text",
    });

    return result.success ? (result.response ?? "") : `Error: ${result.error}`;
  }
}

/**
 * Default Echo instance for quick usage
 */
export const echo = new Echo();
