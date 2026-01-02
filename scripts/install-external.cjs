#!/usr/bin/env node
/**
 * External Installation Script
 * Part of >the_collective by screamingearth (Apache 2.0 licensed)
 *
 * Installs the_collective into an existing project.
 *
 * Usage:
 *   npx the_collective install [options]
 *   node scripts/install-external.cjs [options]
 *
 * Options:
 *   --force          Overwrite existing files without prompting
 *   --mode=docker    Use Docker mode (default)
 *   --mode=local     Use local/stdio mode
 *   --no-docker      Alias for --mode=local
 *   --dry-run        Show what would be done without doing it
 *   --no-backup      Skip backup creation
 *   --components     Comma-separated: memory,gemini,agents (default: all)
 *   --skip-deps      Skip npm install (for CI/testing)
 *   --skip-build     Skip building TypeScript
 *   --verbose        Verbose output
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const readline = require("readline");
const https = require("https");

// Import our utilities
const { findProjectRoot, isCollectiveInstalled, detectNestedInstallation, getProjectType, getSuggestedConfig, saveConfig } = require("./lib/workspace.cjs");

const { mergeCopilotInstructions, mergeMcpJson, mergeSettings, mergeTasks, mergeGitignore, createBackup, COLLECTIVE_GITIGNORE_PATTERNS } = require("./lib/merge.cjs");

const { runPreflightChecks, printPreflightResults, isSelinuxEnforcing } = require("./lib/preflight.cjs");

const { createConfig } = require("./lib/config.cjs");

// UI helpers from existing lib
let ui;
try {
  ui = require("./lib/ui.cjs");
} catch {
  // Fallback if ui.cjs doesn't exist
  ui = {
    success: (msg) => console.log(`✓ ${msg}`),
    error: (msg) => console.log(`✗ ${msg}`),
    warn: (msg) => console.log(`⚠ ${msg}`),
    info: (msg) => console.log(`ℹ ${msg}`),
    step: (current, total, msg) => console.log(`\n[${current}/${total}] ${msg}`),
  };
}

// GitHub repo info
const REPO_OWNER = "screamingearth";
const REPO_NAME = "the_collective";
const REPO_BRANCH = "main";

// Files/directories to copy from the_collective
const _FRAMEWORK_FILES = {
  directories: [".collective", ".github/agents", ".github/instructions"],
  files: [".github/copilot-instructions.md"],
  vscodeFiles: ["mcp.json", "mcp.local.json", "mcp.docker.json", "tasks.json", "settings.json", "extensions.json"],
};

// Default options
const DEFAULT_OPTIONS = {
  force: false,
  mode: "docker",
  dryRun: false,
  backup: true,
  components: ["memory", "gemini", "agents"],
  skipDeps: false,
  skipBuild: false,
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
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--no-backup") {
      options.backup = false;
    } else if (arg === "--no-docker" || arg === "--stdio") {
      options.mode = "stdio";
    } else if (arg.startsWith("--mode=")) {
      let mode = arg.split("=")[1];
      // Normalize local -> stdio
      if (mode === "local") {
        mode = "stdio";
      }
      options.mode = mode;
    } else if (arg.startsWith("--components=")) {
      options.components = arg.split("=")[1].split(",");
    } else if (arg === "--skip-deps") {
      options.skipDeps = true;
    } else if (arg === "--skip-build") {
      options.skipBuild = true;
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
>the_collective - Install into existing project

Usage:
  npx the_collective install [options]
  node scripts/install-external.cjs [options]

Options:
  --force, -f       Overwrite existing files without prompting
  --mode=docker     Use Docker/SSE for MCP servers (default)
  --mode=stdio      Use Node.js/stdio for MCP servers
  --no-docker       Alias for --mode=stdio
  --dry-run         Show what would be done without making changes
  --no-backup       Skip creating backups of modified files
  --components=...  Comma-separated list: memory,gemini,agents (default: all)
  --skip-deps       Skip npm install (useful for CI)
  --skip-build      Skip TypeScript build
  --verbose, -v     Verbose output
  --help, -h        Show this help message

Examples:
  npx the_collective install                    # Full install with Docker
  npx the_collective install --mode=stdio       # Use stdio instead of Docker
  npx the_collective install --components=memory  # Install only memory server
  npx the_collective install --dry-run          # Preview changes
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
 * Download file from GitHub (reserved for future use)
 */
