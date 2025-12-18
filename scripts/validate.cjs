#!/usr/bin/env node

/*
 * the_collective - Validate Script
 *
 * Cross-platform linting validation.
 *
 * Usage:
 *   npm run validate              # Run all validations
 *   npm run validate -- --fix     # Auto-fix issues
 *   npm run validate -- --help    # Show help
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

const { execSync } = require("child_process");
const path = require("path");
const {
  colors: c,
  banner: drawBanner,
  drawBox,
  success,
  error,
  warn,
  info,
  log,
  IS_WINDOWS,
} = require("./lib/ui.cjs");

const ROOT = path.resolve(__dirname, "..");
const MEMORY_SERVER = path.join(ROOT, ".collective/memory-server");
const GEMINI_BRIDGE = path.join(ROOT, ".collective/gemini-bridge");

// Parse CLI arguments
const args = process.argv.slice(2);
const flags = {
  help: args.includes("--help") || args.includes("-h"),
  fix: args.includes("--fix") || args.includes("-f"),
  version: args.includes("--version") || args.includes("-v"),
};

/**
 * Show version and exit
 */
function showVersion() {
  const pkgPath = path.join(ROOT, "package.json");
  const pkg = JSON.parse(require("fs").readFileSync(pkgPath, "utf8"));
  log(`${c.cyan}>the_collective${c.reset} validate tool ${c.dim}v${pkg.version}${c.reset}`);
  process.exit(0);
}

/**
 * Show help and exit
 */
function showHelp() {
  drawBanner("Validate", "Code quality checks");

  drawBox(
    "Usage",
    [
      "npm run validate              Run all validations",
      "npm run validate -- --fix     Auto-fix issues where possible",
      "npm run validate -- --help    Show this help",
    ],
    { color: c.cyan },
  );

  drawBox(
    "What This Checks",
    [
      "1. ESLint - JavaScript/TypeScript linting",
      "2. TypeScript - Type checking (memory-server)",
    ],
    { color: c.magenta },
  );

  log(`\n${c.dim}Platform: ${process.platform} (${process.arch})${c.reset}\n`);
  process.exit(0);
}

if (flags.version) {
  showVersion();
}

if (flags.help) {
  showHelp();
}

/**
 * Run a command synchronously
 */
function run(command, options = {}) {
  const { cwd = ROOT, silent = false, ignoreError = false } = options;

  if (!silent) {
    log(`${c.dim}$ ${command}${c.reset}`);
  }

  try {
    execSync(command, {
      cwd,
      stdio: "inherit",
      shell: true,
      env: { ...process.env, FORCE_COLOR: "1" },
    });
    return { success: true };
  } catch (err) {
    if (ignoreError) {
      return { success: false, error: err };
    }
    throw err;
  }
}

/**
 * Run npm/npx command
 */
function npx(command, options = {}) {
  const npxCmd = IS_WINDOWS ? "npx.cmd" : "npx";
  return run(`${npxCmd} ${command}`, options);
}

function _npm(command, options = {}) {
  const npmCmd = IS_WINDOWS ? "npm.cmd" : "npm";
  return run(`${npmCmd} ${command}`, options);
}

let errors = 0;
let warnings = 0;

/**
 * Step runner with nice output
 */
function step(title, fn) {
  log(`\n${c.cyan}${c.bold}▶ ${title}${c.reset}`);
  log(c.dim + "-".repeat(40) + c.reset);

  try {
    const result = fn();
    if (result && result.success === false) {
      warn(`${title} - issues found`);
      warnings++;
    } else {
      success(title);
    }
  } catch (_err) {
    error(`${title} failed`);
    errors++;
  }
}

/**
 * Main validate function
 */
function main() {
  drawBanner("Validate", "Code quality checks");

  info(`Platform: ${process.platform} (${process.arch})`);
  if (flags.fix) {
    info("Auto-fix mode enabled");
  }
  log("");

  const fixFlag = flags.fix ? " --fix" : "";

  // ESLint on root
  step("ESLint (root)", () => {
    return npx(`eslint .${fixFlag}`, { cwd: ROOT, ignoreError: true });
  });

  // TypeScript check on memory-server
  step("TypeScript (memory-server)", () => {
    const tscCmd = IS_WINDOWS ? "npx.cmd" : "npx";
    return run(`${tscCmd} tsc --noEmit`, { cwd: MEMORY_SERVER, ignoreError: true });
  });

  // ESLint on memory-server
  step("ESLint (memory-server)", () => {
    return npx(`eslint src/**/*.ts --ignore-pattern '*.test.ts'${fixFlag}`, { cwd: MEMORY_SERVER, ignoreError: true });
  });

  // TypeScript check on gemini-bridge
  step("TypeScript (gemini-bridge)", () => {
    const tscCmd = IS_WINDOWS ? "npx.cmd" : "npx";
    return run(`${tscCmd} tsc --noEmit`, { cwd: GEMINI_BRIDGE, ignoreError: true });
  });

  // ESLint on gemini-bridge
  step("ESLint (gemini-bridge)", () => {
    return npx(`eslint src/**/*.ts --ignore-pattern '*.test.ts'${fixFlag}`, { cwd: GEMINI_BRIDGE, ignoreError: true });
  });

  // Summary
  log("\n" + c.dim + "=".repeat(50) + c.reset);

  if (errors === 0 && warnings === 0) {
    log(`\n${c.green}${c.bold}✓ All validations passed!${c.reset}\n`);
    process.exit(0);
  }

  if (warnings > 0) {
    log(`${c.yellow}⚠  ${warnings} check(s) found issues${c.reset}`);
  }

  if (errors > 0) {
    log(`${c.red}✗  ${errors} check(s) failed${c.reset}\n`);
    process.exit(1);
  }

  if (!flags.fix) {
    log(`\n${c.dim}Tip: Run ${c.reset}npm run validate -- --fix${c.dim} to auto-fix issues${c.reset}\n`);
  }

  process.exit(0);
}

// Run
try {
  main();
} catch (err) {
  error("Validation failed");
  console.error(err);
  process.exit(1);
}
