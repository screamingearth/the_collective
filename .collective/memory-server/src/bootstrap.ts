#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Bootstrap the_collective's core memories
 *
 * Run this after cloning from GitHub to populate essential knowledge.
 * Core memories are loaded from core-memories.json for easy maintenance.
 *
 * Uses console.log for user-facing CLI output.
 */

import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MemoryStore } from "./memory-store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface CoreMemory {
  content: string;
  type: "conversation" | "code" | "decision" | "context";
  importance: number;
  tags: string[];
}

interface CoreMemoriesFile {
  version: string;
  description?: string;
  memories: CoreMemory[];
}

/**
 * Load core memories from JSON file
 */
function loadCoreMemories(): CoreMemory[] {
  const memoriesPath = resolve(__dirname, "core-memories.json");
  
  try {
    const raw = readFileSync(memoriesPath, "utf-8");
    const data = JSON.parse(raw) as CoreMemoriesFile;
    
    if (!data.memories || !Array.isArray(data.memories)) {
      throw new Error("Invalid core-memories.json: missing 'memories' array");
    }
    
    console.log(`📁 Loaded ${data.memories.length} memories from core-memories.json (v${data.version})`);
    return data.memories;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ Failed to load core-memories.json: ${message}`);
    process.exit(1);
  }
}

async function bootstrap(): Promise<void> {
  console.log("🧠 Bootstrapping the_collective's core memories...\n");

  // Load memories from JSON
  const CORE_MEMORIES = loadCoreMemories();

  // Use env var or derive from workspace root (two levels up from .collective/memory-server/)
  const dbPath = process.env.MEMORY_DB_PATH ?? "../../.mcp/collective_memory.duckdb";

  // Ensure the directory exists
  mkdirSync(dirname(dbPath), { recursive: true });
  const store = new MemoryStore(dbPath);

  try {
    await store.initialize();
    console.log("✅ Memory store initialized\n");

    // Check if already bootstrapped
    const existing = await store.getRecentMemories({ limit: 100 });
    if (existing.length >= 20) {
      console.log(`ℹ️  Found ${existing.length} existing memories`);
      console.log("✨ Core memories already bootstrapped - skipping\n");
      console.log("💡 To re-bootstrap, delete the database file and run again:");
      console.log(`   rm ${dbPath}\n`);
      await store.close();
      return;
    }

    console.log(`📊 Found ${existing.length} existing memories, adding core memories...\n`);

    let stored = 0;
    for (const memory of CORE_MEMORIES) {
      await store.storeMemory(memory.content, memory.type, memory.importance, memory.tags);
      stored++;
      process.stdout.write(`\r📝 Stored: ${stored}/${CORE_MEMORIES.length}`);
    }

    const total = existing.length + stored;
    console.log("\n\n🎉 Bootstrap complete!");
    console.log(`   Added ${stored} core memories`);
    console.log(`   Total memories in database: ${total}`);
    console.log("   the_collective is ready to remember.\n");

    // Test semantic search
    console.log("🔍 Testing semantic search...");
    const results = await store.searchMemories("How should I structure Python code?", {
      limit: 3,
      min_similarity: 0.3,
    });
    console.log(`✅ Found ${results.length} relevant memories\n`);

    await store.close();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Bootstrap failed:", message);
    await store.close();
    process.exit(1);
  }
}

void bootstrap();
