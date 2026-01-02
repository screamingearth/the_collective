#!/usr/bin/env node
/**
 * Mode Switching Script - Switch between docker and stdio modes
 * Part of >the_collective by screamingearth (Apache 2.0 licensed)
 *
 * Usage:
 *   npx the_collective mode <docker|stdio|status>
 *   node scripts/mode.cjs <docker|stdio|status>
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

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
  };
}

function printHelp() {
  console.log(`
>the_collective mode - Switch MCP transport modes

Usage:
  npx the_collective mode <docker|stdio|status>

Modes:
  docker    MCP servers via Docker containers (SSE transport)
            - Servers run in isolated containers
            - Auto-restart on failure
            - Ports 3100/3101 exposed

  stdio     MCP servers via Node.js (stdio transport)
            - VS Code spawns servers directly
            - Lower overhead
            - Easier debugging

  status    Show current mode and server status

Both modes run locally on your machine. The difference is the
transport protocol used between VS Code and the MCP servers.

Examples:
  npx the_collective mode docker   # Use Docker/SSE
  npx the_collective mode stdio    # Use Node.js/stdio
  npx the_collective mode status   # Show current mode
`);
}

/**
 * Show current status
 */
function showStatus(installDir) {
  console.log("");
  console.log("Current Status:");
  console.log("─".repeat(50));

  // Check config
  const configPath = path.join(installDir, "collective.config.json");
  let currentMode = "unknown";

  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      currentMode = config.mode || "docker";
    } catch {
      // Ignore
    }
  }

  // Check mcp.json to verify
  const mcpPath = path.join(installDir, ".vscode", "mcp.json");
  let mcpMode = "unknown";

  if (fs.existsSync(mcpPath)) {
    try {
      const mcp = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
      const memoryServer = mcp.servers?.memory || mcp.mcpServers?.memory;
      if (memoryServer?.type === "sse" || memoryServer?.url) {
        mcpMode = "docker";
      } else if (memoryServer?.command) {
        mcpMode = "stdio";
      }
    } catch {
      // Ignore
    }
  }

  // Normalize legacy "local" to "stdio"
  if (currentMode === "local") {
    currentMode = "stdio";
  }

  console.log(`  Mode (config):    ${currentMode}`);
  console.log(`  Mode (mcp.json):  ${mcpMode}`);

  if (currentMode !== mcpMode && mcpMode !== "unknown") {
    ui.warn("Config and mcp.json are out of sync!");
    ui.info(`Run 'npx the_collective mode ${currentMode}' to fix.`);
  }

  // Check Docker containers if in docker mode
  if (currentMode === "docker" || mcpMode === "docker") {
    console.log("");
    console.log("Docker Containers:");
    try {
      const result = execSync("docker ps --filter 'name=collective-' --format '  {{.Names}}: {{.Status}}'", {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      if (result.trim()) {
        console.log(result.trim());
      } else {
        console.log("  (no containers running)");
      }
    } catch {
      console.log("  (Docker not available)");
    }
  }

  console.log("");
}

/**
 * Switch to Docker mode (SSE transport)
 */
function switchToDocker(installDir) {
  const vscodeDir = path.join(installDir, ".vscode");
  const mcpPath = path.join(vscodeDir, "mcp.json");
  const dockerMcpPath = path.join(vscodeDir, "mcp.docker.json");

  // Check if docker config exists
  if (!fs.existsSync(dockerMcpPath)) {
    // Create it from template
    const dockerConfig = {
      servers: {
        memory: {
          type: "sse",
          url: "http://localhost:3100/sse",
        },
        gemini: {
          type: "sse",
          url: "http://localhost:3101/sse",
        },
        filesystem: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem", "${workspaceFolder}"],
        },
      },
    };
    fs.writeFileSync(dockerMcpPath, JSON.stringify(dockerConfig, null, 2) + "\n");
  }

  // Copy docker config to active
  fs.copyFileSync(dockerMcpPath, mcpPath);

  // Update collective.config.json
  const configPath = path.join(installDir, "collective.config.json");
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      config.mode = "docker";
      config.updatedAt = new Date().toISOString();
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
    } catch {
      // Ignore
    }
  }

  // Start Docker containers
  ui.info("Starting Docker containers...");
  try {
    execSync("docker compose up -d", {
      cwd: installDir,
      stdio: "inherit",
    });
    ui.success("Docker containers started");
  } catch (error) {
    ui.warn(`Failed to start containers: ${error.message}`);
    ui.info("Run 'docker compose up -d' manually");
  }

  return true;
}