function _downloadFile(repoPath) {
  return new Promise((resolve, reject) => {
    const url = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/${repoPath}`;

    https
      .get(url, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          // Follow redirect
          https
            .get(res.headers.location, (redirectRes) => {
              let data = "";
              redirectRes.on("data", (chunk) => (data += chunk));
              redirectRes.on("end", () => resolve(data));
            })
            .on("error", reject);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Failed to download ${repoPath}: HTTP ${res.statusCode}`));
          return;
        }

        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

/**
 * Clone the repository to a temp directory
 */
function cloneToTemp(verbose) {
  const tempDir = path.join(require("os").tmpdir(), `the_collective_${Date.now()}`);

  if (verbose) {
    ui.info(`Cloning repository to ${tempDir}...`);
  }

  try {
    execSync(`git clone --depth 1 https://github.com/${REPO_OWNER}/${REPO_NAME}.git "${tempDir}"`, {
      stdio: verbose ? "inherit" : "pipe",
    });
    return tempDir;
  } catch (error) {
    throw new Error(`Failed to clone repository: ${error.message}`);
  }
}

/**
 * Copy directory recursively
 */
function copyDir(src, dest, dryRun = false, verbose = false) {
  if (dryRun) {
    if (verbose) {
      ui.info(`Would copy: ${src} → ${dest}`);
    }
    return;
  }

  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, dryRun, verbose);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Main installation function
 */
