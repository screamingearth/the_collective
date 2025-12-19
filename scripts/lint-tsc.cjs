#!/usr/bin/env node

/**
 * Cross-platform TypeScript check for lint-staged
 * Runs tsc --noEmit in the appropriate subproject based on file path
 */

const { execSync } = require("child_process");
const path = require("path");

const file = process.argv[2];
if (!file) {
  console.error("Usage: node lint-tsc.cjs <file>");
  process.exit(1);
}

// Determine which subproject this file belongs to
let project = null;
if (file.includes(".collective/memory-server/")) {
  project = ".collective/memory-server";
} else if (file.includes(".collective/gemini-bridge/")) {
  project = ".collective/gemini-bridge";
}

if (!project) {
  // Not a subproject file, skip
  process.exit(0);
}

const projectPath = path.join(process.cwd(), project);

try {
  // Run tsc from the subproject directory where TypeScript is installed
  execSync("npx tsc --noEmit", {
    stdio: "inherit",
    cwd: projectPath,
  });
} catch (_error) {
  process.exit(1);
}
