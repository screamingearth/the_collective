#!/usr/bin/env node

/*
 * A comprehensive validation script that ensures your framework is ready to go.
 *
 * Usage:
 *   npm run check                    # Full dev check (tolerant, shows warnings)
 *   npm run check -- --strict        # CI mode (strict, fails on any issue)
 *   npm run check -- --memory        # Memory system only
 *   npm run check -- --quick         # Fast check (skip slow operations)
 *   npm run check -- --help          # Show help
 *
 * Flags:
 *   --strict, -s    Fail on warnings (for CI pipelines)
 *   --memory, -m    Only check memory system
 *   --quick, -q     Skip slow checks (db count, etc.)
 *   --quiet         Minimal output
 *   --help, -h      Show this help message
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
const { spawnSync } = require("child_process");
const {
  colors: c,
  banner: drawBanner,
  drawBox,
  success: logSuccess,
  error: logError,
  warn: logWarn,
  info: logInfo,
  section: logSection,
  log: baseLog,
} = require("./lib/ui.cjs");

// Setup logging
const logDir = path.join(process.cwd(), ".collective/.logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const checkLogFile = path.join(logDir, "check.log");
const logStream = fs.createWriteStream(checkLogFile, { flags: "a" });

function writeLog(msg) {
  logStream.write(`[${new Date().toISOString()}] ${msg}\n`);
}

// Parse CLI arguments
const args = process.argv.slice(2);
const flags = {
  strict: args.includes("--strict") || args.includes("-s"),
  memory: args.includes("--memory") || args.includes("-m"),
  quick: args.includes("--quick") || args.includes("-q"),
  quiet: args.includes("--quiet"),
  help: args.includes("--help") || args.includes("-h"),
};

function log(msg, color = "") {
  if (!flags.quiet || color === c.red) {
    baseLog(msg, color);
  }
}

function showHelp() {
  drawBanner("Health Check", "Validate framework setup");

  drawBox(
    "Usage",
    [
      "npm run check                    Full dev check (tolerant)",
      "npm run check -- --strict        CI mode (fails on warnings)",
      "npm run check -- --memory        Memory system only",
      "npm run check -- --quick         Skip slow operations",
    ],
    { color: c.cyan },
  );

  drawBox(
    "Flags",
    [
      "--strict, -s    Fail on warnings (for CI pipelines)",
      "--memory, -m    Only check memory system",
      "--quick, -q     Skip slow checks (db count verification)",
      "--quiet         Minimal output",
      "--help, -h      Show this help",
    ],
    { color: c.magenta },
  );

  drawBox(
    "Examples",
    [
      "npm run check                    # Day-to-day dev check",
      "npm run check -- --strict        # CI/pre-commit validation",
      "npm run check -- -m -q           # Quick memory sanity check",
    ],
    { color: c.yellow },
  );

  baseLog(`\n${c.dim}Tip: Run this before committing to catch issues early!${c.reset}\n`);
  process.exit(0);
}

if (flags.help) {
  showHelp();
}

// Configuration
const REQUIRED_FILES = [
  ".github/copilot-instructions.md",
  ".github/agents/nyx.agent.md",
  ".github/agents/prometheus.agent.md",
  ".github/agents/cassandra.agent.md",
  ".github/agents/apollo.agent.md",
  ".github/agents/the_collective.agent.md",
  "AGENTS.md",
  "README.md",
  "QUICKSTART.md",
  "CONTRIBUTING.md",
];

const REQUIRED_DIRS = [".github", ".github/agents", ".mcp"];

const MEMORY_BUILD_FILES = ["index.js", "memory-store.js", "bootstrap.js"];
const GEMINI_BUILD_FILES = ["mcp-server.js", "index.js"];

let warnings = 0;
let errors = 0;

function success(msg) {
  if (!flags.quiet) {
    logSuccess(msg);
  }
  writeLog(`SUCCESS: ${msg}`);
}

function warn(msg, hint = "") {
  warnings++;
  writeLog(`WARN: ${msg}`);
  logWarn(msg, !flags.quiet ? hint : "");
}

function error(msg, hint = "") {
  errors++;
  writeLog(`ERROR: ${msg}`);
  logError(msg, !flags.quiet ? hint : "");
}

function info(msg) {
  writeLog(`INFO: ${msg}`);
  if (!flags.quiet) {
    logInfo(msg);
  }
}

function section(title, icon = "📋") {
  logSection(title, icon);
}

// ============================================================================
// Check Functions
// ============================================================================

function checkEnvironment() {
  section("Environment", "🌐");

  // Node.js Version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.replace("v", "").split(".")[0]);
  if (majorVersion >= 20 && majorVersion <= 22) {
    success(`Node.js ${nodeVersion} (LTS)`);
  } else if (majorVersion > 22) {
    warn(`Node.js ${nodeVersion} (Current)`, "Native modules (DuckDB) may fail to compile. Recommended: v22 (LTS)");
  } else {
    error(`Node.js ${nodeVersion} (Unsupported)`, "Minimum required: v20. Recommended: v22 (LTS)");
  }

  // Python Version (required for node-gyp)
  let pythonVersion = "";
  try {
    const p3 = spawnSync("python3", ["--version"], { encoding: "utf8" });
    if (p3.status === 0) pythonVersion = p3.stdout.trim();
  } catch (e) { }

  if (!pythonVersion) {
    try {
      const p = spawnSync("python", ["--version"], { encoding: "utf8" });
      if (p.status === 0) pythonVersion = p.stdout.trim();
    } catch (e) { }
  }

  if (pythonVersion) {
    success(pythonVersion);
  } else {
    error("Python not found", "Required for native module compilation (node-gyp)");
  }

  // Windows Build Tools
  if (process.platform === "win32") {
    const vsToolsLocations = [
      "C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools\\VC\\Tools\\MSVC",
      "C:\\Program Files (x86)\\Microsoft Visual Studio\\2019\\BuildTools\\VC\\Tools\\MSVC",
      "C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\VC\\Tools\\MSVC",
      "C:\\Program Files\\Microsoft Visual Studio\\2019\\Community\\VC\\Tools\\MSVC",
    ];
    const found = vsToolsLocations.some((loc) => fs.existsSync(loc));
    if (found) {
      success("Visual Studio Build Tools detected");
    } else {
      warn("Visual Studio Build Tools not detected", "Required if native binaries fail to install");
    }
  }
}

function checkDirectories() {
  section("Directory Structure", "📁");
  REQUIRED_DIRS.forEach((dir) => {
    const fullPath = path.join(process.cwd(), dir);
    if (fs.existsSync(fullPath)) {
      success(dir);
    } else {
      error(`Missing directory: ${dir}`);
    }
  });
}

function checkFiles() {
  section("Required Files", "📄");
  REQUIRED_FILES.forEach((file) => {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      success(file);
    } else {
      error(`Missing file: ${file}`);
    }
  });
}

function checkMCPConfig() {
  section("MCP Configuration", "🔌");
  const mcpPath = path.join(process.cwd(), ".vscode/mcp.json");

  if (!fs.existsSync(mcpPath)) {
    error("Missing .vscode/mcp.json");
    return;
  }

  try {
    const mcpConfig = JSON.parse(fs.readFileSync(mcpPath, "utf8"));

    // Support multiple formats:
    // 1. Old format: mcpServers object { memory: {...} }
    // 2. VS Code format: servers object { memory: {...} }
    // 3. Array format: servers array [{ name: "memory", ... }]
    const hasMemoryServer =
      (mcpConfig.mcpServers && mcpConfig.mcpServers.memory) ||
      (mcpConfig.servers && typeof mcpConfig.servers === "object" && !Array.isArray(mcpConfig.servers) && mcpConfig.servers.memory) ||
      (Array.isArray(mcpConfig.servers) && mcpConfig.servers.some((s) => s.name === "memory"));

    if (hasMemoryServer) {
      success("MCP memory server configured");

      // Check for fragile relative paths (strict mode)
      const memoryConfig = mcpConfig.mcpServers?.memory || mcpConfig.servers?.memory;
      if (flags.strict && memoryConfig?.env) {
        const memoryPath = memoryConfig.env.MEMORY_FILE_PATH || memoryConfig.env.MEMORY_DB_PATH || "";
        if (memoryPath.includes("../") && !memoryPath.includes("${workspaceFolder}")) {
          warn("MCP memory path uses relative path (consider using ${workspaceFolder})");
        }
      }
    } else {
      warn("MCP memory server not found in config");
    }
  } catch (e) {
    error(`Invalid mcp.json: ${e.message}`);
  }
}

function checkMemoryServerBuild() {
  section("Memory Server Build", "🛠️");
  const memoryDistPath = path.join(process.cwd(), ".collective/memory-server/dist");

  if (!fs.existsSync(memoryDistPath)) {
    error("Memory server not built", "Run: npm run rebuild");
    return false;
  }

  const allExist = MEMORY_BUILD_FILES.every((f) => fs.existsSync(path.join(memoryDistPath, f)));

  if (allExist) {
    success("Memory server compiled");
    return true;
  } else {
    error("Memory server build incomplete", "Run: npm run rebuild");
    return false;
  }
}

function checkGeminiBridgeBuild() {
  section("Gemini Bridge Build", "🤖");
  const geminiDistPath = path.join(process.cwd(), ".collective/gemini-bridge/dist");

  if (!fs.existsSync(geminiDistPath)) {
    warn("Gemini bridge not built (optional)", "Run: cd .collective/gemini-bridge && npm run build");
    return false;
  }

  const allExist = GEMINI_BUILD_FILES.every((f) => fs.existsSync(path.join(geminiDistPath, f)));

  if (allExist) {
    success("Gemini bridge compiled");
    return true;
  } else {
    warn("Gemini bridge build incomplete", "Run: cd .collective/gemini-bridge && npm run build");
    return false;
  }
}

function checkAgentDefinitions() {
  section("Agent Definitions", "👥");
  const agentFiles = [
    "nyx.agent.md",
    "prometheus.agent.md",
    "cassandra.agent.md",
    "apollo.agent.md",
    "the_collective.agent.md",
  ];

  agentFiles.forEach((file) => {
    const agentPath = path.join(process.cwd(), ".github/agents", file);
    if (fs.existsSync(agentPath)) {
      const content = fs.readFileSync(agentPath, "utf8");
      if (content.includes("---") && content.includes("name:")) {
        success(file);
      } else {
        warn(`${file} missing frontmatter`);
      }
    } else {
      // Already caught by checkFiles, don't double-count
    }
  });
}

function checkMemoryDatabase() {
  section("Memory Database", "💾");
  const dbPath = path.join(process.cwd(), ".mcp", "collective_memory.duckdb");

  if (!fs.existsSync(dbPath)) {
    warn("Database not found", "Run: cd .collective/memory-server && npm run bootstrap");
    return;
  }

  const stats = fs.statSync(dbPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  success(`Database exists (${sizeMB} MB)`);

  // Skip memory count in quick mode
  if (flags.quick) {
    info("Skipping memory count check (--quick mode)");
    return;
  }

  // Try to check memory count (might fail if VS Code has lock)
  // Use cross-platform approach: write a temp script and execute it
  try {
    const memoryServerDir = path.join(process.cwd(), ".collective/memory-server");
    const relativeDbPath = path.relative(memoryServerDir, dbPath).replace(/\\/g, "/");

    // Security: Use JSON.stringify to safely escape the path, preventing injection
    const safeDbPath = JSON.stringify(relativeDbPath);

    // Create inline script that works cross-platform
    const checkScript = `
      const {MemoryStore} = await import('./dist/memory-store.js');
      const s = new MemoryStore(${safeDbPath});
      await s.initialize();
      const m = await s.getRecentMemories({limit:100});
      console.log(m.length);
      await s.close();
    `.replace(/\n\s*/g, " ").trim();

    // Use spawnSync for better cross-platform behavior
    const nodeCmd = process.execPath; // Use the same Node that's running this script
    const result = spawnSync(nodeCmd, ["--input-type=module", "-e", checkScript], {
      cwd: memoryServerDir,
      encoding: "utf8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
    });

    if (result.status === 0) {
      const count = parseInt(result.stdout.trim());
      if (isNaN(count)) {
        warn("Could not parse memory count");
      } else if (count >= 20) {
        success(`${count} memories loaded`);
      } else {
        warn(`Only ${count} memories (expected 20+)`, "Run: cd .collective/memory-server && npm run bootstrap");
      }
    } else {
      const errMsg = result.stderr || result.error?.message || "Unknown error";
      throw new Error(errMsg);
    }
  } catch (e) {
    if (e.message.includes("lock") || e.message.includes("Conflicting")) {
      if (flags.strict) {
        warn("Database locked by VS Code (can't verify memory count in CI)");
      } else {
        info("Database locked (VS Code MCP server running - this is normal)");
      }
    } else {
      warn(`Could not verify memory count: ${e.message.split("\n")[0]}`);
    }
  }
}