/**
 * Switch to stdio mode (Node.js direct)
 */
function switchToStdio(installDir) {
  const vscodeDir = path.join(installDir, ".vscode");
  const mcpPath = path.join(vscodeDir, "mcp.json");
  const stdioMcpPath = path.join(vscodeDir, "mcp.stdio.json");

  // Check if stdio config exists
  if (!fs.existsSync(stdioMcpPath)) {
    // Create it from template using ${workspaceFolder} for portability
    const stdioConfig = {
      servers: {
        memory: {
          type: "stdio",
          command: "node",
          args: ["${workspaceFolder}/.collective/memory-server/dist/index.js"],
          env: {
            MCP_TRANSPORT: "stdio",
            MEMORY_DB_PATH: "${workspaceFolder}/.mcp/collective_memory.duckdb",
          },
        },
        gemini: {
          type: "stdio",
          command: "node",
          args: ["${workspaceFolder}/.collective/gemini-bridge/dist/mcp-server.js"],
          env: {
            MCP_TRANSPORT: "stdio",
            WORKSPACE_ROOT: "${workspaceFolder}",
          },
        },
        filesystem: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-filesystem", "${workspaceFolder}"],
        },
      },
    };
    fs.writeFileSync(stdioMcpPath, JSON.stringify(stdioConfig, null, 2) + "\n");
  }

  // Copy stdio config to active
  fs.copyFileSync(stdioMcpPath, mcpPath);

  // Update collective.config.json
  const configPath = path.join(installDir, "collective.config.json");
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      config.mode = "stdio";
      config.updatedAt = new Date().toISOString();
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
    } catch {
      // Ignore
    }
  }

  // Stop Docker containers if running
  ui.info("Stopping Docker containers...");
  try {
    execSync("docker compose down", {
      cwd: installDir,
      stdio: "pipe",
    });
    ui.success("Docker containers stopped");
  } catch {
    // Ignore - might not be running
  }

  return true;
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printHelp();
    process.exit(0);
  }

  let mode = args[0].toLowerCase();

  // Handle aliases for backwards compatibility
  if (mode === "local") {
    mode = "stdio";
  }

  // Find installation first
  const targetDir = process.cwd();
  let installDir = targetDir;

  if (workspace) {
    const workspaceRoot = workspace.findWorkspaceRoot(targetDir);
    if (workspaceRoot) {
      installDir = workspaceRoot;
    }

    const installed = workspace.isCollectiveInstalled(installDir);
    if (!installed.installed) {
      ui.error("the_collective is not installed in this project.");
      process.exit(1);
    }
  }

  // Handle status command
  if (mode === "status") {
    showStatus(installDir);
    process.exit(0);
  }

  if (mode !== "docker" && mode !== "stdio") {
    ui.error(`Invalid mode: ${mode}`);
    ui.info("Valid modes: docker, stdio, status");
    process.exit(1);
  }

  if (workspace) {
    const installed = workspace.isCollectiveInstalled(installDir);
    // Normalize "local" to "stdio" for comparison
    const currentMode = installed.mode === "local" ? "stdio" : installed.mode;
    if (currentMode === mode) {
      ui.info(`Already in ${mode} mode.`);
      process.exit(0);
    }
  }

  console.log("");
  console.log(`Switching to ${mode} mode...`);
  console.log("");

  try {
    if (mode === "docker") {
      switchToDocker(installDir);
    } else {
      switchToStdio(installDir);
    }

    console.log("");
    ui.success(`Switched to ${mode} mode`);
    console.log("");
    ui.info("Please reload VS Code to apply changes.");
    console.log("");
  } catch (error) {
    ui.error(`Failed to switch mode: ${error.message}`);
    process.exit(1);
  }
}

main();
