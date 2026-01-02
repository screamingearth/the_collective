#!/usr/bin/env node
/**
 * CLI Entry Point for >the_collective
 * Part of >the_collective by screamingearth (Apache 2.0 licensed)
 *
 * Usage:
 *   npx the_collective <command> [options]
 *
 * Commands:
 *   install   - Install into an existing project
 *   uninstall - Remove from a project
 *   update    - Update to latest version
 *   doctor    - Check installation health
 *   mode      - Switch between docker/local mode
 *   help      - Show help
 */

const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

// Import workspace utilities
let workspace;
try {
  workspace = require("./lib/workspace.cjs");
} catch {
  // Running from npm package, workspace not found
  workspace = null;
}

const VERSION = getVersion();
const COMMANDS = {
  install: {
    script: "install-external.cjs",
    description: "Install the_collective into an existing project",
    examples: [
      "npx the_collective install",
      "npx the_collective install --mode=docker",
      "npx the_collective install --dry-run",
    ],
  },
  uninstall: {
    script: "uninstall-external.cjs",
    description: "Remove the_collective from a project",
    examples: [
      "npx the_collective uninstall",
      "npx the_collective uninstall --keep-data",
      "npx the_collective uninstall --force",
    ],
  },
  update: {
    script: "update-external.cjs",
    description: "Update the_collective to the latest version",
    examples: [
      "npx the_collective update",
      "npx the_collective update --check",
    ],
  },
  doctor: {
    script: "doctor.cjs",
    description: "Check installation health and diagnose issues",
    examples: [
      "npx the_collective doctor",
      "npx the_collective doctor --fix",
    ],
  },
  mode: {
    script: "mode.cjs",
    description: "Switch between docker and stdio modes",
    examples: [
      "npx the_collective mode docker",
      "npx the_collective mode stdio",
    ],
  },
  help: {
    handler: showHelp,
    description: "Show this help message",
  },
  version: {
    handler: showVersion,
    description: "Show version information",
  },
};

/**
 * Get package version
 */
function getVersion() {
  try {
    const pkgPath = path.join(__dirname, "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

/**
 * Show main help
 */
function showHelp() {
  console.log(`
>the_collective v${VERSION}
Multi-agent AI framework for VS Code Copilot

Usage:
  npx the_collective <command> [options]

Commands:`);

  for (const [name, cmd] of Object.entries(COMMANDS)) {
    console.log(`  ${name.padEnd(12)} ${cmd.description}`);
  }

  console.log(`
Quick Start:
  npx the_collective install     # Install into your project
  npx the_collective doctor      # Check everything is working

For command-specific help:
  npx the_collective <command> --help

Documentation:
  https://github.com/screamingearth/the_collective

Examples:`);

  // Show a few examples
  console.log("  npx the_collective install --mode=docker");
  console.log("  npx the_collective update");
  console.log("  npx the_collective uninstall --keep-data");
  console.log("");
}

/**
 * Show version
 */
function showVersion() {
  console.log(`>the_collective v${VERSION}`);

  // Show component versions if installed
  if (workspace) {
    const installDir = workspace.findWorkspaceRoot(process.cwd());
    if (installDir) {
      const installed = workspace.isCollectiveInstalled(installDir);
      if (installed.installed) {
        console.log(`Installed: v${installed.version} (${installed.mode} mode)`);

        // Check component versions
        const collectiveDir = path.join(installDir, ".collective");
        const components = ["memory-server", "gemini-bridge"];

        for (const comp of components) {
          const pkgPath = path.join(collectiveDir, comp, "package.json");
          if (fs.existsSync(pkgPath)) {
            try {
              const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
              console.log(`  ${comp}: v${pkg.version}`);
            } catch {
              // Ignore
            }
          }
        }
      }
    }
  }
}

/**
 * Run a script with arguments
 */
function runScript(scriptName, args) {
  const scriptPath = path.join(__dirname, scriptName);

  // Check if script exists
  if (!fs.existsSync(scriptPath)) {
    console.error(`Error: Command not yet implemented (${scriptName})`);
    console.error("This feature is coming soon!");
    process.exit(1);
  }

  // Run the script
  const child = spawn(process.execPath, [scriptPath, ...args], {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  child.on("exit", (code) => {
    process.exit(code || 0);
  });

  child.on("error", (error) => {
    console.error(`Error running command: ${error.message}`);
    process.exit(1);
  });
}

/**
 * Main entry point
 */
function main() {
  const args = process.argv.slice(2);

  // No command - show help
  if (args.length === 0) {
    showHelp();
    process.exit(0);
  }

  const command = args[0].toLowerCase();
  const commandArgs = args.slice(1);

  // Handle version flags
  if (command === "-v" || command === "--version") {
    showVersion();
    process.exit(0);
  }

  // Handle help flags
  if (command === "-h" || command === "--help") {
    showHelp();
    process.exit(0);
  }

  // Look up command
  const cmd = COMMANDS[command];

  if (!cmd) {
    console.error(`Unknown command: ${command}`);
    console.error("");
    console.error("Available commands:");
    for (const name of Object.keys(COMMANDS)) {
      console.error(`  ${name}`);
    }
    console.error("");
    console.error("Run 'npx the_collective help' for more information.");
    process.exit(1);
  }

  // Run command
  if (cmd.handler) {
    // Built-in handler
    cmd.handler();
  } else if (cmd.script) {
    // External script
    runScript(cmd.script, commandArgs);
  }
}

main();
