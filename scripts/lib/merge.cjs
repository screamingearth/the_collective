/**
 * File Merge Strategies
 * Part of >the_collective by screamingearth (Apache 2.0 licensed)
 *
 * Provides intelligent merge strategies for different file types
 * when integrating the_collective into existing projects.
 */

const fs = require("fs");
const path = require("path");

// Separator used to mark the_collective sections in merged files
const COLLECTIVE_SECTION_START = `
<!-- ═══════════════════════════════════════════════════════════════════════════ -->
<!-- >the_collective Framework Instructions (Auto-merged)                         -->
<!-- Do not edit below this line - managed by the_collective                      -->
<!-- To update: npx the_collective update | To remove: npx the_collective uninstall -->
<!-- ═══════════════════════════════════════════════════════════════════════════ -->
`;

const COLLECTIVE_SECTION_PATTERN = /<!-- ═{50,} -->\s*<!-- >the_collective.*?<!-- ═{50,} -->/gs;

/**
 * Deep merge two objects, with source values taking precedence
 * @param {object} target - Base object
 * @param {object} source - Object to merge (takes precedence)
 * @returns {object} - Merged object
 */
function deepMerge(target, source) {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      if (target[key] && typeof target[key] === "object" && !Array.isArray(target[key])) {
        result[key] = deepMerge(target[key], source[key]);
      } else {
        result[key] = { ...source[key] };
      }
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

/**
 * Merge .github/copilot-instructions.md
 * Strategy: Append collective content with clear separator, or replace existing section
 *
 * @param {string} existing - Existing file content
 * @param {string} collective - the_collective content to add
 * @returns {string} - Merged content
 */
function mergeCopilotInstructions(existing, collective) {
  // Check if already merged (has our section)
  if (existing.match(COLLECTIVE_SECTION_PATTERN)) {
    // Replace existing section
    return existing.replace(COLLECTIVE_SECTION_PATTERN, COLLECTIVE_SECTION_START + "\n" + collective);
  }

  // First time merge - append with separator
  return existing.trim() + "\n\n" + COLLECTIVE_SECTION_START + "\n" + collective;
}

/**
 * Remove the_collective section from copilot-instructions.md
 * @param {string} content - File content
 * @returns {string} - Content with collective section removed
 */
function removeCopilotInstructionsSection(content) {
  return content.replace(COLLECTIVE_SECTION_PATTERN, "").trim();
}

/**
 * Merge .vscode/mcp.json
 * Strategy: Merge servers object, prefix with 'collective-' on conflict
 *
 * @param {object} existing - Existing mcp.json content
 * @param {object} collective - the_collective mcp.json content
 * @returns {{ merged: object, conflicts: string[] }}
 */
function mergeMcpJson(existing, collective) {
  const merged = { ...existing };
  merged.servers = merged.servers || {};
  const conflicts = [];

  for (const [name, config] of Object.entries(collective.servers || {})) {
    if (merged.servers[name]) {
      // Check if it's the same server (same URL or command)
      const existingServer = merged.servers[name];
      const isSame =
        (existingServer.url && existingServer.url === config.url) ||
        (existingServer.command && existingServer.command === config.command);

      if (isSame) {
        // Same server, update config
        merged.servers[name] = config;
      } else {
        // Different server with same name - prefix ours
        const newName = `collective-${name}`;
        merged.servers[newName] = config;
        conflicts.push(`Server '${name}' already exists, added as '${newName}'`);
      }
    } else {
      merged.servers[name] = config;
    }
  }

  return { merged, conflicts };
}

/**
 * Remove the_collective servers from mcp.json
 * @param {object} mcpJson - mcp.json content
 * @returns {object} - Content with collective servers removed
 */
function removeCollectiveServers(mcpJson) {
  const result = { ...mcpJson };
  result.servers = result.servers || {};

  // Remove known collective servers
  const collectiveServers = ["memory", "gemini", "collective-memory", "collective-gemini"];
  for (const server of collectiveServers) {
    delete result.servers[server];
  }

  return result;
}

/**
 * Merge .vscode/settings.json
 * Strategy: Deep merge, prefer existing user values
 *
 * @param {object} existing - Existing settings
 * @param {object} collective - the_collective settings
 * @returns {object} - Merged settings
 */
function mergeSettings(existing, collective) {
  // Merge with existing taking precedence
  return deepMerge(collective, existing);
}

/**
 * Merge .vscode/tasks.json
 * Strategy: Append tasks, avoid duplicates by label
 *
 * @param {object} existing - Existing tasks.json
 * @param {object} collective - the_collective tasks.json
 * @returns {{ merged: object, added: string[], skipped: string[] }}
 */
function mergeTasks(existing, collective) {
  const existingLabels = new Set((existing.tasks || []).map((t) => t.label));
  const added = [];
  const skipped = [];

  const newTasks = [];
  for (const task of collective.tasks || []) {
    if (existingLabels.has(task.label)) {
      skipped.push(task.label);
    } else {
      // Mark as collective task for later removal
      const markedTask = { ...task, _collective: true };
      newTasks.push(markedTask);
      added.push(task.label);
    }
  }

  const merged = {
    version: existing.version || collective.version || "2.0.0",
    tasks: [...(existing.tasks || []), ...newTasks],
  };

  return { merged, added, skipped };
}

/**
 * Remove the_collective tasks from tasks.json
 * @param {object} tasksJson - tasks.json content
 * @returns {object} - Content with collective tasks removed
 */
function removeCollectiveTasks(tasksJson) {
  const result = { ...tasksJson };

  // Remove tasks marked as collective or with known labels
  const collectiveLabels = [
    "Start Docker Containers",
    "Stop Docker Containers",
    "Switch to Docker Mode",
    "Switch to stdio Mode",
    "Health Check (Quick)",
    "Start Memory Server (stdio)",
    "Start Gemini Bridge (stdio)",
    "Build Framework",
    "Build Memory Server",
    "Build Gemini Bridge",
    "Bootstrap Memories",
    "Validate TypeScript",
    "Test Memory System",
    "Run Framework Validation",
    "Full Setup (Fresh Clone)",
    "Clean All",
    "Update Dependencies",
    "Rebuild Native Modules",
    "Verify Memory System",
    "Verify All Systems",
    "Validate Workspace",
  ];

  result.tasks = (result.tasks || []).filter((task) => {
    return !task._collective && !collectiveLabels.includes(task.label);
  });

  return result;
}

/**
 * Merge .gitignore
 * Strategy: Append missing patterns with section header
 *
 * @param {string} existing - Existing .gitignore content
 * @param {string[]} collectivePatterns - Patterns to add
 * @returns {{ merged: string, added: string[] }}
 */
function mergeGitignore(existing, collectivePatterns) {
  const existingLines = new Set(
    existing
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#")),
  );

  const newPatterns = collectivePatterns.filter((p) => !existingLines.has(p.trim()));

  if (newPatterns.length === 0) {
    return { merged: existing, added: [] };
  }

  const header = "\n# === the_collective ===\n";
  const merged = existing.trimEnd() + header + newPatterns.join("\n") + "\n";

  return { merged, added: newPatterns };
}

/**
 * Remove the_collective section from .gitignore
 * @param {string} content - .gitignore content
 * @returns {string} - Content with collective section removed
 */
function removeGitignoreSection(content) {
  // Remove everything from "# === the_collective ===" to next section or end
  const lines = content.split("\n");
  const result = [];
  let inCollectiveSection = false;

  for (const line of lines) {
    if (line.trim() === "# === the_collective ===") {
      inCollectiveSection = true;
      continue;
    }

    if (inCollectiveSection && line.startsWith("# ===") && line.includes("===")) {
      // Start of another section
      inCollectiveSection = false;
    }

    if (!inCollectiveSection) {
      result.push(line);
    }
  }

  return result.join("\n").trimEnd() + "\n";
}

// Patterns to add to .gitignore for the_collective
const COLLECTIVE_GITIGNORE_PATTERNS = [
  "# the_collective data",
  ".mcp/",
  "!.mcp/.gitkeep",
  "collective.config.json",
  "",
  "# the_collective build artifacts",
  ".collective/memory-server/dist/",
  ".collective/gemini-bridge/dist/",
  ".collective/memory-server/node_modules/",
  ".collective/gemini-bridge/node_modules/",
  ".collective/.logs/",
];

/**
 * Create backup of a file before modifying
 * @param {string} filePath - Path to file
 * @param {string} backupDir - Directory to store backups
 * @returns {string|null} - Path to backup file, or null if original doesn't exist
 */
function createBackup(filePath, backupDir) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const fileName = path.basename(filePath);
  const backupPath = path.join(backupDir, fileName);

  // Create backup directory if needed
  fs.mkdirSync(backupDir, { recursive: true });

  // Copy file
  fs.copyFileSync(filePath, backupPath);

  return backupPath;
}

/**
 * Restore file from backup
 * @param {string} backupPath - Path to backup file
 * @param {string} originalPath - Path to restore to
 */
function restoreFromBackup(backupPath, originalPath) {
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, originalPath);
  }
}

module.exports = {
  deepMerge,
  mergeCopilotInstructions,
  removeCopilotInstructionsSection,
  mergeMcpJson,
  removeCollectiveServers,
  mergeSettings,
  mergeTasks,
  removeCollectiveTasks,
  mergeGitignore,
  removeGitignoreSection,
  createBackup,
  restoreFromBackup,
  COLLECTIVE_GITIGNORE_PATTERNS,
  COLLECTIVE_SECTION_START,
};
