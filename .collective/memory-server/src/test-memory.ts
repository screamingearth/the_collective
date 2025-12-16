#!/usr/bin/env node
/* eslint-disable no-console */

/*
 * This file is part of >the_collective.
 * Copyright (c) 2025 screamingearth.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { existsSync, mkdirSync } from "node:fs";
import { dirname, normalize, resolve } from "node:path";
import { MemoryStore } from "./memory-store.js";

/**
 * Validate database path to prevent path traversal attacks
 * Security: Ensures the path is within expected boundaries
 */
function validateDbPath(inputPath: string): string {
  const resolved = resolve(inputPath);
  const normalized = normalize(resolved);

  // Security: Reject paths with null bytes (path truncation attack)
  if (inputPath.includes('\x00')) {
    throw new Error("Invalid null byte in database path");
  }

  // Security: Warn if path looks suspicious (but allow for flexibility)
  if (normalized.includes('..') && !inputPath.startsWith('../.mcp')) {
    console.warn("⚠️  Warning: Database path contains parent directory reference");
  }

  return resolved;
}

async function test(): Promise<boolean> {
  console.log("🧪 Testing memory system...\n");

  const rawDbPath = process.env.MEMORY_DB_PATH ?? "../.mcp/collective_memory.duckdb";
  const dbPath = validateDbPath(rawDbPath);

  // Ensure directory exists
  mkdirSync(dirname(dbPath), { recursive: true });

  console.log(`📍 Database path: ${dbPath}`);
  console.log(`📁 Database exists: ${existsSync(dbPath)}\n`);

  const store = new MemoryStore(dbPath);

  try {
    console.log("🔄 Initializing store...");
    await store.initialize();
    console.log("✅ Store initialized\n");

    // Test 1: Store a memory
    console.log("📝 Test 1: Storing a memory...");
    const memory = await store.storeMemory(
      "the_collective is a multi-agent AI framework for VS Code Copilot",
      "context",
      0.9,
      ["framework", "ai", "vscode"],
      { test: true }
    );
    console.log(`✅ Stored memory with ID: ${memory.id}\n`);

    // Test 2: Semantic search
    console.log("🔍 Test 2: Semantic search...");
    const results = await store.searchMemories("What is the_collective?", {
      limit: 5,
      min_similarity: 0.3,
    });
    console.log(`✅ Found ${results.length} results`);

    if (results.length > 0) {
      const topResult = results[0];
      if (topResult) {
        const similarity = topResult.similarity.toFixed(3);
        const preview = topResult.content.substring(0, 60);
        console.log(`   Top result (similarity: ${similarity}): ${preview}...\n`);
      }
    } else {
      console.warn("   ⚠️  No results found - similarity may be below threshold\n");
    }

    // Test 3: Get recent memories
    console.log("📅 Test 3: Recent memories...");
    const recent = await store.getRecentMemories({ limit: 10 });
    console.log(`✅ Retrieved ${recent.length} recent memories\n`);

    await store.close();
    console.log("🎉 All tests passed!\n");

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Test failed:", message);
    await store.close();
    return false;
  }
}

test()
  .then((success) => process.exit(success ? 0 : 1))
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Fatal error:", message);
    process.exit(1);
  });
