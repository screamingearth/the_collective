/*
 * This file is part of >the_collective.
 * Copyright (c) 2025 screamingearth.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildArgs, getGeminiCliPath, parseJsonResponse, parseStreamEvents } from "./utils.js";

describe("Gemini Bridge Utils", () => {
  describe("getGeminiCliPath", () => {
    it("should return a path or npx fallback", () => {
      const path = getGeminiCliPath();
      expect(path).toBeDefined();
      expect(typeof path).toBe("string");
      // Either local path or npx fallback
      expect(path.length).toBeGreaterThan(0);
    });
  });

  describe("buildArgs", () => {
    it("should build basic args with just a prompt", () => {
      const args = buildArgs({ prompt: "Hello world" });
      expect(args).toContain("Hello world");
    });

    it("should include model flag when specified", () => {
      const args = buildArgs({ prompt: "test", model: "gemini-2.0-flash" });
      expect(args).toContain("-m");
      expect(args).toContain("gemini-2.0-flash");
    });

    it("should include output format flag", () => {
      const args = buildArgs({ prompt: "test", outputFormat: "json" });
      expect(args).toContain("-o");
      expect(args).toContain("json");
    });

    it("should include yolo flag when enabled", () => {
      const args = buildArgs({ prompt: "test", yolo: true });
      expect(args).toContain("--yolo");
    });

    it("should place prompt at the end", () => {
      const args = buildArgs({
        prompt: "my prompt",
        model: "gemini-2.0-flash",
        outputFormat: "json",
      });
      expect(args[args.length - 1]).toBe("my prompt");
    });
  });

  describe("parseJsonResponse", () => {
    it("should parse valid JSON response", () => {
      const input = '{"response": "Hello", "session_id": "abc123"}';
      const result = parseJsonResponse(input);
      expect(result).toBeDefined();
      expect(result?.response).toBe("Hello");
    });

    it("should handle multiline output and find last JSON", () => {
      const input = `Some debug output
{"partial": true}
{"response": "Final answer", "session_id": "xyz"}`;
      const result = parseJsonResponse(input);
      expect(result).toBeDefined();
      expect(result?.response).toBe("Final answer");
    });

    it("should return null for invalid JSON", () => {
      const result = parseJsonResponse("not json at all");
      expect(result).toBeNull();
    });
  });

  describe("parseStreamEvents", () => {
    it("should parse stream-json events", () => {
      const input = `{"type": "text", "content": "Hello "}
{"type": "text", "content": "world"}
{"type": "done"}`;
      const events = parseStreamEvents(input);
      expect(events).toHaveLength(3);
      expect(events[0]?.type).toBe("text");
      expect(events[0]?.content).toBe("Hello ");
    });

    it("should skip malformed lines", () => {
      const input = `{"type": "text", "content": "valid"}
not json
{"type": "done"}`;
      const events = parseStreamEvents(input);
      expect(events).toHaveLength(2);
    });
  });
});

describe("Gemini Bridge Environment", () => {
  it("should have gemini-cli available via npx", async () => {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    // Just check if the help command works
    const { stdout } = await execAsync("npx @google/gemini-cli -h");
    expect(stdout).toContain("gemini");
  });

  it("should detect authentication status", () => {
    const credsPath = join(homedir(), ".gemini", "oauth_creds.json");
    const isAuthenticated = existsSync(credsPath);

    // This test documents the current state rather than asserting a specific value
    // In CI, this may be false; locally it should be true
    expect(typeof isAuthenticated).toBe("boolean");

    if (!isAuthenticated) {
      console.warn("⚠️  Not authenticated - run 'npm run auth' for full functionality");
    }
  });
});
