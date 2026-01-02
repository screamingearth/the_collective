#!/usr/bin/env node
/**
 * Doctor Script - Diagnose installation health
 * Part of >the_collective by screamingearth (Apache 2.0 licensed)
 *
 * Usage:
 *   npx the_collective doctor [options]
 *   node scripts/doctor.cjs [options]
 *
 * Options:
 *   --fix         Attempt to fix issues automatically
 *   --verbose     Verbose output
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const http = require("http");

// Import utilities
let workspace, _preflight, ui;

try {
  workspace = require("./lib/workspace.cjs");
  _preflight = require("./lib/preflight.cjs");
  ui = require("./lib/ui.cjs");
} catch {
  // Fallback UI
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
    fix: false,
    verbose: false,
  };

  for (const arg of args) {
    if (arg === "--fix") {
      options.fix = true;
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
>the_collective doctor - Diagnose installation health

Usage:
  npx the_collective doctor [options]

Options:
  --fix         Attempt to fix issues automatically
  --verbose     Verbose output
  --help        Show this help

Examples:
  npx the_collective doctor           # Check health
  npx the_collective doctor --fix     # Try to fix issues
`);
}

/**
 * Check if a port is listening
 */
function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: "/health", timeout: 2000 },
      (res) => {
        resolve({ listening: true, status: res.statusCode });
      },
    );
    req.on("error", () => resolve({ listening: false }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ listening: false });
    });
    req.end();
  });
}

/**
 * Check Docker status
 */
function checkDocker(installDir, _verbose) {
  const results = {
    installed: false,
    running: false,
    containersUp: false,
    containers: [],
  };

  try {
    execSync("docker --version", { stdio: "pipe" });
    results.installed = true;

    execSync("docker info", { stdio: "pipe" });
    results.running = true;

    const output = execSync("docker compose ps --format json", {
      cwd: installDir,
      stdio: "pipe",
    }).toString();

    if (output.trim()) {
      // Parse container status
      for (const line of output.trim().split("\n")) {
        try {
          const container = JSON.parse(line);
          results.containers.push({
            name: container.Name,
            state: container.State,
            status: container.Status,
          });
        } catch {
          // Not valid JSON
        }
      }
      results.containersUp = results.containers.some((c) => c.state === "running");
    }
  } catch {
    // Docker not available
  }

  return results;
}

/**
 * Check MCP server health
 */
async function checkMCPServers(installDir, _verbose) {
  const results = {
    memoryServer: { configured: false, running: false, healthy: false },
    geminiBridge: { configured: false, running: false, healthy: false },
  };

  // Check if mcp.json exists
  const mcpPath = path.join(installDir, ".vscode", "mcp.json");
  if (fs.existsSync(mcpPath)) {
    try {
      const mcp = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
      if (mcp.servers && mcp.servers["memory"]) {
        results.memoryServer.configured = true;
      }
      if (mcp.servers && mcp.servers["gemini"]) {
        results.geminiBridge.configured = true;
      }
    } catch {
      // Invalid JSON
    }
  }

  // Check ports
  const memoryPort = await checkPort(3100);
  results.memoryServer.running = memoryPort.listening;
  results.memoryServer.healthy = memoryPort.status === 200;

  const geminiPort = await checkPort(3101);
  results.geminiBridge.running = geminiPort.listening;
  results.geminiBridge.healthy = geminiPort.status === 200;

  return results;
}

/**
 * Check file system state
 */
function checkFileSystem(installDir, _verbose) {
  const results = {
    collectiveDir: false,
    memoryServer: false,
    geminiBridge: false,
    agents: false,
    instructions: false,
    config: false,
    built: false,
  };

  const collectiveDir = path.join(installDir, ".collective");
  results.collectiveDir = fs.existsSync(collectiveDir);

  if (results.collectiveDir) {
    results.memoryServer = fs.existsSync(path.join(collectiveDir, "memory-server", "package.json"));
    results.geminiBridge = fs.existsSync(path.join(collectiveDir, "gemini-bridge", "package.json"));

    // Check if built
    results.built =
      fs.existsSync(path.join(collectiveDir, "memory-server", "dist", "index.js")) &&
      fs.existsSync(path.join(collectiveDir, "gemini-bridge", "dist", "mcp-server.js"));
  }

  results.agents = fs.existsSync(path.join(installDir, ".github", "agents"));
  results.instructions = fs.existsSync(path.join(installDir, ".github", "instructions"));
  results.config = fs.existsSync(path.join(installDir, "collective.config.json"));

  return results;
}

