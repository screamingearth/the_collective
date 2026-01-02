/**
 * Workspace Detection Utilities
 * Part of >the_collective by screamingearth (Apache 2.0 licensed)
 *
 * Provides functions for detecting workspace root, checking installation status,
 * and validating workspace structure across different scenarios.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Markers that indicate the root of a the_collective workspace
const WORKSPACE_MARKERS = [
  "collective.config.json", // Explicit config (highest priority)
  ".collective", // Framework directory
];

// Markers that indicate a generic project root (fallback)
const PROJECT_MARKERS = [".git", "package.json", "pyproject.toml", "Cargo.toml", "go.mod"];

/**
 * Find the workspace root by walking up the directory tree
 * @param {string} startDir - Directory to start searching from
 * @returns {string|null} - Absolute path to workspace root, or null if not found
 */
function findWorkspaceRoot(startDir = process.cwd()) {
  // 1. Check environment override first
  if (process.env.THE_COLLECTIVE_ROOT) {
    const envRoot = path.resolve(process.env.THE_COLLECTIVE_ROOT);
    if (fs.existsSync(envRoot)) {
      return envRoot;
    }
    console.warn(`Warning: THE_COLLECTIVE_ROOT=${envRoot} does not exist, ignoring`);
  }

  // 2. Walk up directory tree looking for markers
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;

  while (dir !== root) {
    // Check for the_collective specific markers
    for (const marker of WORKSPACE_MARKERS) {
      if (fs.existsSync(path.join(dir, marker))) {
        return dir;
      }
    }

    // Check for package.json with the_collective name
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        if (pkg.name === "the-collective-workspace") {
          return dir;
        }
      } catch {
        // Invalid JSON, continue searching
      }
    }

    dir = path.dirname(dir);
  }

  // 3. Fallback: try git root
  try {
    const gitRoot = execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    if (gitRoot && fs.existsSync(gitRoot)) {
      return gitRoot;
    }
  } catch {
    // Not in a git repo
  }

  return null;
}

/**
 * Find project root (generic, not necessarily the_collective)
 * @param {string} startDir - Directory to start searching from
 * @returns {string|null} - Absolute path to project root, or null if not found
 */
function findProjectRoot(startDir = process.cwd()) {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;

  while (dir !== root) {
    for (const marker of PROJECT_MARKERS) {
      if (fs.existsSync(path.join(dir, marker))) {
        return dir;
      }
    }
    dir = path.dirname(dir);
  }

  return null;
}

/**
 * Check if the_collective is installed in a directory
 * @param {string} dir - Directory to check
 * @returns {{ installed: boolean, version: string|null, mode: string|null }}
 */
function isCollectiveInstalled(dir) {
  const collectiveDir = path.join(dir, ".collective");
  const configPath = path.join(dir, "collective.config.json");

  if (!fs.existsSync(collectiveDir)) {
    return { installed: false, version: null, mode: null };
  }

  // Check for config file
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      return {
        installed: true,
        version: config.version || "unknown",
        mode: config.mode || "unknown",
      };
    } catch {
      // Config exists but is invalid
    }
  }

  // Fallback: check for essential directories
  const hasMemoryServer = fs.existsSync(path.join(collectiveDir, "memory-server"));
  const hasGeminiBridge = fs.existsSync(path.join(collectiveDir, "gemini-bridge"));

  return {
    installed: hasMemoryServer || hasGeminiBridge,
    version: "unknown",
    mode: "unknown",
  };
}

/**
 * Detect if this is a nested installation (inside another the_collective)
 * @param {string} dir - Directory to check
 * @returns {{ nested: boolean, parentRoot: string|null }}
 */
function detectNestedInstallation(dir) {
  const resolved = path.resolve(dir);
  let parent = path.dirname(resolved);
  const root = path.parse(resolved).root;

  while (parent !== root) {
    const result = isCollectiveInstalled(parent);
    if (result.installed) {
      return { nested: true, parentRoot: parent };
    }
    parent = path.dirname(parent);
  }

  return { nested: false, parentRoot: null };
}

/**
 * Detect project type based on files present
 * @param {string} dir - Directory to check
 * @returns {{ type: string, runtime: string, framework: string|null }}
 */