function checkDependencies() {
  section("Dependencies", "📦");
  const pkgPath = path.join(process.cwd(), "package.json");

  if (!fs.existsSync(pkgPath)) {
    error("Missing package.json");
    return;
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

    // Check for "latest" tags
    if (pkg.dependencies) {
      const hasLatest = Object.values(pkg.dependencies).some((v) => v === "latest");
      if (hasLatest) {
        if (flags.strict) {
          error('Dependencies using "latest" tag (should be pinned)');
        } else {
          warn('Some dependencies use "latest" (should be pinned)');
        }
      } else {
        success("Dependencies properly versioned");
      }
    }

    // Check node_modules exists
    if (fs.existsSync(path.join(process.cwd(), "node_modules"))) {
      success("node_modules installed");
    } else {
      error("node_modules not found", "Run: npm install");
    }
  } catch (e) {
    error(`Failed to parse package.json: ${e.message}`);
  }
}

// ============================================================================
// Main
// ============================================================================

function runFullCheck() {
  const mode = flags.strict ? "Strict" : flags.quick ? "Quick" : "Standard";
  drawBanner("Health Check", `${mode} Mode`);

  checkEnvironment();
  checkDirectories();
  checkFiles();
  checkMCPConfig();
  checkMemoryServerBuild();
  checkGeminiBridgeBuild();
  checkAgentDefinitions();
  checkMemoryDatabase();
  checkDependencies();

  printSummary();
}

