#!/usr/bin/env node
/**
 * External Uninstallation Script
 * Part of >the_collective by screamingearth (Apache 2.0 licensed)
 *
 * Removes the_collective from a project.
 *
 * Usage:
 *   npx the_collective uninstall [options]
 *   node scripts/uninstall-external.cjs [options]
 *
 * Options:
 *   --force          Don't prompt for confirmation
 *   --keep-data      Keep .mcp/ directory (memories)
 *   --keep-config    Keep collective.config.json
 *   --verbose        Verbose output
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const readline = require("readline");

// Import our utilities
const { findWorkspaceRoot, isCollectiveInstalled, getConfig } = require("./lib/workspace.cjs");

const { removeCopilotInstructionsSection, removeCollectiveServers, removeCollectiveTasks, removeGitignoreSection, restoreFromBackup } = require("./lib/merge.cjs");

// UI helpers
let ui;
try {
  ui = require("./lib/ui.cjs");
} catch {
  ui = {
    success: (msg) => console.log(`✓ ${msg}`),
    error: (msg) => console.log(`✗ ${msg}`),
    warn: (msg) => console.log(`⚠ ${msg}`),
    info: (msg) => console.log(`ℹ ${msg}`),
    step: (current, total, msg) => console.log(`\n[${current}/${total}] ${msg}`),
  };
}

// Default options
const DEFAULT_OPTIONS = {
  force: false,
  keepData: false,
  keepConfig: false,
  verbose: false,
};

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const options = { ...DEFAULT_OPTIONS };

  for (const arg of args) {
    if (arg === "--force" || arg === "-f") {
      options.force = true;
    } else if (arg === "--keep-data") {
      options.keepData = true;
    } else if (arg === "--keep-config") {
      options.keepConfig = true;
    } else if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
>the_collective - Uninstall from project

Usage:
  npx the_collective uninstall [options]
  node scripts/uninstall-external.cjs [options]

Options:
  --force, -f       Don't prompt for confirmation
  --keep-data       Keep .mcp/ directory (preserves memories)
  --keep-config     Keep collective.config.json
  --verbose, -v     Verbose output
  --help, -h        Show this help message

Examples:
  npx the_collective uninstall              # Interactive uninstall
  npx the_collective uninstall --force      # Uninstall without prompting
  npx the_collective uninstall --keep-data  # Preserve memory database
`);
}

/**
 * Prompt user for confirmation
 */
