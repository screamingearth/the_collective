#!/usr/bin/env node

/*
 * the_collective - Clean Script
 *
 * Removes build artifacts and dependencies with clear feedback.
 *
 * Usage:
 *   npm run clean              # Interactive confirmation
 *   npm run clean -- --force   # Skip confirmation (careful!)
 *   npm run clean -- --dry     # Preview only (no deletion)
 *   npm run clean -- --keep-db # Keep the memory database
 *   npm run clean -- --help    # Show help
 *
 * Flags:
 *   --force, -f    Skip confirmation (use in scripts)
 *   --dry, -n      Preview what would be deleted
 *   --keep-db      Don't delete the memory database
 *   --help, -h     Show this help
 * ============================================================================
 * This file is part of >the_collective.
 * Copyright (c) 2025 screamingearth.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const fs = require("fs");
const path = require("path");
const {
  colors: c,
  banner: drawBanner,
  drawBox,
  log,
  confirm: confirmPrompt,
} = require("./lib/ui.cjs");

const ROOT = path.resolve(__dirname, "..");

// Parse CLI arguments
const args = process.argv.slice(2);
const flags = {
  force: args.includes("--force") || args.includes("-f"),
  dry: args.includes("--dry") || args.includes("-n"),
  keepDb: args.includes("--keep-db"),
  help: args.includes("--help") || args.includes("-h"),
};

function showHelp() {
  drawBanner("Clean Script", "Remove build artifacts safely");

  drawBox(
    "Usage",
    [
      "npm run clean                 Interactive (asks before deleting)",
      "npm run clean -- --force      Skip confirmation (for scripts)",
      "npm run clean -- --dry        Preview only (no deletion)",
      "npm run clean -- --keep-db    Preserve memory database",
    ],
    { color: c.cyan },
  );

  drawBox(
    "Flags",
    [
      "--force, -f     Skip confirmation prompt",
      "--dry, -n       Preview only (no deletion)",
      "--keep-db       Don't delete memory database",
      "--help, -h      Show this help",
    ],
    { color: c.magenta },
  );

  drawBox(
    "What Gets Deleted",
    [
      "node_modules/               Root dependencies",
      ".collective/memory-server/node_modules/ Memory server dependencies",
      ".collective/memory-server/dist/         Compiled TypeScript",
      ".mcp/*.duckdb              Database files (unless --keep-db)",
    ],
    { color: c.red },
  );

  log(`\n${c.yellow}⚠  Warning:${c.reset} Deleting the database removes all stored memories!`);
  log(`   Use ${c.cyan}--keep-db${c.reset} to preserve them.\n`);
  process.exit(0);
}

if (flags.help) {
  showHelp();
}

// Targets to clean
const TARGETS = [
  { path: "node_modules", desc: "Root dependencies", category: "deps" },
  { path: ".collective/memory-server/node_modules", desc: "Memory server dependencies", category: "deps" },
  { path: ".collective/memory-server/dist", desc: "Compiled TypeScript", category: "build" },
  { path: ".mcp", pattern: "*.duckdb", desc: "Memory database", category: "db" },
  { path: ".mcp", pattern: "*.duckdb.wal", desc: "Database WAL", category: "db" },
];

/**
 * Get size of directory in human-readable format
 */
function getSize(targetPath) {
  const fullPath = path.join(ROOT, targetPath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }

  try {
    const stat = fs.statSync(fullPath);
    if (stat.isFile()) {
      return formatBytes(stat.size);
    }

    // For directories, just show existence (recursive size is slow)
    return "exists";
  } catch {
    return null;
  }
}

/**
 * Get matching files for glob pattern
 * Security: Uses bounded regex to prevent ReDoS attacks
 */
function getMatchingFiles(dir, pattern) {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) {
    return [];
  }

  try {
    const files = fs.readdirSync(fullDir);
    // Security: Use [^/]* instead of .* to prevent ReDoS and match only filenames
    const regex = new RegExp("^" + pattern.replace(/\*/g, "[^/]*") + "$");
    return files.filter((f) => regex.test(f)).map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

function formatBytes(bytes) {
  if (bytes === 0) {
    return "0 B";
  }
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Delete a path recursively
 */
function deletePath(targetPath) {
  const fullPath = path.join(ROOT, targetPath);
  if (!fs.existsSync(fullPath)) {
    return false;
  }

  fs.rmSync(fullPath, { recursive: true, force: true });
  return true;
}

async function main() {
  // Banner
  drawBanner("Clean", "Remove build artifacts");

  // Build list of things to delete
  const toDelete = [];

  for (const target of TARGETS) {
    // Skip database if --keep-db
    if (flags.keepDb && target.category === "db") {
      continue;
    }

    if (target.pattern) {
      // Glob pattern
      const matches = getMatchingFiles(target.path, target.pattern);
      for (const match of matches) {
        const size = getSize(match);
        if (size) {
          toDelete.push({ path: match, desc: target.desc, size, category: target.category });
        }
      }
    } else {
      // Direct path
      const size = getSize(target.path);
      if (size) {
        toDelete.push({ path: target.path, desc: target.desc, size, category: target.category });
      }
    }
  }

  if (toDelete.length === 0) {
    log(`${c.green}✨ Nothing to clean - already clean!${c.reset}\n`);
    process.exit(0);
  }

  // Show what will be deleted, grouped by category
  log(`${c.yellow}${c.bold}Will delete:${c.reset}\n`);

  const categories = {
    deps: { label: "Dependencies", items: [] },
    build: { label: "Build Artifacts", items: [] },
    db: { label: "Database", items: [] },
  };

  for (const item of toDelete) {
    categories[item.category].items.push(item);
  }

  for (const [, cat] of Object.entries(categories)) {
    if (cat.items.length > 0) {
      log(`  ${c.dim}${cat.label}:${c.reset}`);
      for (const item of cat.items) {
        log(`    ${c.red}✗${c.reset} ${item.path} ${c.dim}(${item.size})${c.reset}`);
      }
    }
  }

  log("");

  if (flags.dry) {
    log(`${c.cyan}🔍 Dry run - no files deleted${c.reset}\n`);
    process.exit(0);
  }

  // Confirm unless --force
  if (!flags.force) {
    const hasDb = toDelete.some((t) => t.category === "db");
    if (hasDb) {
      log(`${c.yellow}⚠  This will delete your memory database!${c.reset}`);
      log(`${c.dim}   Use --keep-db to preserve it${c.reset}\n`);
    }

    const ok = await confirmPrompt(`${c.yellow}Delete these files?${c.reset}`, false);
    if (!ok) {
      log(`\n${c.dim}Aborted${c.reset}\n`);
      process.exit(1);
    }
    log("");
  }

  // Delete
  let deleted = 0;

  for (const item of toDelete) {
    if (deletePath(item.path)) {
      log(`  ${c.green}✓${c.reset} Deleted ${item.path}`);
      deleted++;
    }
  }

  log(`\n${c.green}${c.bold}✅ Cleaned ${deleted} item(s)${c.reset}`);
  log(`\n${c.dim}Run ${c.reset}./setup.sh${c.dim} to reinstall everything${c.reset}\n`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