function runMemoryCheck() {
  drawBanner("Health Check", "Memory System Check");

  const buildOk = checkMemoryServerBuild();
  if (buildOk) {
    checkMemoryDatabase();
  }

  printSummary();
}

function printSummary() {
  baseLog(`\n${c.dim}${"-".repeat(50)}${c.reset}`);

  if (errors === 0 && warnings === 0) {
    log(`\n${c.green}${c.bold}✅ All checks passed!${c.reset} Framework is ready.\n`);
    writeLog("CHECK RESULT: PASSED");
    logStream.end(() => process.exit(0));
    return;
  }

  if (warnings > 0) {
    log(`${c.yellow}⚠  ${warnings} warning(s)${c.reset}`);
  }

  if (errors > 0) {
    log(`${c.red}✗  ${errors} error(s)${c.reset} - please fix before using\n`);
    writeLog("CHECK RESULT: FAILED (errors)");
    logStream.end(() => process.exit(1));
    return;
  }

  // In strict mode, warnings are failures
  if (flags.strict && warnings > 0) {
    log(`\n${c.dim}Strict mode: warnings treated as errors${c.reset}`);
    writeLog("CHECK RESULT: FAILED (strict mode)");
    logStream.end(() => process.exit(1));
    return;
  }

  log(`\n${c.dim}Framework should still work despite warnings${c.reset}`);
  log(`${c.dim}Run 'npm run help' for available commands${c.reset}\n`);
  writeLog("CHECK RESULT: PASSED (with warnings)");
  logStream.end(() => process.exit(0));
}

// Run appropriate check
if (flags.memory) {
  runMemoryCheck();
} else {
  runFullCheck();
}