function confirm(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${question} [y/N]: `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

/**
 * Find most recent backup directory
 */
function findLatestBackup(installDir) {
  const entries = fs.readdirSync(installDir, { withFileTypes: true });

  const backups = entries.filter((e) => e.isDirectory() && e.name.startsWith(".collective-backup-")).sort((a, b) => b.name.localeCompare(a.name));

  if (backups.length > 0) {
    return path.join(installDir, backups[0].name);
  }
  return null;
}

/**
 * Remove directory recursively with error handling
 */
function removeDir(dir, verbose = false) {
  if (!fs.existsSync(dir)) {
    return;
  }

  try {
    fs.rmSync(dir, { recursive: true, force: true });
    if (verbose) {
      ui.info(`Removed: ${dir}`);
    }
  } catch (error) {
    ui.warn(`Could not remove ${dir}: ${error.message}`);
  }
}

/**
 * Main uninstallation function
 */
async function uninstall(options) {
  const targetDir = process.cwd();

  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║          >the_collective - Uninstallation                    ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");

  // Step 1: Detect installation
  ui.step(1, 5, "Detecting installation...");

  const workspaceRoot = findWorkspaceRoot(targetDir);
  const installDir = workspaceRoot || targetDir;

  const installed = isCollectiveInstalled(installDir);
  if (!installed.installed) {
    ui.error("the_collective is not installed in this project.");
    ui.info("Nothing to uninstall.");
    process.exit(1);
  }

  ui.info(`Found installation: v${installed.version} (${installed.mode} mode)`);

  const _config = getConfig(installDir);

  // Step 2: Show what will be removed
  ui.step(2, 5, "Analyzing installation...");

  const toRemove = {
    directories: [path.join(installDir, ".collective"), path.join(installDir, ".github", "agents"), path.join(installDir, ".github", "instructions")],
    files: [],
    modifications: [],
  };

  // Check for docker-compose.yml
  const composePath = path.join(installDir, "docker-compose.yml");
  if (fs.existsSync(composePath)) {
    toRemove.files.push(composePath);
  }

  // Check for collective.config.json
  if (!options.keepConfig) {
    const configPath = path.join(installDir, "collective.config.json");
    if (fs.existsSync(configPath)) {
      toRemove.files.push(configPath);
    }
  }

  // Check for .mcp directory
  if (!options.keepData) {
    const mcpPath = path.join(installDir, ".mcp");
    if (fs.existsSync(mcpPath)) {
      toRemove.directories.push(mcpPath);
    }
  }

  // Files that will be modified (not removed)
  const modifiedFiles = [".github/copilot-instructions.md", ".vscode/mcp.json", ".vscode/tasks.json", ".gitignore"];

  for (const file of modifiedFiles) {
    const fullPath = path.join(installDir, file);
    if (fs.existsSync(fullPath)) {
      toRemove.modifications.push(fullPath);
    }
  }

  console.log("");
  console.log("Will be removed:");
  for (const dir of toRemove.directories) {
    if (fs.existsSync(dir)) {
      console.log(`  📁 ${path.relative(installDir, dir)}/`);
    }
  }
  for (const file of toRemove.files) {
    console.log(`  📄 ${path.relative(installDir, file)}`);
  }

  if (toRemove.modifications.length > 0) {
    console.log("");
    console.log("Will be modified (collective sections removed):");
    for (const file of toRemove.modifications) {
      console.log(`  📝 ${path.relative(installDir, file)}`);
    }
  }

  if (options.keepData) {
    console.log("");
    ui.info("Memory database will be preserved (--keep-data)");
  }

  if (options.keepConfig) {
    console.log("");
    ui.info("Config file will be preserved (--keep-config)");
  }

  // Step 3: Confirm
  console.log("");
  if (!options.force) {
    const proceed = await confirm("Proceed with uninstallation?");
    if (!proceed) {
      ui.info("Uninstallation cancelled.");
      process.exit(0);
    }
  }

  // Step 4: Stop services
  ui.step(3, 5, "Stopping services...");

  // Try to stop Docker containers
  try {
    execSync("docker compose down", {
      cwd: installDir,
      stdio: "pipe",
    });
    ui.success("Stopped Docker containers");
  } catch {
    if (options.verbose) {
      ui.info("No Docker containers to stop");
    }
  }

  // Step 5: Remove files and directories
  ui.step(4, 5, "Removing files...");

  // Find backup directory for potential restoration
  const backupDir = findLatestBackup(installDir);
  if (backupDir && options.verbose) {
    ui.info(`Found backup at: ${path.basename(backupDir)}`);
  }

  // Remove directories
  for (const dir of toRemove.directories) {
    if (fs.existsSync(dir)) {
      removeDir(dir, options.verbose);
      ui.success(`Removed ${path.relative(installDir, dir)}/`);
    }
  }

  // Remove files
  for (const file of toRemove.files) {
    if (fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
        ui.success(`Removed ${path.relative(installDir, file)}`);
      } catch (error) {
        ui.warn(`Could not remove ${file}: ${error.message}`);
      }
    }
  }

  // Modify files to remove collective sections
  for (const file of toRemove.modifications) {
    const fileName = path.basename(file);
    const backupFile = backupDir ? path.join(backupDir, fileName) : null;

    try {
      if (backupFile && fs.existsSync(backupFile)) {
        // Restore from backup
        restoreFromBackup(backupFile, file);
        ui.success(`Restored ${path.relative(installDir, file)} from backup`);
      } else {
        // Try to remove our section from the file
        const content = fs.readFileSync(file, "utf8");
        let modified = content;

        if (fileName === "copilot-instructions.md") {
          modified = removeCopilotInstructionsSection(content);
        } else if (fileName === "mcp.json") {
          try {
            const json = JSON.parse(content);
            const cleaned = removeCollectiveServers(json);
            modified = JSON.stringify(cleaned, null, 2) + "\n";
          } catch {
            // Invalid JSON, leave as is
          }
        } else if (fileName === "tasks.json") {
          try {
            // Remove JSONC comments for parsing
            const jsonContent = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "");
            const json = JSON.parse(jsonContent);
            const cleaned = removeCollectiveTasks(json);
            modified = JSON.stringify(cleaned, null, 2) + "\n";
          } catch {
            // Invalid JSON, leave as is
          }
        } else if (fileName === ".gitignore") {
          modified = removeGitignoreSection(content);
        }

        if (modified !== content) {
          fs.writeFileSync(file, modified);
          ui.success(`Cleaned ${path.relative(installDir, file)}`);
        }
      }
    } catch (error) {
      ui.warn(`Could not modify ${file}: ${error.message}`);
    }
  }

  // Clean up empty .github directory if empty
  const githubDir = path.join(installDir, ".github");
  if (fs.existsSync(githubDir)) {
    const remaining = fs.readdirSync(githubDir);
    // Only copilot-instructions.md might remain
    if (remaining.length <= 1 && (!remaining[0] || remaining[0] === "copilot-instructions.md")) {
      // Check if copilot-instructions.md is now empty or just has whitespace
      const copilotPath = path.join(githubDir, "copilot-instructions.md");
      if (fs.existsSync(copilotPath)) {
        const content = fs.readFileSync(copilotPath, "utf8").trim();
        if (!content) {
          fs.unlinkSync(copilotPath);
          fs.rmdirSync(githubDir);
          ui.info("Removed empty .github/ directory");
        }
      }
    }
  }

  // Step 6: Cleanup
  ui.step(5, 5, "Finalizing...");

  // Ask about removing backups
  const backupDirs = fs.readdirSync(installDir).filter((f) => f.startsWith(".collective-backup-"));

  if (backupDirs.length > 0 && !options.force) {
    console.log("");
    console.log(`Found ${backupDirs.length} backup director${backupDirs.length === 1 ? "y" : "ies"}:`);
    for (const backup of backupDirs) {
      console.log(`  📁 ${backup}/`);
    }

    const removeBackups = await confirm("Remove backup directories?");
    if (removeBackups) {
      for (const backup of backupDirs) {
        removeDir(path.join(installDir, backup), options.verbose);
      }
      ui.success("Removed backup directories");
    } else {
      ui.info("Backup directories preserved");
    }
  }

  // Success message
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║                   Uninstallation Complete!                   ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");
  ui.success("the_collective has been removed from this project.");
  console.log("");

  if (options.keepData) {
    ui.info("Memory database preserved in .mcp/");
    ui.info("To reinstall and keep your memories, run:");
    console.log("  npx the_collective install");
    console.log("");
  }

  console.log("To reinstall in the future:");
  console.log("  npx the_collective install");
  console.log("");
}

// Main entry point
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  try {
    await uninstall(options);
  } catch (error) {
    ui.error(`Uninstallation failed: ${error.message}`);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
