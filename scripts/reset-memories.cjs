#!/usr/bin/env node

/**
 * the_collective - Memory Reset Script
 *
 * Resets the memory database for a fresh start.
 * Useful for:
 * - Preparing the framework for distribution
 * - Starting fresh on a new project
 * - Clearing sensitive project-specific memories
 *
 * Usage:
 *   npm run reset:memories              # Interactive prompt
 *   npm run reset:memories -- --force   # Skip confirmation
 *   npm run reset:memories -- --keep-core  # Keep core framework memories
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const {
  colors: c,
  banner: drawBanner,
  success,
  error,
  info,
  log,
} = require("./lib/ui.cjs");

const ROOT = path.resolve(__dirname, "..");
const MCP_DIR = path.join(ROOT, ".mcp");
const DB_PATH = path.join(MCP_DIR, "memories.db");
const MEMORY_SERVER = path.join(ROOT, ".collective/memory-server");

// Parse CLI arguments
const args = process.argv.slice(2);
const flags = {
  force: args.includes("--force") || args.includes("-f"),
  keepCore: args.includes("--keep-core") || args.includes("-k"),
  help: args.includes("--help") || args.includes("-h"),
};

/**
 * Show help and exit
 */
function showHelp() {
  drawBanner("Reset Memories", "Clean slate for the_collective");

  log(`
${c.bold}Usage:${c.reset}
  npm run reset:memories              Interactive prompt
  npm run reset:memories -- --force   Skip confirmation  
  npm run reset:memories -- --keep-core  Re-bootstrap core memories after reset

${c.bold}Options:${c.reset}
  -f, --force      Skip confirmation prompt
  -k, --keep-core  Re-run bootstrap after reset to restore core framework memories
  -h, --help       Show this help message

${c.bold}What this does:${c.reset}
  1. Deletes the memory database (.mcp/memories.db)
  2. Optionally re-bootstraps core framework memories

${c.bold}When to use:${c.reset}
  - Preparing framework for public release/distribution
  - Starting a new project with fresh context
  - Clearing sensitive or project-specific memories
  - Troubleshooting memory-related issues

${c.yellow}⚠️  This action cannot be undone!${c.reset}
`);
  process.exit(0);
}

/**
 * Prompt user for confirmation
 */
function confirm(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`${message} (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

/**
 * Get database stats if it exists
 */
function getDbStats() {
  if (!fs.existsSync(DB_PATH)) {
    return null;
  }

  const stats = fs.statSync(DB_PATH);
  return {
    size: (stats.size / 1024 / 1024).toFixed(2) + " MB",
    modified: stats.mtime.toLocaleString(),
  };
}

/**
 * Run npm command
 */
function npm(cmd, options = {}) {
  const { execSync } = require("child_process");
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  execSync(`${npmCmd} ${cmd}`, {
    cwd: options.cwd || ROOT,
    stdio: "inherit",
  });
}

/**
 * Main function
 */
async function main() {
  if (flags.help) {
    showHelp();
    return;
  }

  drawBanner("Reset Memories", "Fresh start for the_collective");

  // Check if database exists
  const dbStats = getDbStats();
  
  if (!dbStats) {
    info("No memory database found. Nothing to reset.");
    
    if (flags.keepCore) {
      log("\n📝 Bootstrapping core memories...\n");
      npm("run bootstrap", { cwd: MEMORY_SERVER });
      success("Core memories initialized!");
    }
    return;
  }

  // Show current state
  log(`
${c.bold}Current Memory Database:${c.reset}
  📁 Path: ${c.dim}${DB_PATH}${c.reset}
  📊 Size: ${c.cyan}${dbStats.size}${c.reset}
  📅 Last modified: ${c.dim}${dbStats.modified}${c.reset}
`);

  // Confirm unless --force
  if (!flags.force) {
    log(`${c.yellow}⚠️  This will permanently delete all stored memories!${c.reset}\n`);
    
    const confirmed = await confirm("Are you sure you want to reset?");
    if (!confirmed) {
      info("Reset cancelled.");
      return;
    }
  }

  // Delete the database
  log("\n🗑️  Deleting memory database...");
  try {
    fs.unlinkSync(DB_PATH);
    success("Memory database deleted!");
  } catch (err) {
    if (err.code === "EBUSY" || err.code === "EACCES") {
      error("Database is locked. Please close VS Code and try again.");
      process.exit(1);
    }
    throw err;
  }

  // Re-bootstrap if requested
  if (flags.keepCore) {
    log("\n📝 Re-bootstrapping core memories...\n");
    npm("run bootstrap", { cwd: MEMORY_SERVER });
    success("Core memories restored!");
  }

  // Done!
  log(`
${c.green}✨ Memory reset complete!${c.reset}

${flags.keepCore ? "Core framework memories have been restored." : "All memories have been cleared."}

${c.dim}Restart VS Code to ensure the MCP server reconnects to the fresh database.${c.reset}
`);
}

// Run
main().catch((err) => {
  error("Reset failed");
  console.error(err);
  process.exit(1);
});