/**
 * Check dependencies
 */
function checkDependencies(installDir, _verbose) {
  const results = {
    memoryServerDeps: false,
    geminiBridgeDeps: false,
    nodeModules: false,
  };

  const collectiveDir = path.join(installDir, ".collective");

  results.nodeModules = fs.existsSync(path.join(collectiveDir, "memory-server", "node_modules"));
  results.memoryServerDeps = results.nodeModules;

  results.geminiBridgeDeps = fs.existsSync(path.join(collectiveDir, "gemini-bridge", "node_modules"));

  return results;
}

/**
 * Try to fix issues
 */
function tryFix(issue, installDir, verbose) {
  console.log(`  Attempting to fix: ${issue}...`);

  switch (issue) {
    case "dependencies":
      try {
        execSync("npm install", {
          cwd: path.join(installDir, ".collective", "memory-server"),
          stdio: verbose ? "inherit" : "pipe",
        });
        execSync("npm install", {
          cwd: path.join(installDir, ".collective", "gemini-bridge"),
          stdio: verbose ? "inherit" : "pipe",
        });
        ui.success("  Dependencies installed");
        return true;
      } catch (error) {
        ui.error(`  Failed: ${error.message}`);
        return false;
      }

    case "build":
      try {
        execSync("npm run build", {
          cwd: path.join(installDir, ".collective", "memory-server"),
          stdio: verbose ? "inherit" : "pipe",
        });
        execSync("npm run build", {
          cwd: path.join(installDir, ".collective", "gemini-bridge"),
          stdio: verbose ? "inherit" : "pipe",
        });
        ui.success("  Build completed");
        return true;
      } catch (error) {
        ui.error(`  Failed: ${error.message}`);
        return false;
      }

    case "docker":
      try {
        execSync("docker compose up -d", {
          cwd: installDir,
          stdio: verbose ? "inherit" : "pipe",
        });
        ui.success("  Docker containers started");
        return true;
      } catch (error) {
        ui.error(`  Failed: ${error.message}`);
        return false;
      }

    default:
      ui.warn(`  No automatic fix available for: ${issue}`);
      return false;
  }
}

/**
 * Main doctor function
 */
