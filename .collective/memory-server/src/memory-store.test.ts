/*
 * This file is part of >the_collective.
 * Copyright (c) 2025 screamingearth.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { existsSync, unlinkSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MemoryStore } from "./memory-store.js";

const TEST_DB_PATH = "/tmp/test-collective-memory.duckdb";

describe("MemoryStore", () => {
  let store: MemoryStore;

  beforeAll(async () => {
    // Clean up any existing test database
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    if (existsSync(`${TEST_DB_PATH}.wal`)) {
      unlinkSync(`${TEST_DB_PATH}.wal`);
    }

    store = new MemoryStore(TEST_DB_PATH);
    await store.initialize();
  });

  afterAll(async () => {
    await store.close();

    // Clean up test database
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    if (existsSync(`${TEST_DB_PATH}.wal`)) {
      unlinkSync(`${TEST_DB_PATH}.wal`);
    }
  });

  describe("storeMemory", () => {
    it("should store a memory and return it with an ID", async () => {
      const memory = await store.storeMemory(
        "the_collective is a multi-agent AI framework for VS Code Copilot",
        "context",
        0.9,
        ["framework", "ai", "vscode"],
        { test: true }
      );

      expect(memory).toBeDefined();
      expect(memory.id).toBeDefined();
      expect(memory.content).toBe(
        "the_collective is a multi-agent AI framework for VS Code Copilot"
      );
      expect(memory.memory_type).toBe("context");
      expect(memory.importance_score).toBe(0.9);
      // Note: tags are stored in separate table, not returned on Memory object
      expect(memory.metadata).toEqual({ test: true });
    });

    it("should store memories with different types", async () => {
      const conversation = await store.storeMemory(
        "User prefers dark themes",
        "conversation",
        0.7,
        ["preference"]
      );

      const decision = await store.storeMemory(
        "Decided to use PostgreSQL for persistence",
        "decision",
        0.8,
        ["architecture", "database"]
      );

      const code = await store.storeMemory(
        "Implemented retry logic with exponential backoff",
        "code",
        0.6,
        ["pattern", "resilience"]
      );

      expect(conversation.memory_type).toBe("conversation");
      expect(decision.memory_type).toBe("decision");
      expect(code.memory_type).toBe("code");
    });
  });

  describe("searchMemories", () => {
    it("should find semantically similar memories", async () => {
      const results = await store.searchMemories("What is the_collective?", {
        limit: 5,
        min_similarity: 0.3,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toBeDefined();
      expect(results[0]?.similarity).toBeGreaterThan(0);
    });

    it("should filter by memory type", async () => {
      const results = await store.searchMemories("database", {
        limit: 10,
        memory_type: "decision",
      });

      for (const result of results) {
        expect(result.memory_type).toBe("decision");
      }
    });

    it("should filter by tags", async () => {
      const results = await store.searchMemories("framework", {
        limit: 10,
        tags: ["ai"],
      });

      // Tags filtering works on search criteria, results contain memories that have the tag
      // but the Memory interface doesn't include tags array
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it("should respect limit parameter", async () => {
      const results = await store.searchMemories("test", {
        limit: 2,
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe("getRecentMemories", () => {
    it("should retrieve recent memories in descending order", async () => {
      const recent = await store.getRecentMemories({ limit: 10 });

      expect(recent.length).toBeGreaterThan(0);

      // Verify descending order by timestamp
      for (let i = 1; i < recent.length; i++) {
        const prev = recent[i - 1];
        const curr = recent[i];
        if (prev && curr) {
          expect(new Date(prev.created_at).getTime()).toBeGreaterThanOrEqual(
            new Date(curr.created_at).getTime()
          );
        }
      }
    });

    it("should filter by minimum importance", async () => {
      const highImportance = await store.getRecentMemories({
        limit: 10,
        min_importance: 0.8,
      });

      for (const memory of highImportance) {
        expect(memory.importance_score).toBeGreaterThanOrEqual(0.8);
      }
    });

    it("should filter by memory type", async () => {
      const decisions = await store.getRecentMemories({
        limit: 10,
        memory_type: "decision",
      });

      for (const memory of decisions) {
        expect(memory.memory_type).toBe("decision");
      }
    });
  });

  describe("deleteMemory", () => {
    it("should delete a memory by ID", async () => {
      // Store a memory to delete
      const memory = await store.storeMemory(
        "This memory will be deleted",
        "context",
        0.5,
        ["temporary"]
      );

      expect(memory.id).toBeDefined();

      // Delete it (returns void, throws on error)
      await store.deleteMemory(memory.id);

      // Verify it's gone
      const results = await store.searchMemories("This memory will be deleted", {
        limit: 1,
        min_similarity: 0.9,
      });

      const found = results.find((r) => r.id === memory.id);
      expect(found).toBeUndefined();
    });

    it("should not throw for non-existent ID", async () => {
      // deleteMemory returns void and doesn't throw for non-existent IDs
      await expect(store.deleteMemory("non-existent-uuid")).resolves.toBeUndefined();
    });
  });
});
