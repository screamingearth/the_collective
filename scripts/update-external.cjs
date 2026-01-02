#!/usr/bin/env node
/**
 * Update Script - Update the_collective to latest version
 * Part of >the_collective by screamingearth (Apache 2.0 licensed)
 *
 * Usage:
 *   npx the_collective update [options]
 *   node scripts/update-external.cjs [options]
 *
 * Options:
 *   --check         Check for updates without applying
 *   --force         Update without prompting
 *   --verbose       Verbose output
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const readline = require("readline");
const https = require("https");

// Import utilities
let workspace, ui;

try {
  workspace = require("./lib/workspace.cjs");
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

// Parse args
function parseArgs(args) {
  const options = {
    check: false,
    force: false,
    verbose: false,
  };

  for (const arg of args) {
    if (arg === "--check" || arg === "-c") {
      options.check = true;
    }
    if (arg === "--force" || arg === "-f") {
      options.force = true;
    }
    if (arg === "--verbose" || arg === "-v") {
      options.verbose = true;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
>the_collective update - Update to latest version

Usage:
  npx the_collective update [options]

Options:
  --check, -c     Check for updates without applying
  --force, -f     Update without prompting
  --verbose, -v   Verbose output
  --help, -h      Show this help

Examples:
  npx the_collective update --check   # Check for updates
  npx the_collective update           # Interactive update
  npx the_collective update --force   # Update without prompting
`);
}

/**
 * Prompt for confirmation
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
 * Fetch latest version from GitHub
 */
function fetchLatestVersion() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.github.com",
      path: "/repos/screamingearth/the_collective/releases/latest",
      headers: { "User-Agent": "the_collective-updater" },
    };

    https
      .get(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const release = JSON.parse(data);
            resolve({
              version: release.tag_name?.replace(/^v/, "") || "unknown",
              url: release.html_url,
              notes: release.body,
              published: release.published_at,
            });
          } catch {
            // No releases yet - check package.json in main branch
            resolve({ version: "0.1.0", url: null, notes: null, published: null });
          }
        });
      })
      .on("error", reject);
  });
}

/**
 * Get current installed version
 */
function getCurrentVersion(installDir) {
  // Check collective.config.json first
  const configPath = path.join(installDir, "collective.config.json");
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (config.version) {
        return config.version;
      }
    } catch {
      // Fall through
    }
  }

  // Check .collective/memory-server/package.json
  const pkgPath = path.join(installDir, ".collective", "memory-server", "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      return pkg.version || "0.0.0";
    } catch {
      // Fall through
    }
  }

  return "0.0.0";
}

/**
 * Compare versions (semver)
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const a = parts1[i] || 0;
    const b = parts2[i] || 0;
    if (a > b) {
      return 1;
    }
    if (a < b) {
      return -1;
    }
  }
  return 0;
}

/**
 * Perform the update
 */
function performUpdate(installDir, verbose) {
  const collectiveDir = path.join(installDir, ".collective");

  // Stop Docker containers if running
  ui.info("Stopping services...");
  try {
    execSync("docker compose down", {
      cwd: installDir,
      stdio: "pipe",
    });
  } catch {
    // Ignore - might not be using Docker
  }

  // Pull latest from git
  ui.info("Pulling latest changes...");
  try {
    execSync("git pull origin main", {
      cwd: installDir,
      stdio: verbose ? "inherit" : "pipe",
    });
  } catch (error) {
    throw new Error(`Git pull failed: ${error.message}`);
  }

  // Reinstall dependencies
  ui.info("Updating dependencies...");
  execSync("npm install", {
    cwd: path.join(collectiveDir, "memory-server"),
    stdio: verbose ? "inherit" : "pipe",
  });
  execSync("npm install", {
    cwd: path.join(collectiveDir, "gemini-bridge"),
    stdio: verbose ? "inherit" : "pipe",
  });

  // Rebuild TypeScript
  ui.info("Rebuilding...");
  execSync("npm run build", {
    cwd: path.join(collectiveDir, "memory-server"),
    stdio: verbose ? "inherit" : "pipe",
  });
  execSync("npm run build", {
    cwd: path.join(collectiveDir, "gemini-bridge"),
    stdio: verbose ? "inherit" : "pipe",
  });

  // Update config
  const configPath = path.join(installDir, "collective.config.json");
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      config.updatedAt = new Date().toISOString();
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
    } catch {
      // Ignore config update errors
    }
  }

  // Restart services
  ui.info("Restarting services...");
  try {
    execSync("docker compose up -d", {
      cwd: installDir,
      stdio: verbose ? "inherit" : "pipe",
    });
  } catch {
    ui.warn("Docker restart skipped (local mode or Docker not available)");
  }
}

/**
 * Main update function
 */
async function update(options) {
  const targetDir = process.cwd();

  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║              >the_collective - Update                        ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");

  // Find installation
  ui.step(1, 3, "Checking installation...");

  let installDir = targetDir;
  if (workspace) {
    const workspaceRoot = workspace.findWorkspaceRoot(targetDir);
    if (workspaceRoot) {
      installDir = workspaceRoot;
    }

    const installed = workspace.isCollectiveInstalled(installDir);
    if (!installed.installed) {
      ui.error("the_collective is not installed in this project.");
      ui.info("Run 'npx the_collective install' to install.");
      process.exit(1);
    }
  }

  const currentVersion = getCurrentVersion(installDir);
  ui.info(`Current version: ${currentVersion}`);

  // Check for updates
  ui.step(2, 3, "Checking for updates...");

  let latest;
  try {
    latest = await fetchLatestVersion();
    ui.info(`Latest version: ${latest.version}`);
  } catch (error) {
    ui.error(`Failed to check for updates: ${error.message}`);
    process.exit(1);
  }

  const comparison = compareVersions(latest.version, currentVersion);

  if (comparison <= 0) {
    console.log("");
    ui.success("You're already on the latest version! 🎉");
    console.log("");
    process.exit(0);
  }

  // Show what's new
  console.log("");
  console.log(`Update available: ${currentVersion} → ${latest.version}`);
  if (latest.notes) {
    console.log("");
    console.log("Release notes:");
    console.log(latest.notes.slice(0, 500) + (latest.notes.length > 500 ? "..." : ""));
  }
  console.log("");

  if (options.check) {
    ui.info("Run 'npx the_collective update' to apply this update.");
    process.exit(0);
  }

  // Confirm update
  if (!options.force) {
    const proceed = await confirm("Apply this update?");
    if (!proceed) {
      ui.info("Update cancelled.");
      process.exit(0);
    }
  }

  // Perform update
  ui.step(3, 3, "Applying update...");

  try {
    performUpdate(installDir, options.verbose);
  } catch (error) {
    ui.error(`Update failed: ${error.message}`);
    process.exit(1);
  }

  // Success
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║                    Update Complete!                          ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");
  ui.success(`Updated to version ${latest.version}`);
  console.log("");
  ui.info("Please reload VS Code to apply changes.");
  console.log("");
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  try {
    await update(options);
  } catch (error) {
    ui.error(`Update failed: ${error.message}`);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