async function install(options) {
  const targetDir = process.cwd();

  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║          >the_collective - External Installation             ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");

  // Step 1: Detect project
  ui.step(1, 8, "Detecting project...");

  const projectRoot = findProjectRoot(targetDir);
  if (!projectRoot) {
    ui.warn("No project root detected. Will install in current directory.");
  }

  const installDir = projectRoot || targetDir;
  const projectType = getProjectType(installDir);
  ui.info(`Project type: ${projectType.type} (${projectType.runtime})`);

  // Check for existing installation
  const existing = isCollectiveInstalled(installDir);
  if (existing.installed) {
    if (options.force) {
      ui.warn(`the_collective already installed (v${existing.version}). Overwriting...`);
    } else {
      ui.error("the_collective is already installed in this project.");
      ui.info("Use --force to overwrite, or run 'npx the_collective update' to update.");
      process.exit(1);
    }
  }

  // Check for nested installation
  const nested = detectNestedInstallation(installDir);
  if (nested.nested) {
    ui.error("Cannot install: This directory is inside another the_collective installation.");
    ui.info(`Parent installation found at: ${nested.parentRoot}`);
    process.exit(1);
  }

  // Step 2: Run preflight checks
  ui.step(2, 8, "Running preflight checks...");

  const preflightResults = await runPreflightChecks({
    targetDir: installDir,
    mode: options.mode,
    checkNetwork: !options.skipDeps,
  });

  const preflightOk = printPreflightResults(preflightResults);
  if (!preflightOk && !options.force) {
    ui.error("Preflight checks failed. Fix the errors above or use --force to continue anyway.");
    process.exit(1);
  }

  // Step 3: Show plan and confirm
  ui.step(3, 8, "Planning installation...");

  const suggestedConfig = getSuggestedConfig(projectType);
  if (options.mode === "docker" && suggestedConfig.mode === "local") {
    ui.warn(`Suggested mode for ${projectType.type} is 'local', but using 'docker' as specified.`);
  }

  for (const suggestion of suggestedConfig.suggestions) {
    ui.info(suggestion);
  }

  console.log("");
  console.log("Installation plan:");
  console.log(`  Target directory: ${installDir}`);
  console.log(`  Mode: ${options.mode}`);
  console.log(`  Components: ${options.components.join(", ")}`);
  console.log(`  Backup: ${options.backup ? "yes" : "no"}`);
  console.log("");

  if (options.dryRun) {
    ui.info("Dry run mode - no changes will be made.");
    console.log("");
  }

  if (!options.force && !options.dryRun) {
    const proceed = await confirm("Proceed with installation?");
    if (!proceed) {
      ui.info("Installation cancelled.");
      process.exit(0);
    }
  }

  // Step 4: Create backups
  let backupDir = null;
  if (options.backup && !options.dryRun) {
    ui.step(4, 8, "Creating backups...");

    // Clean up any previous backup directories first
    // This prevents accumulating stale backups from multiple install attempts
    const existingBackups = fs.readdirSync(installDir)
      .filter((f) => f.startsWith(".collective-backup-"));

    if (existingBackups.length > 0 && !options.verbose) {
      // Quietly remove old backups unless verbose
      for (const backup of existingBackups) {
        try {
          fs.rmSync(path.join(installDir, backup), { recursive: true, force: true });
        } catch {
          // Ignore errors, non-critical
        }
      }
    } else if (existingBackups.length > 0 && options.verbose) {
      ui.info(`Removing ${existingBackups.length} previous backup(s)...`);
      for (const backup of existingBackups) {
        try {
          fs.rmSync(path.join(installDir, backup), { recursive: true, force: true });
        } catch {
          ui.warn(`Could not remove backup: ${backup}`);
        }
      }
    }

    backupDir = path.join(installDir, `.collective-backup-${Date.now()}`);
    fs.mkdirSync(backupDir, { recursive: true });

    const filesToBackup = [
      ".github/copilot-instructions.md",
      ".vscode/mcp.json",
      ".vscode/settings.json",
      ".vscode/tasks.json",
      ".gitignore",
    ];

    let backedUp = 0;
    for (const file of filesToBackup) {
      const fullPath = path.join(installDir, file);
      if (fs.existsSync(fullPath)) {
        const backupPath = createBackup(fullPath, backupDir);
        if (backupPath && options.verbose) {
          ui.info(`Backed up: ${file}`);
        }
        backedUp++;
      }
    }

    if (backedUp > 0) {
      ui.success(`Created ${backedUp} backup(s) in ${path.basename(backupDir)}/`);
    } else {
      ui.info("No existing files to backup.");
    }
  } else {
    ui.step(4, 8, "Skipping backups...");
  }

  // Step 5: Clone/download framework files
  ui.step(5, 8, "Downloading framework files...");

  let tempDir = null;
  try {
    tempDir = cloneToTemp(options.verbose);
    ui.success("Downloaded framework files.");
  } catch (error) {
    ui.error(`Failed to download: ${error.message}`);
    process.exit(1);
  }

  // Step 6: Copy framework files
  ui.step(6, 8, "Installing framework files...");

  try {
    // Copy .collective directory
    if (options.components.includes("memory") || options.components.includes("gemini")) {
      const srcCollective = path.join(tempDir, ".collective");
      const destCollective = path.join(installDir, ".collective");

      if (!options.dryRun) {
        // Remove existing .collective if force
        if (fs.existsSync(destCollective) && options.force) {
          fs.rmSync(destCollective, { recursive: true, force: true });
        }

        copyDir(srcCollective, destCollective, options.dryRun, options.verbose);

        // Create .mcp directory for database
        fs.mkdirSync(path.join(installDir, ".mcp"), { recursive: true });
        fs.writeFileSync(path.join(installDir, ".mcp", ".gitkeep"), "");
      }
      ui.success("Installed .collective/");
    }

    // Copy .github/agents and instructions
    if (options.components.includes("agents")) {
      const srcAgents = path.join(tempDir, ".github", "agents");
      const destAgents = path.join(installDir, ".github", "agents");

      if (!options.dryRun) {
        fs.mkdirSync(path.join(installDir, ".github"), { recursive: true });
        copyDir(srcAgents, destAgents, options.dryRun, options.verbose);
      }
      ui.success("Installed .github/agents/");

      const srcInstructions = path.join(tempDir, ".github", "instructions");
      const destInstructions = path.join(installDir, ".github", "instructions");

      if (!options.dryRun && fs.existsSync(srcInstructions)) {
        copyDir(srcInstructions, destInstructions, options.dryRun, options.verbose);
        ui.success("Installed .github/instructions/");
      }

      // Merge copilot-instructions.md
      const srcCopilot = path.join(tempDir, ".github", "copilot-instructions.md");
      const destCopilot = path.join(installDir, ".github", "copilot-instructions.md");

      if (!options.dryRun && fs.existsSync(srcCopilot)) {
        const collectiveContent = fs.readFileSync(srcCopilot, "utf8");

        if (fs.existsSync(destCopilot)) {
          const existingContent = fs.readFileSync(destCopilot, "utf8");
          const merged = mergeCopilotInstructions(existingContent, collectiveContent);
          fs.writeFileSync(destCopilot, merged);
          ui.success("Merged .github/copilot-instructions.md");
        } else {
          fs.writeFileSync(destCopilot, collectiveContent);
          ui.success("Created .github/copilot-instructions.md");
        }
      }
    }

    // Copy and merge .vscode files
    if (!options.dryRun) {
      fs.mkdirSync(path.join(installDir, ".vscode"), { recursive: true });

      // mcp.json - choose based on mode
      const mcpSource = options.mode === "docker" ? "mcp.docker.json" : "mcp.local.json";
      const srcMcp = path.join(tempDir, ".vscode", mcpSource);
      const destMcp = path.join(installDir, ".vscode", "mcp.json");

      if (fs.existsSync(srcMcp)) {
        const collectiveMcp = JSON.parse(fs.readFileSync(srcMcp, "utf8"));

        if (fs.existsSync(destMcp)) {
          const existingMcp = JSON.parse(fs.readFileSync(destMcp, "utf8"));
          const { merged, conflicts } = mergeMcpJson(existingMcp, collectiveMcp);
          fs.writeFileSync(destMcp, JSON.stringify(merged, null, 2) + "\n");

          for (const conflict of conflicts) {
            ui.warn(conflict);
          }
          ui.success("Merged .vscode/mcp.json");
        } else {
          fs.writeFileSync(destMcp, JSON.stringify(collectiveMcp, null, 2) + "\n");
          ui.success("Created .vscode/mcp.json");
        }
      }

      // Also copy the mode-specific files for switching later
      for (const file of ["mcp.local.json", "mcp.docker.json"]) {
        const src = path.join(tempDir, ".vscode", file);
        const dest = path.join(installDir, ".vscode", file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        }
      }

      // tasks.json
      const srcTasks = path.join(tempDir, ".vscode", "tasks.json");
      const destTasks = path.join(installDir, ".vscode", "tasks.json");

      if (fs.existsSync(srcTasks)) {
        const collectiveTasks = JSON.parse(fs.readFileSync(srcTasks, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ""));

        if (fs.existsSync(destTasks)) {
          try {
            const existingTasks = JSON.parse(fs.readFileSync(destTasks, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ""));
            const { merged, added, skipped } = mergeTasks(existingTasks, collectiveTasks);
            fs.writeFileSync(destTasks, JSON.stringify(merged, null, 2) + "\n");

            if (added.length > 0) {
              ui.success(`Merged tasks.json (added ${added.length} tasks)`);
            }
            if (skipped.length > 0 && options.verbose) {
              ui.info(`Skipped existing tasks: ${skipped.join(", ")}`);
            }
          } catch {
            // Invalid existing JSON, replace
            fs.writeFileSync(destTasks, JSON.stringify(collectiveTasks, null, 2) + "\n");
            ui.success("Replaced invalid tasks.json");
          }
        } else {
          fs.writeFileSync(destTasks, JSON.stringify(collectiveTasks, null, 2) + "\n");
          ui.success("Created .vscode/tasks.json");
        }
      }

      // settings.json
      const srcSettings = path.join(tempDir, ".vscode", "settings.json");
      const destSettings = path.join(installDir, ".vscode", "settings.json");

      if (fs.existsSync(srcSettings)) {
        const collectiveSettings = JSON.parse(fs.readFileSync(srcSettings, "utf8"));

        if (fs.existsSync(destSettings)) {
          const existingSettings = JSON.parse(fs.readFileSync(destSettings, "utf8"));
          const merged = mergeSettings(existingSettings, collectiveSettings);
          fs.writeFileSync(destSettings, JSON.stringify(merged, null, 2) + "\n");
          ui.success("Merged .vscode/settings.json");
        } else {
          fs.writeFileSync(destSettings, JSON.stringify(collectiveSettings, null, 2) + "\n");
          ui.success("Created .vscode/settings.json");
        }
      }

      // extensions.json
      const srcExt = path.join(tempDir, ".vscode", "extensions.json");
      const destExt = path.join(installDir, ".vscode", "extensions.json");
      if (fs.existsSync(srcExt) && !fs.existsSync(destExt)) {
        fs.copyFileSync(srcExt, destExt);
        ui.success("Created .vscode/extensions.json");
      }
    }

    // Update .gitignore
    const destGitignore = path.join(installDir, ".gitignore");
    if (!options.dryRun) {
      const existingGitignore = fs.existsSync(destGitignore) ? fs.readFileSync(destGitignore, "utf8") : "";

      const { merged, added } = mergeGitignore(existingGitignore, COLLECTIVE_GITIGNORE_PATTERNS);

      if (added.length > 0) {
        fs.writeFileSync(destGitignore, merged);
        ui.success(`Updated .gitignore (added ${added.length} patterns)`);
      }
    }

    // Copy docker-compose.yml if docker mode
    if (options.mode === "docker" && !options.dryRun) {
      const srcCompose = path.join(tempDir, "docker-compose.yml");
      const destCompose = path.join(installDir, "docker-compose.yml");

      if (fs.existsSync(srcCompose)) {
        // Read and potentially modify for SELinux
        let composeContent = fs.readFileSync(srcCompose, "utf8");

        if (isSelinuxEnforcing()) {
          // Add :z suffix to volume mounts for SELinux compatibility
          composeContent = composeContent.replace(/:ro$/gm, ":ro,z");
          composeContent = composeContent.replace(/:rw$/gm, ":rw,z");
          ui.info("Added SELinux volume flags (:z)");
        }

        fs.writeFileSync(destCompose, composeContent);
        ui.success("Created docker-compose.yml");
      }
    }
  } catch (error) {
    ui.error(`Failed to copy files: ${error.message}`);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }

  // Step 7: Install dependencies and build
  ui.step(7, 8, "Installing dependencies...");

  if (!options.dryRun && !options.skipDeps) {
    const serverDirs = [];

    if (options.components.includes("memory")) {
      serverDirs.push(path.join(installDir, ".collective", "memory-server"));
    }
    if (options.components.includes("gemini")) {
      serverDirs.push(path.join(installDir, ".collective", "gemini-bridge"));
    }

    for (const serverDir of serverDirs) {
      const serverName = path.basename(serverDir);
      ui.info(`Installing ${serverName} dependencies...`);

      try {
        execSync("npm install", {
          cwd: serverDir,
          stdio: options.verbose ? "inherit" : "pipe",
        });
        ui.success(`Installed ${serverName} dependencies`);

        if (!options.skipBuild) {
          ui.info(`Building ${serverName}...`);
          execSync("npm run build", {
            cwd: serverDir,
            stdio: options.verbose ? "inherit" : "pipe",
          });
          ui.success(`Built ${serverName}`);
        }
      } catch (error) {
        ui.error(`Failed to setup ${serverName}: ${error.message}`);
        if (!options.force) {
          process.exit(1);
        }
      }
    }
  } else if (options.skipDeps) {
    ui.info("Skipping dependency installation (--skip-deps)");
  }

  // Step 8: Create config and finish
  ui.step(8, 8, "Finalizing installation...");

  // Create collective.config.json using config library
  if (!options.dryRun) {
    const config = createConfig({
      mode: options.mode,
      components: {
        memoryServer: options.components.includes("memory"),
        geminiBridge: options.components.includes("gemini"),
        agents: options.components.includes("agents"),
        instructions: options.components.includes("agents"),
      },
    });

    saveConfig(installDir, config);
    ui.success("Created collective.config.json");
  }

  // Clean up temp directory
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  // Start Docker containers if docker mode
  if (options.mode === "docker" && !options.dryRun && !options.skipBuild) {
    ui.info("Starting Docker containers...");

    try {
      execSync("docker compose up -d --build", {
        cwd: installDir,
        stdio: options.verbose ? "inherit" : "pipe",
      });
      ui.success("Docker containers started");
    } catch (error) {
      ui.warn(`Failed to start Docker: ${error.message}`);
      ui.info("You can start manually with: docker compose up -d");
    }
  }

  // Success message
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║                    Installation Complete!                     ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log("Next steps:");
  console.log("  1. Restart VS Code to load MCP servers");
  console.log('  2. Open Copilot Chat and say "hey nyx"');
  console.log("");

  if (options.mode === "docker") {
    console.log("Docker containers:");
    console.log("  Memory server: http://localhost:3100");
    console.log("  Gemini bridge: http://localhost:3101");
    console.log("");
  }

  if (backupDir) {
    console.log(`Backups saved to: ${path.basename(backupDir)}/`);
    console.log("");
  }

  console.log("Commands:");
  console.log("  npm run check            - Verify installation");
  console.log("  npx the_collective update   - Update framework");
  console.log("  npx the_collective uninstall - Remove framework");
  console.log("");
}

// Main entry point
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  try {
    await install(options);
  } catch (error) {
    ui.error(`Installation failed: ${error.message}`);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