function getProjectType(dir) {
  // Node.js detection
  const pkgPath = path.join(dir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Detect frameworks
      if (deps.next) {
        return { type: "nextjs", runtime: "node", framework: "next" };
      }
      if (deps.nuxt) {
        return { type: "nuxt", runtime: "node", framework: "nuxt" };
      }
      if (deps.svelte || deps["@sveltejs/kit"]) {
        return { type: "svelte", runtime: "node", framework: "svelte" };
      }
      if (deps.vue) {
        return { type: "vue", runtime: "node", framework: "vue" };
      }
      if (deps.react) {
        return { type: "react", runtime: "node", framework: "react" };
      }
      if (deps.express) {
        return { type: "express", runtime: "node", framework: "express" };
      }
      if (deps.fastify) {
        return { type: "fastify", runtime: "node", framework: "fastify" };
      }

      return { type: "node", runtime: "node", framework: null };
    } catch {
      // Invalid package.json
    }
  }

  // Python detection
  if (fs.existsSync(path.join(dir, "pyproject.toml"))) {
    try {
      const pyproject = fs.readFileSync(path.join(dir, "pyproject.toml"), "utf8");
      if (pyproject.includes("django")) {
        return { type: "django", runtime: "python", framework: "django" };
      }
      if (pyproject.includes("fastapi")) {
        return { type: "fastapi", runtime: "python", framework: "fastapi" };
      }
      if (pyproject.includes("flask")) {
        return { type: "flask", runtime: "python", framework: "flask" };
      }
    } catch {
      // Invalid pyproject.toml
    }
    return { type: "python", runtime: "python", framework: null };
  }

  if (fs.existsSync(path.join(dir, "requirements.txt"))) {
    return { type: "python", runtime: "python", framework: null };
  }

  // Rust detection
  if (fs.existsSync(path.join(dir, "Cargo.toml"))) {
    return { type: "rust", runtime: "rust", framework: null };
  }

  // Go detection
  if (fs.existsSync(path.join(dir, "go.mod"))) {
    return { type: "go", runtime: "go", framework: null };
  }

  // Ruby detection
  if (fs.existsSync(path.join(dir, "Gemfile"))) {
    return { type: "ruby", runtime: "ruby", framework: null };
  }

  // Java/Kotlin detection
  if (fs.existsSync(path.join(dir, "pom.xml")) || fs.existsSync(path.join(dir, "build.gradle"))) {
    return { type: "java", runtime: "jvm", framework: null };
  }

  return { type: "unknown", runtime: "unknown", framework: null };
}

/**
 * Validate workspace structure and return issues
 * @param {string} dir - Directory to validate
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateWorkspace(dir) {
  const errors = [];
  const warnings = [];

  // Required structure
  const required = [
    { path: ".collective", type: "directory" },
    { path: ".collective/memory-server", type: "directory" },
    { path: ".collective/memory-server/dist/index.js", type: "file" },
    { path: ".github/agents", type: "directory" },
    { path: ".github/copilot-instructions.md", type: "file" },
  ];

  const recommended = [
    { path: ".collective/gemini-bridge", type: "directory" },
    { path: ".collective/gemini-bridge/dist/mcp-server.js", type: "file" },
    { path: ".vscode/mcp.json", type: "file" },
    { path: "collective.config.json", type: "file" },
  ];

  for (const item of required) {
    const fullPath = path.join(dir, item.path);
    if (!fs.existsSync(fullPath)) {
      errors.push(`Missing required ${item.type}: ${item.path}`);
    } else {
      const stat = fs.statSync(fullPath);
      if (item.type === "directory" && !stat.isDirectory()) {
        errors.push(`Expected directory but found file: ${item.path}`);
      }
      if (item.type === "file" && !stat.isFile()) {
        errors.push(`Expected file but found directory: ${item.path}`);
      }
    }
  }

  for (const item of recommended) {
    const fullPath = path.join(dir, item.path);
    if (!fs.existsSync(fullPath)) {
      warnings.push(`Missing recommended ${item.type}: ${item.path}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get configuration from collective.config.json
 * @param {string} dir - Directory to read config from
 * @returns {object|null} - Configuration object or null if not found
 */
function getConfig(dir) {
  const configPath = path.join(dir, "collective.config.json");
  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    console.warn(`Warning: Failed to parse collective.config.json: ${error.message}`);
    return null;
  }
}

/**
 * Save configuration to collective.config.json
 * @param {string} dir - Directory to save config to
 * @param {object} config - Configuration object
 */
function saveConfig(dir, config) {
  const configPath = path.join(dir, "collective.config.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}

/**
 * Get suggested configuration based on project type
 * @param {{ type: string, runtime: string, framework: string|null }} projectType
 * @returns {{ mode: string, suggestions: string[] }}
 */
function getSuggestedConfig(projectType) {
  const suggestions = [];

  // Default to docker mode
  let mode = "docker";

  switch (projectType.framework) {
    case "next":
    case "nuxt":
    case "svelte":
      // Dev servers often use port 3000, docker might conflict
      mode = "docker"; // Still prefer docker, but warn
      suggestions.push("Note: Framework dev server may use port 3000. MCP servers use 3100/3101.");
      break;

    case "express":
    case "fastify":
      suggestions.push("Your API server can integrate with the_collective agents for code review.");
      break;
  }

  switch (projectType.runtime) {
    case "python":
      suggestions.push("Consider adding Python-specific agent instructions in .github/agents/");
      break;
    case "rust":
      suggestions.push("Consider adding Rust-specific agent instructions in .github/agents/");
      break;
  }

  return { mode, suggestions };
}

module.exports = {
  findWorkspaceRoot,
  findProjectRoot,
  isCollectiveInstalled,
  detectNestedInstallation,
  getProjectType,
  validateWorkspace,
  getConfig,
  saveConfig,
  getSuggestedConfig,
  WORKSPACE_MARKERS,
  PROJECT_MARKERS,
};