async function doctor(options) {
  const targetDir = process.cwd();

  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║             >the_collective - Health Check                   ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");

  // Step 1: Find installation
  ui.step(1, 5, "Detecting installation...");

  let installDir = targetDir;
  let installed = null;
  if (workspace) {
    const workspaceRoot = workspace.findWorkspaceRoot(targetDir);
    if (workspaceRoot) {
      installDir = workspaceRoot;
    }

    installed = workspace.isCollectiveInstalled(installDir);
    if (!installed.installed) {
      ui.error("the_collective is not installed in this project.");
      ui.info("Run 'npx the_collective install' to install.");
      process.exit(1);
    }

    ui.success(`Found installation: v${installed.version} (${installed.mode} mode)`);
  } else {
    // Check manually
    if (!fs.existsSync(path.join(installDir, ".collective"))) {
      ui.error("the_collective is not installed in this project.");
      process.exit(1);
    }
    ui.success("Found installation");
  }

  const issues = [];
  const warnings = [];

  // Step 2: Check file system
  ui.step(2, 5, "Checking file system...");

  const fsResults = checkFileSystem(installDir, options.verbose);

  if (!fsResults.collectiveDir) {
    issues.push("Missing .collective/ directory");
    ui.error(".collective/ directory not found");
  } else {
    ui.success(".collective/ directory exists");

    if (!fsResults.memoryServer) {
      issues.push("Missing memory-server");
      ui.error("memory-server not found");
    } else {
      ui.success("memory-server present");
    }

    if (!fsResults.geminiBridge) {
      issues.push("Missing gemini-bridge");
      ui.error("gemini-bridge not found");
    } else {
      ui.success("gemini-bridge present");
    }

    if (!fsResults.built) {
      issues.push("build");
      ui.warn("TypeScript not built");
    } else {
      ui.success("TypeScript compiled");
    }
  }

  if (!fsResults.agents) {
    warnings.push("Missing .github/agents/");
    ui.warn(".github/agents/ not found");
  } else {
    ui.success(".github/agents/ exists");
  }

  if (!fsResults.instructions) {
    warnings.push("Missing .github/instructions/");
    ui.warn(".github/instructions/ not found");
  } else {
    ui.success(".github/instructions/ exists");
  }

  // Step 3: Check dependencies
  ui.step(3, 5, "Checking dependencies...");

  const depResults = checkDependencies(installDir, options.verbose);

  if (!depResults.memoryServerDeps) {
    issues.push("dependencies");
    ui.warn("memory-server dependencies not installed");
  } else {
    ui.success("memory-server dependencies installed");
  }

  if (!depResults.geminiBridgeDeps) {
    issues.push("dependencies");
    ui.warn("gemini-bridge dependencies not installed");
  } else {
    ui.success("gemini-bridge dependencies installed");
  }

  // Step 4: Check Docker (if applicable)
  ui.step(4, 5, "Checking Docker...");

  const dockerResults = await checkDocker(installDir, options.verbose);

  if (!dockerResults.installed) {
    warnings.push("Docker not installed");
    ui.warn("Docker not installed (required for docker mode)");
  } else {
    ui.success("Docker installed");

    if (!dockerResults.running) {
      warnings.push("Docker not running");
      ui.warn("Docker daemon not running");
    } else {
      ui.success("Docker daemon running");

      if (dockerResults.containers.length > 0) {
        const running = dockerResults.containers.filter((c) => c.state === "running");
        if (running.length > 0) {
          ui.success(`${running.length} container(s) running`);
        } else {
          issues.push("docker");
          ui.warn("Docker containers not running");
        }
      }
    }
  }

  // Step 5: Check MCP servers
  ui.step(5, 5, "Checking MCP servers...");

  const mcpResults = await checkMCPServers(installDir, options.verbose);

  // Determine mode (stdio mode doesn't use ports)
  const isStdioMode = installed?.mode === "stdio" || installed?.mode === "local";

  if (!mcpResults.memoryServer.configured) {
    warnings.push("Memory server not configured in mcp.json");
    ui.warn("Memory server not configured");
  } else {
    if (isStdioMode) {
      ui.success("Memory server configured (stdio mode - VS Code will spawn)");
    } else if (mcpResults.memoryServer.running) {
      ui.success("Memory server running on port 3100");
    } else {
      warnings.push("Memory server not responding");
      ui.warn("Memory server not responding on port 3100");
    }
  }

  if (!mcpResults.geminiBridge.configured) {
    warnings.push("Gemini bridge not configured in mcp.json");
    ui.warn("Gemini bridge not configured");
  } else {
    if (isStdioMode) {
      ui.success("Gemini bridge configured (stdio mode - VS Code will spawn)");
    } else if (mcpResults.geminiBridge.running) {
      ui.success("Gemini bridge running on port 3101");
    } else {
      warnings.push("Gemini bridge not responding");
      ui.warn("Gemini bridge not responding on port 3101");
    }
  }

  // Summary
  console.log("");
  console.log("═".repeat(60));

  if (issues.length === 0 && warnings.length === 0) {
    console.log("");
    ui.success("All systems healthy! 🎉");
    console.log("");
    process.exit(0);
  }

  if (issues.length > 0) {
    console.log("");
    console.log(`Found ${issues.length} issue(s) requiring attention:`);
    for (const issue of [...new Set(issues)]) {
      console.log(`  ✗ ${issue}`);
    }
  }

  if (warnings.length > 0) {
    console.log("");
    console.log(`Found ${warnings.length} warning(s):`);
    for (const warning of warnings) {
      console.log(`  ⚠ ${warning}`);
    }
  }

  // Try to fix if requested
  if (options.fix && issues.length > 0) {
    console.log("");
    console.log("Attempting automatic fixes...");
    console.log("");

    const uniqueIssues = [...new Set(issues)];
    let fixed = 0;

    for (const issue of uniqueIssues) {
      const success = await tryFix(issue, installDir, options.verbose);
      if (success) {
        fixed++;
      }
    }

    console.log("");
    if (fixed === uniqueIssues.length) {
      ui.success("All issues fixed! Run doctor again to verify.");
    } else {
      ui.warn(`Fixed ${fixed}/${uniqueIssues.length} issues.`);
      ui.info("Some issues require manual intervention.");
    }
  } else if (issues.length > 0) {
    console.log("");
    ui.info("Run 'npx the_collective doctor --fix' to attempt automatic fixes.");
  }

  console.log("");
  process.exit(issues.length > 0 ? 1 : 0);
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  try {
    await doctor(options);
  } catch (error) {
    ui.error(`Doctor failed: ${error.message}`);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
