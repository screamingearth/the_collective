#!/usr/bin/env node

/**
 * the_collective - Update Script
 *
 * Cross-platform dependency update script.
 * Updates all dependencies and rebuilds the memory server.
 *
 * Usage:
 *   npm run update              # Update all dependencies
 *   npm run update -- --help    # Show help
 */

const { execSync } = require("child_process");
const path = require("path");
const {
  colors: c,
  banner: drawBanner,
  drawBox,
  success,
  error,
  info,
  log,
  IS_WINDOWS,
} = require("./lib/ui.cjs");

const ROOT = path.resolve(__dirname, "..");
const MEMORY_SERVER = path.join(ROOT, ".collective/memory-server");

// Parse CLI arguments
const args = process.argv.slice(2);
const flags = {
  help: args.includes("--help") || args.includes("-h"),
};

/**
 * Show help and exit
 */
function showHelp() {
  drawBanner("Update", "Dependency management");

  drawBox(
    "Usage",
    [
      "npm run update              Update all dependencies",
      "npm run update -- --help    Show this help",
    ],
    { color: c.cyan },
  );

  drawBox(
    "What This Does",
    [
      "1. Update root package dependencies",
      "2. Update memory-server dependencies",
      "3. Rebuild native modules",
      "4. Rebuild memory-server TypeScript",
    ],
    { color: c.magenta },
  );

  log(`\n${c.dim}Platform: ${process.platform} (${process.arch})${c.reset}\n`);
  process.exit(0);
}

if (flags.help) {
  showHelp();
}

/**
 * Run a command synchronously with output
 */
function run(command, options = {}) {
  const { cwd = ROOT, silent = false } = options;

  if (!silent) {
    log(`${c.dim}$ ${command}${c.reset}`);
  }

  execSync(command, {
    cwd,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, FORCE_COLOR: "1" },
  });
  return true;
}

/**
 * Run npm command (handles Windows quirks)
 */
function npm(command, options = {}) {
  const npmCmd = IS_WINDOWS ? "npm.cmd" : "npm";
  return run(`${npmCmd} ${command}`, options);
}

/**
 * Step runner with nice output
 */
function step(num, total, title, fn) {
  log(`\n${c.cyan}${c.bold}Step ${num}/${total}: ${title}${c.reset}`);
  log(c.dim + "-".repeat(40) + c.reset);

  try {
    fn();
    success(title);
  } catch (err) {
    error(`${title} failed`);
    log(`${c.red}${err.message}${c.reset}`);
    process.exit(1);
  }
}

/**
 * Main update function
 */
function main() {
  drawBanner("Update", "Dependency management");

  info(`Platform: ${process.platform} (${process.arch})`);
  log("");

  const totalSteps = 4;
  let currentStep = 0;

  // Step 1: Update root dependencies
  step(++currentStep, totalSteps, "Updating root dependencies", () => {
    npm("update", { cwd: ROOT });
  });

  // Step 2: Update memory-server dependencies
  step(++currentStep, totalSteps, "Updating memory-server dependencies", () => {
    npm("update", { cwd: MEMORY_SERVER });
  });

  // Step 3: Rebuild native modules
  step(++currentStep, totalSteps, "Rebuilding native modules", () => {
    npm("rebuild", { cwd: MEMORY_SERVER });
  });

  // Step 4: Build memory server
  step(++currentStep, totalSteps, "Building memory server", () => {
    npm("run build", { cwd: MEMORY_SERVER });
  });

  // Success!
  log("\n" + c.green + "=".repeat(50) + c.reset);
  log(`${c.green}${c.bold}✓ Update complete!${c.reset}`);
  log(c.green + "=".repeat(50) + c.reset);

  log(`
${c.dim}All dependencies updated and rebuilt.${c.reset}
${c.dim}Run ${c.reset}npm run check${c.dim} to verify everything is working.${c.reset}
`);
}

// Run
try {
  main();
} catch (err) {
  error("Update failed");
  console.error(err);
  process.exit(1);
}
