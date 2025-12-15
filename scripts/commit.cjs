#!/usr/bin/env node

/**
 * the_collective - Smart Commit Tool
 *
 * A delightful two-in-one developer workflow tool that:
 * 1. Creates a git commit with proper conventional commit formatting
 * 2. Appends a changelog entry to CHANGELOG.md
 *
 * Usage:
 *   npm run commit                              # Full interactive mode
 *   npm run commit -- -t feat -m "message"      # Non-interactive with type and message
 *   npm run commit -- --type feat               # Specify change type
 *   npm run commit -- --generate                # Auto-generate commit/changelog messages
 *   npm run commit -- --no-commit               # Only update changelog
 *   npm run commit -- --no-changelog            # Only commit (no changelog)
 *   npm run commit -- --push                    # Auto-push after commit
 *   npm run commit -- --amend                   # Amend last commit
 *   npm run commit -- --dry-run                 # Preview without making changes
 *   npm run commit -- --help                    # Show help
 *
 * Interactive Tips:
 *   When prompted for messages, type "auto" (or "a") to generate a message
 *   based on your staged changes. You can then edit the generated message
 *   or press Enter to accept it.
 *
 * Flags:
 *   --type, -t       Change type: feat|fix|docs|refactor|perf|test|chore|breaking|security
 *   --scope, -s      Optional scope for the commit type (e.g., api, ui)
 *   --breaking, -b   Mark this commit as a breaking change (!)
 *   --message, -m    Commit message (skips interactive prompt)
 *   --changelog-message, -c  Changelog message (defaults to commit message)
 *   --generate, -g   Auto-generate commit and changelog messages from diff
 *   --no-commit      Skip git commit (only update changelog)
 *   --no-changelog   Skip changelog update (only commit)
 *   --push, -p       Push to remote after commit
 *   --amend          Amend the last commit instead of creating new
 *   --all, -a        Stage all changes before commit
 *   --dry-run        Preview what would happen without making changes
 *   --help, -h       Show this help
 */

const { execSync } = require("child_process");
const fs = require("fs");
const {
  colors,
  banner: drawBanner,
  drawBox,
  success: logSuccessMsg,
  warn: logWarnMsg,
  error: logErrorMsg,
  info: logInfoMsg,
  step: logStep,
  Spinner: SharedSpinner,
  confirm: sharedConfirm,
  prompt: sharedPrompt,
  select: sharedSelect,
  IS_WINDOWS,
} = require("./lib/ui.cjs");

const CHANGELOG_FILE = "CHANGELOG.md";

// ============================================================================
// Cross-Platform Shell Utilities
// ============================================================================

/**
 * Escape a string for safe use in shell commands
 * Handles differences between Windows cmd.exe and Unix shells
 * 
 * Security: Rejects control characters and uses the safest escaping patterns
 */
function shellEscape(str) {
  // Security: Reject null bytes and other dangerous control characters
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(str)) {
    throw new Error("Invalid control characters in input - potential injection attempt");
  }
  
  // Also reject newlines in shell arguments (could break command structure)
  if (/[\r\n]/.test(str)) {
    throw new Error("Newlines not allowed in shell arguments");
  }

  if (IS_WINDOWS) {
    // Windows: escape special characters for cmd.exe
    // Double quotes are the safest way to quote on Windows
    // Also escape ! (delayed expansion) and ^ (escape char)
    return `"${str.replace(/"/g, '""').replace(/%/g, "%%").replace(/!/g, "^!").replace(/\^/g, "^^")}"`;
  } else {
    // Unix: Single quotes are the safest - they preserve EVERYTHING except single quotes
    // This handles $, `, !, newlines, etc. without any interpretation
    // For strings with single quotes, we close the single quote, add an escaped single quote, reopen
    return "'" + str.replace(/'/g, "'\"'\"'") + "'";
  }
}

/**
 * Escape a string for use in git commit messages
 * Git is generally consistent across platforms when using -m
 * 
 * Security: Comprehensive escaping to prevent command injection
 */
function escapeCommitMessage(msg) {
  // Security: Reject null bytes (could truncate the message maliciously)
  if (msg.includes("\x00")) {
    throw new Error("Null bytes not allowed in commit messages");
  }
  
  if (IS_WINDOWS) {
    // Windows cmd.exe: escape backslashes FIRST, then double quotes, percent signs, and carets
    // Order is critical: backslash must be escaped first to avoid double-escaping other escapes
    return msg
      .replace(/\\/g, "\\\\")
      .replace(/"/g, "\\\"")
      .replace(/%/g, "%%")
      .replace(/\^/g, "^^");
  } else {
    // Unix: escape double quotes, backticks, dollar signs, and backslashes
    // This prevents command substitution ($() and ``) and variable expansion
    return msg
      .replace(/\\/g, "\\\\")
      .replace(/"/g, "\\\"")
      .replace(/\$/g, "\\$")
      .replace(/`/g, "\\`")
      .replace(/!/g, "\\!");  // bash history expansion
  }
}

// Parse CLI arguments
const args = process.argv.slice(2);
const flags = {
  help: args.includes("--help") || args.includes("-h"),
  noCommit: args.includes("--no-commit"),
  noChangelog: args.includes("--no-changelog"),
  push: args.includes("--push") || args.includes("-p"),
  amend: args.includes("--amend"),
  stageAll: args.includes("--all") || args.includes("-a"),
  dryRun: args.includes("--dry-run"),
  breaking: args.includes("--breaking") || args.includes("-b"),
  generate: args.includes("--generate") || args.includes("-g"),
};

// Extract --type value
let changeType = null;
const typeIndex = args.findIndex((a) => a === "--type" || a === "-t");
if (typeIndex !== -1 && args[typeIndex + 1]) {
  changeType = args[typeIndex + 1];
}

// Extract --message value
let messageFromArgs = null;
const msgIndex = args.findIndex((a) => a === "--message" || a === "-m");
if (msgIndex !== -1 && args[msgIndex + 1]) {
  messageFromArgs = args[msgIndex + 1];
}

// Extract --scope value
let scopeFromArgs = null;
const scopeIndex = args.findIndex((a) => a === "--scope" || a === "-s");
if (scopeIndex !== -1 && args[scopeIndex + 1]) {
  scopeFromArgs = args[scopeIndex + 1].trim();
  if (scopeFromArgs.startsWith("(") && scopeFromArgs.endsWith(")")) {
    scopeFromArgs = scopeFromArgs.slice(1, -1);
  }
  scopeFromArgs = scopeFromArgs.replace(/[\s]+/g, "-");
}

// Extract --changelog-message value (optional separate message for changelog)
let changelogMsgFromArgs = null;
const clMsgIndex = args.findIndex((a) => a === "--changelog-message" || a === "-c");
if (clMsgIndex !== -1 && args[clMsgIndex + 1]) {
  changelogMsgFromArgs = args[clMsgIndex + 1];
}

// Change type definitions
const CHANGE_TYPES = {
  feat: { emoji: "✨", label: "Features", description: "A new feature" },
  fix: { emoji: "🐛", label: "Bug Fixes", description: "A bug fix" },
  docs: { emoji: "📝", label: "Documentation", description: "Documentation only changes" },
  refactor: {
    emoji: "♻️",
    label: "Refactoring",
    description: "Code change that neither fixes a bug nor adds a feature",
  },
  perf: {
    emoji: "⚡",
    label: "Performance",
    description: "A code change that improves performance",
  },
  test: { emoji: "✅", label: "Tests", description: "Adding or updating tests" },
  chore: {
    emoji: "🔧",
    label: "Chores",
    description: "Changes to build process or auxiliary tools",
  },
  breaking: { emoji: "💥", label: "Breaking Changes", description: "A breaking change to the API" },
  security: { emoji: "🔒", label: "Security", description: "A security fix or improvement" },
};

function log(msg, color = "") {
  console.log(color ? `${color}${msg}${colors.reset}` : msg);
}

function logSuccess(msg) {
  logSuccessMsg(msg);
}

function logError(msg) {
  logErrorMsg(msg);
}

function logWarning(msg) {
  logWarnMsg(msg);
}

function logInfo(msg) {
  logInfoMsg(msg);
}

function showHelp() {
  drawBanner("Smart Commit Tool", "Git commits + changelog in one workflow");

  drawBox(
    "Usage",
    [
      "npm run commit                              Full interactive mode",
      "npm run commit -- -t feat                   Specify change type upfront",
      "npm run commit -- --push                    Auto-push after commit",
      "npm run commit -- --dry-run                 Preview without changes",
    ],
    { color: colors.cyan },
  );

  drawBox(
    "Workflow Flags",
    [
      "--type, -t <type>   Change type (feat, fix, docs, refactor, etc.)",
      "--scope, -s <name>  Set commit scope (e.g., api, ui)",
      "--breaking, -b      Mark this commit as breaking (adds !)",
      "--message, -m       Commit message (skips prompt)",
      "--changelog-message, -c  Separate changelog message",
      "--generate, -g      Auto-generate messages from diff",
      "--no-commit         Skip git commit (only changelog)",
      "--no-changelog      Skip changelog (only commit)",
      "--push, -p          Push to remote after commit",
      "--amend             Amend last commit",
      "--all, -a           Stage all changes first",
      "--dry-run           Preview without changes",
    ],
    { color: colors.magenta },
  );

  drawBox(
    "Examples",
    [
      'npm run commit -- -t feat -m "add login" --push',
      'npm run commit -- -t fix -m "bug" -c "Fixed auth timeout"',
      'npm run commit -- --dry-run -t feat -m "test"',
    ],
    { color: colors.yellow },
  );

  log(`\n${colors.dim}Made with 💜 by the_collective${colors.reset}\n`);
  process.exit(0);
}

if (flags.help) {
  showHelp();
}

// Use shared Spinner from lib/ui
const Spinner = SharedSpinner;

/**
 * Get list of changed files (staged + unstaged)
 */
function getChangedFiles() {
  try {
    // Get staged files
    const staged = execSync("git diff --cached --name-only", { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);

    // Get unstaged files
    const unstaged = execSync("git diff --name-only", { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);

    // Get untracked files
    const untracked = execSync("git ls-files --others --exclude-standard", { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);

    return {
      staged,
      unstaged,
      untracked,
      all: [...new Set([...staged, ...unstaged, ...untracked])],
    };
  } catch {
    return { staged: [], unstaged: [], untracked: [], all: [] };
  }
}

/**
 * Get staged files only
 */
function getStagedFiles() {
  try {
    return execSync("git diff --cached --name-only", { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Check if we're in a git repository
 */
function isGitRepo() {
  try {
    execSync("git rev-parse --git-dir", { encoding: "utf8", stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Stage files for commit
 */
function stageFiles(files) {
  try {
    if (files === "all") {
      execSync("git add -A", { encoding: "utf8" });
    } else if (Array.isArray(files) && files.length > 0) {
      // Stage files one at a time for better cross-platform compatibility
      for (const file of files) {
        execSync(`git add ${shellEscape(file)}`, { encoding: "utf8" });
      }
    }
    return true;
  } catch (_err) {
    return false;
  }
}

/**
 * Create a git commit
 */
function createCommit(message, amend = false) {
  try {
    const amendFlag = amend ? "--amend " : "";
    const escapedMsg = escapeCommitMessage(message);
    execSync(`git commit ${amendFlag}-m "${escapedMsg}"`, { encoding: "utf8" });
    return true;
  } catch (_err) {
    return false;
  }
}

/**
 * Push to remote
 * Security: Branch name is escaped to prevent command injection
 */
function pushToRemote() {
  try {
    execSync("git push", { encoding: "utf8" });
    return { success: true };
  } catch (_err) {
    // Try to push with upstream tracking
    try {
      const branch = getCurrentBranch();
      execSync(`git push -u origin ${shellEscape(branch)}`, { encoding: "utf8" });
      return { success: true };
    } catch (err2) {
      return { success: false, error: err2.message };
    }
  }
}

/**
 * Get the last commit message
 */
function getLastCommitMessage() {
  try {
    return execSync("git log -1 --pretty=%B", { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

/**
 * Auto-detect change type based on file paths
 */
function detectChangeType(files) {
  const fileList = Array.isArray(files) ? files : files.all || [];
  const patterns = {
    docs: [/\.md$/i, /^docs\//, /readme/i, /license/i],
    test: [/\.test\.[jt]sx?$/, /\.spec\.[jt]sx?$/, /^tests?\//, /__tests__/],
    feat: [/^src\//, /^lib\//, /\.tsx?$/, /\.jsx?$/],
    fix: [], // Can't really auto-detect fixes
    refactor: [],
    perf: [],
    chore: [/package\.json$/, /\.config\.[jt]s$/, /eslint/, /tsconfig/],
  };

  const scores = { docs: 0, test: 0, feat: 0, chore: 0 };

  for (const file of fileList) {
    for (const [type, regexes] of Object.entries(patterns)) {
      if (regexes.some((r) => r.test(file))) {
        scores[type] = (scores[type] || 0) + 1;
      }
    }
  }

  // Find highest score
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (sorted[0] && sorted[0][1] > 0) {
    return sorted[0][0];
  }

  return "chore"; // Default
}

/**
 * Get the diff summary for staged files
 */
function getDiffSummary() {
  try {
    // Get stat summary
    const stat = execSync("git diff --cached --stat", { encoding: "utf8" }).trim();
    // Get actual diff (limited to avoid huge outputs)
    const diff = execSync("git diff --cached -U3", { encoding: "utf8", maxBuffer: 1024 * 1024 });
    return { stat, diff };
  } catch {
    return { stat: "", diff: "" };
  }
}

/**
 * Analyze diff and generate commit/changelog messages
 * Returns { commitMessage, changelogMessage, detectedType }
 */
function generateMessagesFromDiff(files, existingType = null) {
  const fileList = Array.isArray(files) ? files : files.staged || files.all || [];
  const { stat, diff } = getDiffSummary();

  // Detect the change type if not provided
  const changeType = existingType || detectChangeType(files);

  // Analyze what changed
  const analysis = {
    filesChanged: fileList.length,
    additions: 0,
    deletions: 0,
    renamedFiles: [],
    newFiles: [],
    deletedFiles: [],
    modifiedFiles: [],
    categories: new Set(),
  };

  // Parse stat line for additions/deletions
  const statMatch = stat.match(/(\d+) insertions?\(\+\).*?(\d+) deletions?\(-\)/);
  if (statMatch) {
    analysis.additions = parseInt(statMatch[1], 10);
    analysis.deletions = parseInt(statMatch[2], 10);
  }

  // Categorize files
  for (const file of fileList) {
    // Check if file is new, deleted, or modified
    try {
      const status = execSync(`git status --porcelain ${shellEscape(file)}`, { encoding: "utf8" }).trim();
      if (status.startsWith("A")) {
        analysis.newFiles.push(file);
      } else if (status.startsWith("D")) {
        analysis.deletedFiles.push(file);
      } else if (status.startsWith("R")) {
        analysis.renamedFiles.push(file);
      } else {
        analysis.modifiedFiles.push(file);
      }
    } catch {
      analysis.modifiedFiles.push(file);
    }

    // Categorize by file type/location
    if (file.includes("test") || file.includes("spec")) {
      analysis.categories.add("tests");
    }
    if (file.endsWith(".md")) {
      analysis.categories.add("docs");
    }
    if (file.includes("config") || file.endsWith(".json")) {
      analysis.categories.add("config");
    }
    if (file.startsWith("src/") || file.startsWith("lib/")) {
      analysis.categories.add("source");
    }
    if (file.startsWith(".github/")) {
      analysis.categories.add("github");
    }
    if (file.startsWith("scripts/")) {
      analysis.categories.add("scripts");
    }
  }

  // Generate messages based on analysis
  let commitMessage = "";
  let changelogMessage = "";

  // Determine primary action
  if (
    analysis.deletedFiles.length > 0 &&
    analysis.newFiles.length === 0 &&
    analysis.modifiedFiles.length === 0
  ) {
    // Pure deletion
    const deletedNames = analysis.deletedFiles.map((f) => f.split("/").pop()).slice(0, 3);
    commitMessage = `remove ${deletedNames.join(", ")}${analysis.deletedFiles.length > 3 ? ` and ${analysis.deletedFiles.length - 3} more` : ""}`;
    changelogMessage = `Removed ${analysis.deletedFiles.length} file(s)`;
  } else if (
    analysis.newFiles.length > 0 &&
    analysis.modifiedFiles.length === 0 &&
    analysis.deletedFiles.length === 0
  ) {
    // Pure addition
    const newNames = analysis.newFiles.map((f) => f.split("/").pop()).slice(0, 3);
    commitMessage = `add ${newNames.join(", ")}${analysis.newFiles.length > 3 ? ` and ${analysis.newFiles.length - 3} more` : ""}`;
    changelogMessage = `Added ${analysis.newFiles.length} new file(s)`;
  } else if (analysis.renamedFiles.length > 0 && analysis.renamedFiles.length === fileList.length) {
    // Pure rename
    commitMessage = `rename ${analysis.renamedFiles.length} file(s)`;
    changelogMessage = `Renamed ${analysis.renamedFiles.length} file(s)`;
  } else {
    // Mixed changes - try to summarize
    const parts = [];

    // Look for common patterns in the diff
    const diffLower = diff.toLowerCase();

    if (diffLower.includes("fix") || diffLower.includes("bug")) {
      parts.push("fix issues");
    }
    if (analysis.categories.has("docs")) {
      parts.push("update documentation");
    }
    if (analysis.categories.has("config")) {
      parts.push("update configuration");
    }
    if (analysis.categories.has("tests")) {
      parts.push("update tests");
    }

    if (parts.length > 0) {
      commitMessage = parts.join(", ");
    } else {
      // Generic message based on file count
      if (fileList.length === 1) {
        const fileName = fileList[0].split("/").pop();
        commitMessage = `update ${fileName}`;
      } else {
        // Try to find common directory
        const dirs = fileList.map((f) => f.split("/")[0]);
        const uniqueDirs = [...new Set(dirs)];
        if (uniqueDirs.length === 1 && uniqueDirs[0] !== fileList[0]) {
          commitMessage = `update ${uniqueDirs[0]}`;
        } else {
          commitMessage = `update ${fileList.length} files`;
        }
      }
    }

    // Changelog is more descriptive
    const changeItems = [];
    if (analysis.newFiles.length > 0) {
      changeItems.push(`${analysis.newFiles.length} added`);
    }
    if (analysis.modifiedFiles.length > 0) {
      changeItems.push(`${analysis.modifiedFiles.length} modified`);
    }
    if (analysis.deletedFiles.length > 0) {
      changeItems.push(`${analysis.deletedFiles.length} removed`);
    }

    changelogMessage =
      changeItems.length > 0
        ? `Updated files (${changeItems.join(", ")})`
        : `Updated ${fileList.length} file(s)`;
  }

  // Make changelog more user-friendly
  if (analysis.categories.size > 0) {
    const categoryList = [...analysis.categories].join(", ");
    changelogMessage = `${changelogMessage} in ${categoryList}`;
  }

  return {
    commitMessage,
    changelogMessage: changelogMessage.charAt(0).toUpperCase() + changelogMessage.slice(1),
    detectedType: changeType,
    analysis,
  };
}

/**
 * Parse conventional commit prefix from message
 */
function parseConventionalCommit(message) {
  const match = message.match(
    /^(feat|fix|docs|refactor|perf|test|chore|breaking|security)(\(([^)]+)\))?(!)?:\s*/i,
  );
  if (match) {
    return {
      type: match[1].toLowerCase(),
      scope: match[3] ? match[3].trim() : null,
      breaking: Boolean(match[4]),
      message: message.slice(match[0].length),
    };
  }
  return { type: null, scope: null, breaking: false, message };
}

/**
 * Get current git branch
 */
function getCurrentBranch() {
  try {
    return execSync("git branch --show-current", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

/**
 * Get list of local branches
 */
function getLocalBranches() {
  try {
    // Use --format without quotes for cross-platform compatibility
    const output = execSync("git branch --format=%(refname:short)", { encoding: "utf8" });
    return output
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Switch to a different branch
 */
function switchBranch(branchName) {
  try {
    execSync(`git checkout ${shellEscape(branchName)}`, { encoding: "utf8", stdio: "pipe" });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Create and switch to a new branch
 */
function createBranch(branchName) {
  try {
    execSync(`git checkout -b ${shellEscape(branchName)}`, { encoding: "utf8", stdio: "pipe" });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Get short commit hash of HEAD
 */
function getHeadCommit() {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "uncommitted";
  }
}

/**
 * Initialize CHANGELOG.md if it doesn't exist
 */
function initChangelog() {
  if (!fs.existsSync(CHANGELOG_FILE)) {
    const header = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

`;
    fs.writeFileSync(CHANGELOG_FILE, header);
    log(`✅ Created ${CHANGELOG_FILE}`, colors.green);
  }
}

/**
 * Append entry to changelog
 */
function appendToChangelog(entry) {
  initChangelog();

  const content = fs.readFileSync(CHANGELOG_FILE, "utf8");

  // Find where to insert (after the header, before first entry)
  const headerEnd = content.indexOf("---\n");
  if (headerEnd === -1) {
    // No header found, just prepend after first line
    const lines = content.split("\n");
    const newContent = lines[0] + "\n\n" + entry + "\n" + lines.slice(1).join("\n");
    fs.writeFileSync(CHANGELOG_FILE, newContent);
  } else {
    // Insert after header
    const before = content.slice(0, headerEnd + 4);
    const after = content.slice(headerEnd + 4);
    fs.writeFileSync(CHANGELOG_FILE, before + "\n" + entry + "\n" + after);
  }
}

/**
 * Format changelog entry
 */
function formatEntry(type, message, files) {
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const time = now.toTimeString().split(" ")[0].slice(0, 5);
  const branch = getCurrentBranch();
  const commit = getHeadCommit();

  const typeInfo = CHANGE_TYPES[type] || CHANGE_TYPES.chore;
  const fileList = Array.isArray(files) ? files : files.all || [];

  let entry = `## ${typeInfo.emoji} ${message}\n`;
  entry += `> ${date} ${time} · \`${branch}\` · ${commit}\n\n`;

  if (fileList.length > 0 && fileList.length <= 10) {
    entry += "**Changed files:**\n";
    fileList.forEach((f) => {
      entry += `- \`${f}\`\n`;
    });
    entry += "\n";
  } else if (fileList.length > 10) {
    entry += `**${fileList.length} files changed**\n\n`;
  }

  return entry;
}

// Use shared prompt and confirm from lib/ui
const prompt = sharedPrompt;
const confirm = sharedConfirm;

/**
 * Prompt for change type selection
 */
async function promptChangeType(detectedType) {
  log(`\n${colors.cyan}Select change type:${colors.reset}\n`);

  const types = Object.entries(CHANGE_TYPES);
  types.forEach(([key, value], index) => {
    const isDefault = key === detectedType;
    const marker = isDefault ? `${colors.green}→${colors.reset}` : " ";
    const defaultLabel = isDefault ? ` ${colors.dim}(detected)${colors.reset}` : "";
    log(
      `  ${marker} ${colors.bold}${index + 1}.${colors.reset} ${value.emoji} ${key}${defaultLabel}`,
    );
    log(`     ${colors.dim}${value.description}${colors.reset}`);
  });

  log(`\n${colors.dim}Enter a number, type name, or edit the detected type below${colors.reset}`);
  const answer = await prompt(
    `${colors.yellow}Change type:${colors.reset}`,
    detectedType,
    true, // prefill = true, so user can edit
  );

  // Check if it's a number
  const num = parseInt(answer, 10);
  if (num >= 1 && num <= types.length) {
    return types[num - 1][0];
  }

  // Check if it's a valid type name
  if (CHANGE_TYPES[answer.toLowerCase()]) {
    return answer.toLowerCase();
  }

  return detectedType;
}

/**
 * Display a summary section
 */
function displaySummary(title, items) {
  log(`\n   ${colors.bold}${title}${colors.reset}`);
  log(`   ${colors.dim}${"-".repeat(40)}${colors.reset}`);

  items.forEach((item) => {
    log(`   ${item}`);
  });
  log();
}

function formatFileSample(list, limit = 3) {
  if (!Array.isArray(list) || list.length === 0) {
    return "";
  }

  const shown = list.slice(0, limit);
  const remaining = list.length - shown.length;
  const fragment = shown.join(", ");
  return remaining > 0 ? `${fragment}, +${remaining} more` : fragment;
}

/**
 * Main workflow
 */
async function main() {
  // Header
  drawBanner("Smart Commit Tool", "Git + Changelog workflow");

  // Check if we're in a git repo
  if (!isGitRepo()) {
    logError("Not a git repository. Please run this from within a git repo.");
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 0: Branch selection (interactive mode only)
  // ═══════════════════════════════════════════════════════════
  let currentBranch = getCurrentBranch();

  // Only ask about branch in interactive mode (no message provided via args)
  if (!messageFromArgs && !flags.dryRun && !flags.amend) {
    log(
      `\n${colors.cyan}Current branch:${colors.reset} ${colors.bold}${currentBranch}${colors.reset}`,
    );

    const continueBranch = await confirm(
      `${colors.yellow}Continue on this branch?${colors.reset}`,
      null, // null = require explicit y/n, no default
    );

    if (!continueBranch) {
      const branches = getLocalBranches();
      const otherBranches = branches.filter((b) => b !== currentBranch);

      if (otherBranches.length === 0) {
        // No other branches - offer to create one
        log("");
        logInfo("No other branches found.");
        const newBranchName = await prompt(`${colors.yellow}Create new branch:${colors.reset}`, "");

        if (newBranchName && newBranchName.trim()) {
          const result = createBranch(newBranchName.trim());
          if (result.success) {
            currentBranch = newBranchName.trim();
            logSuccess(`Created and switched to branch: ${currentBranch}`);
          } else {
            logError(`Failed to create branch: ${result.error}`);
            process.exit(1);
          }
        } else {
          logInfo("Continuing on current branch.");
        }
      } else {
        // Show branch selection
        const branchOptions = [
          ...otherBranches.map((b) => ({ label: b, value: b })),
          { label: "Create new branch...", value: "__new__" },
        ];

        const selectedIndex = await sharedSelect("Select branch:", branchOptions, 0);
        const selected = branchOptions[selectedIndex];

        if (selected.value === "__new__") {
          const newBranchName = await prompt(
            `\n${colors.yellow}New branch name:${colors.reset}`,
            "",
          );

          if (newBranchName && newBranchName.trim()) {
            const result = createBranch(newBranchName.trim());
            if (result.success) {
              currentBranch = newBranchName.trim();
              logSuccess(`Created and switched to branch: ${currentBranch}`);
            } else {
              logError(`Failed to create branch: ${result.error}`);
              process.exit(1);
            }
          } else {
            logInfo("Continuing on current branch.");
          }
        } else {
          const result = switchBranch(selected.value);
          if (result.success) {
            currentBranch = selected.value;
            logSuccess(`Switched to branch: ${currentBranch}`);
          } else {
            logError(`Failed to switch branch: ${result.error}`);
            process.exit(1);
          }
        }
      }
    }

    log(""); // spacing
  }

  // Get changed files (after potential branch switch)
  const files = getChangedFiles();
  const totalChanges = files.all.length;

  // ═══════════════════════════════════════════════════════════
  // STEP 1: Analyze current state
  // ═══════════════════════════════════════════════════════════
  logStep(1, 5, "Analyzing workspace...");

  if (totalChanges === 0 && !flags.amend) {
    logWarning("No changes detected in the workspace.");

    if (flags.noCommit) {
      // Just add a changelog entry manually
      logInfo("You can still add a changelog entry manually.");
    } else {
      logInfo("Make some changes first, or use --amend to modify the last commit.");
      process.exit(0);
    }
  }

  // Show file status
  if (files.staged.length > 0) {
    logSuccess(`${files.staged.length} file(s) staged for commit`);
    files.staged.slice(0, 3).forEach((f) => log(`   ${colors.green}+${colors.reset} ${f}`));
    if (files.staged.length > 3) {
      log(`   ${colors.dim}... and ${files.staged.length - 3} more${colors.reset}`);
    }
  }

  if (files.unstaged.length > 0) {
    logWarning(`${files.unstaged.length} file(s) modified but not staged`);
    files.unstaged.slice(0, 3).forEach((f) => log(`   ${colors.yellow}~${colors.reset} ${f}`));
    if (files.unstaged.length > 3) {
      log(`   ${colors.dim}... and ${files.unstaged.length - 3} more${colors.reset}`);
    }
  }

  if (files.untracked.length > 0) {
    logInfo(`${files.untracked.length} untracked file(s)`);
    files.untracked.slice(0, 3).forEach((f) => log(`   ${colors.dim}?${colors.reset} ${f}`));
    if (files.untracked.length > 3) {
      log(`   ${colors.dim}... and ${files.untracked.length - 3} more${colors.reset}`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 2: Stage files if needed
  // ═══════════════════════════════════════════════════════════
  if (!flags.noCommit && files.staged.length === 0 && totalChanges > 0) {
    logStep(2, 5, "Staging files...");

    if (flags.stageAll || flags.dryRun) {
      if (!flags.dryRun) {
        stageFiles("all");
      }
      logSuccess(flags.dryRun ? "Would stage all changes" : "Staged all changes");
    } else {
      const shouldStageAll = await confirm(
        `${colors.yellow}No files staged. Stage all changes?${colors.reset}`,
        null, // require explicit y/n
      );
      if (shouldStageAll) {
        stageFiles("all");
        logSuccess("Staged all changes");
      } else {
        logInfo("Please stage files manually with 'git add' and try again.");
        process.exit(0);
      }
    }

    // Refresh staged files (or simulate for dry-run)
    if (!flags.dryRun) {
      files.staged = getStagedFiles();
    } else {
      files.staged = files.all;
    }
  } else if (flags.noCommit) {
    logStep(2, 5, "Skipping staging (--no-commit mode)");
  } else {
    logStep(2, 5, "Files already staged ✓");
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 3: Get change type
  // ═══════════════════════════════════════════════════════════
  logStep(3, 5, "Determining change type...");

  const detectedType = detectChangeType(files);

  // If no type specified and in non-interactive mode, use detected type
  if (!changeType) {
    if (flags.dryRun || messageFromArgs) {
      // Non-interactive: use detected type
      changeType = detectedType;
      logInfo(`Auto-detected type: ${changeType}`);
    } else {
      // Interactive: prompt for type
      changeType = await promptChangeType(detectedType);
    }
  }

  const typeInfo = CHANGE_TYPES[changeType] || CHANGE_TYPES.chore;
  logSuccess(`Using type: ${typeInfo.emoji} ${changeType}`);

  // ═══════════════════════════════════════════════════════════
  // STEP 4: Get messages
  // ═══════════════════════════════════════════════════════════
  logStep(4, 5, "Composing messages...");

  let commitMessage = "";
  let changelogMessage = "";
  let generatedMessages = null;

  // Pre-generate if flag was passed
  if (flags.generate && !messageFromArgs) {
    logInfo("Analyzing changes to generate messages...");
    generatedMessages = generateMessagesFromDiff(files, changeType);

    if (generatedMessages.commitMessage) {
      logSuccess(`Generated commit: "${generatedMessages.commitMessage}"`);
      logSuccess(`Generated changelog: "${generatedMessages.changelogMessage}"`);

      // Show analysis summary
      const { analysis } = generatedMessages;
      if (analysis.additions > 0 || analysis.deletions > 0) {
        logInfo(
          `${colors.dim}(+${analysis.additions} / -${analysis.deletions} lines across ${analysis.filesChanged} files)${colors.reset}`,
        );
      }
    }
  }

  /**
   * Helper to check if user wants auto-generation
   */
  function wantsAutoGenerate(input) {
    const normalized = input.trim().toLowerCase();
    return (
      normalized === "auto" || normalized === "a" || normalized === "generate" || normalized === "g"
    );
  }

  /**
   * Generate messages on demand (lazy generation)
   */
  function ensureGenerated() {
    if (!generatedMessages) {
      logInfo("Analyzing changes to generate messages...");
      generatedMessages = generateMessagesFromDiff(files, changeType);

      if (generatedMessages.commitMessage) {
        logSuccess(`Generated commit: "${generatedMessages.commitMessage}"`);
        logSuccess(`Generated changelog: "${generatedMessages.changelogMessage}"`);

        const { analysis } = generatedMessages;
        if (analysis.additions > 0 || analysis.deletions > 0) {
          logInfo(
            `${colors.dim}(+${analysis.additions} / -${analysis.deletions} lines across ${analysis.filesChanged} files)${colors.reset}`,
          );
        }
      }
    }
    return generatedMessages;
  }

  if (flags.amend) {
    const lastMessage = getLastCommitMessage();
    logInfo(`Last commit: "${lastMessage}"`);
    if (messageFromArgs) {
      commitMessage = messageFromArgs;
    } else if (flags.dryRun) {
      commitMessage = lastMessage; // Use existing message for dry-run preview
    } else {
      commitMessage = await prompt(
        `\n${colors.yellow}New commit message:${colors.reset}`,
        lastMessage,
      );
    }
  } else if (!flags.noCommit) {
    if (messageFromArgs) {
      commitMessage = messageFromArgs;
      logSuccess(`Using message: "${commitMessage}"`);
    } else if (flags.dryRun) {
      commitMessage = generatedMessages?.commitMessage || "<would prompt for message>";
      logInfo(
        generatedMessages
          ? `Would use generated message: "${commitMessage}"`
          : "Would prompt for commit message (use -m to specify)",
      );
    } else {
      // Interactive prompt with auto-generate hint
      log(`\n${colors.dim}Tip: Type "auto" to generate a message from your changes${colors.reset}`);
      const defaultMsg = generatedMessages?.commitMessage || "";
      let rawInput = await prompt(
        `${colors.yellow}Enter commit message:${colors.reset}`,
        defaultMsg,
      );

      // Check if user wants auto-generation
      if (wantsAutoGenerate(rawInput)) {
        ensureGenerated();
        // Now prompt again with generated message pre-filled so user can edit it
        log(`${colors.dim}Edit the message below or press Enter to accept:${colors.reset}`);
        rawInput = await prompt(
          `${colors.yellow}Commit message:${colors.reset}`,
          generatedMessages?.commitMessage || "",
          true, // prefill = true, so user can edit
        );
      }

      commitMessage = rawInput;
    }
  }

  if (!commitMessage && !flags.noCommit && !flags.dryRun) {
    logError("Commit message is required.");
    process.exit(1);
  }

  // Parse conventional commit from message if present
  const parsed = parseConventionalCommit(commitMessage);
  if (parsed.type && !args.some((a) => a === "--type" || a === "-t")) {
    changeType = parsed.type;
  }

  const finalScope = scopeFromArgs || parsed.scope || null;
  const isBreakingChange = Boolean(flags.breaking || parsed.breaking);

  if (scopeFromArgs) {
    logSuccess(`Using scope: (${scopeFromArgs})`);
  } else if (parsed.scope) {
    logInfo(`Detected scope from message: (${parsed.scope})`);
  }

  if (flags.breaking && !parsed.breaking) {
    logWarning("Marked as breaking change (!)");
  }

  const hasConventionalPrefix = Boolean(parsed.type);
  const commitBody = (hasConventionalPrefix ? parsed.message : commitMessage).trim();
  const shouldRebuildPrefix =
    !hasConventionalPrefix || Boolean(scopeFromArgs) || (flags.breaking && !parsed.breaking);
  const prefixType = changeType || parsed.type || "chore";

  const formattedCommitMessage = flags.noCommit
    ? ""
    : shouldRebuildPrefix
      ? `${prefixType}${finalScope ? `(${finalScope})` : ""}${isBreakingChange ? "!" : ""}: ${commitBody}`
      : commitMessage;

  // Ask for changelog message
  if (!flags.noChangelog) {
    if (changelogMsgFromArgs) {
      changelogMessage = changelogMsgFromArgs;
      logSuccess(`Using changelog message: "${changelogMessage}"`);
    } else if (messageFromArgs) {
      // If commit message provided but no changelog message, use commit message
      changelogMessage = parsed.message || messageFromArgs;
      logInfo(`Changelog will use: "${changelogMessage}"`);
    } else if (flags.dryRun) {
      changelogMessage =
        generatedMessages?.changelogMessage ||
        parsed.message ||
        commitMessage ||
        "<would prompt for message>";
      logInfo(
        generatedMessages
          ? `Would use generated changelog: "${changelogMessage}"`
          : "Would prompt for changelog message (use -c to specify)",
      );
    } else {
      log("");
      logInfo("The changelog message can be different from the commit message.");
      logInfo("It should be user-friendly and describe what changed.");
      log(
        `${colors.dim}Tip: Type "auto" to generate, or edit the pre-filled message below${colors.reset}`,
      );

      // Default: prefer generated > parsed > commit message
      const defaultChangelog =
        generatedMessages?.changelogMessage || parsed.message || commitMessage;
      let rawChangelog = await prompt(
        `${colors.yellow}Changelog message:${colors.reset}`,
        defaultChangelog,
        true, // prefill = true, so user can edit the default
      );

      // Check if user wants auto-generation
      if (wantsAutoGenerate(rawChangelog)) {
        ensureGenerated();
        // Now prompt again with generated message pre-filled so user can edit it
        log(`${colors.dim}Edit the message below or press Enter to accept:${colors.reset}`);
        rawChangelog = await prompt(
          `${colors.yellow}Changelog message:${colors.reset}`,
          generatedMessages?.changelogMessage || commitMessage,
          true, // prefill = true, so user can edit
        );
      }

      changelogMessage = rawChangelog;

      if (!changelogMessage) {
        logError("Changelog message is required (or use --no-changelog to skip).");
        process.exit(1);
      }
    }

    // Capitalize first letter
    if (changelogMessage && !changelogMessage.startsWith("<")) {
      changelogMessage = changelogMessage.charAt(0).toUpperCase() + changelogMessage.slice(1);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 5: Preview & Confirm
  // ═══════════════════════════════════════════════════════════
  logStep(5, 5, "Preview...");

  const previewFiles = flags.dryRun ? files : getChangedFiles();
  const stagedSample = formatFileSample(previewFiles.staged);
  const pendingSample = formatFileSample([...previewFiles.unstaged, ...previewFiles.untracked]);
  const previewBranch = getCurrentBranch();

  const summaryItems = [];

  // Always show branch first
  summaryItems.push(`${colors.cyan}Branch:${colors.reset} ${previewBranch}`);

  if (!flags.noCommit) {
    summaryItems.push(`${colors.cyan}Commit:${colors.reset} ${formattedCommitMessage}`);
    summaryItems.push(
      `${colors.cyan}Staged:${colors.reset} ${previewFiles.staged.length} file(s)` +
        (stagedSample ? ` ${colors.dim}[${stagedSample}]${colors.reset}` : ""),
    );
    if (finalScope) {
      summaryItems.push(`${colors.cyan}Scope:${colors.reset} (${finalScope})`);
    }
    if (isBreakingChange) {
      summaryItems.push(`${colors.red}Breaking:${colors.reset} Yes`);
    }
    if (previewFiles.unstaged.length > 0 || previewFiles.untracked.length > 0) {
      summaryItems.push(
        `${colors.yellow}Pending:${colors.reset} ${previewFiles.unstaged.length} modified, ${previewFiles.untracked.length} untracked` +
          (pendingSample ? ` ${colors.dim}[${pendingSample}]${colors.reset}` : ""),
      );
    }
  }

  if (!flags.noChangelog) {
    summaryItems.push(
      `${colors.cyan}Changelog:${colors.reset} ${typeInfo.emoji} ${changelogMessage}`,
    );
  }

  if (flags.push) {
    summaryItems.push(`${colors.cyan}Push:${colors.reset} Yes, to origin/${previewBranch}`);
  }

  if (flags.amend) {
    summaryItems.push(`${colors.yellow}Mode:${colors.reset} Amending last commit`);
  }

  displaySummary("Summary", summaryItems);

  if (flags.dryRun) {
    log(`\n${colors.yellow}${colors.bold}DRY RUN - No changes will be made${colors.reset}\n`);
    process.exit(0);
  }

  const proceed = await confirm(
    `\n${colors.yellow}Proceed with these changes?${colors.reset}`,
    null, // require explicit y/n
  );

  if (!proceed) {
    log(`\n${colors.dim}Aborted.${colors.reset}\n`);
    process.exit(0);
  }

  // ═══════════════════════════════════════════════════════════
  // Post-confirmation: Ask about push if not already specified
  // ═══════════════════════════════════════════════════════════
  let shouldPush = flags.push;
  // Use the branch from earlier or get it fresh
  const finalBranch = currentBranch || getCurrentBranch();

  if (!flags.push && !flags.noCommit) {
    log("");
    shouldPush = await confirm(
      `${colors.yellow}Push to remote after commit?${colors.reset} ${colors.dim}(branch: ${finalBranch})${colors.reset}`,
      null, // require explicit y/n
    );
  }

  // ═══════════════════════════════════════════════════════════
  // Execute changes
  // ═══════════════════════════════════════════════════════════
  log("");

  // Update changelog first (so it's included in the commit)
  if (!flags.noChangelog) {
    const spinner = new Spinner("Updating changelog...");
    spinner.start();

    const entry = formatEntry(changeType, changelogMessage, files);
    appendToChangelog(entry);

    // Stage the changelog
    if (!flags.noCommit) {
      stageFiles([CHANGELOG_FILE]);
    }

    spinner.stop(true, `Updated ${CHANGELOG_FILE}`);
  }

  // Create commit
  if (!flags.noCommit) {
    const spinner = new Spinner(flags.amend ? "Amending commit..." : "Creating commit...");
    spinner.start();

    const success = createCommit(formattedCommitMessage, flags.amend);

    if (success) {
      const newCommit = getHeadCommit();
      spinner.stop(true, `Committed: ${newCommit}`);
    } else {
      spinner.stop(false, "Failed to create commit");
      process.exit(1);
    }
  }

  // Push if requested (via flag or interactive prompt)
  if (shouldPush && !flags.noCommit) {
    const spinner = new Spinner(`Pushing to ${finalBranch}...`);
    spinner.start();

    const result = pushToRemote();

    if (result.success) {
      spinner.stop(true, `Pushed to origin/${finalBranch}`);
    } else {
      spinner.stop(false, `Push failed: ${result.error}`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Final summary
  // ═══════════════════════════════════════════════════════════
  const commitHash = getHeadCommit();

  log(`\n   ${colors.green}${colors.bold}${"=".repeat(40)}${colors.reset}`);
  log(`   ${colors.green}${colors.bold}✓ Complete!${colors.reset}`);
  log(`   ${colors.green}${colors.bold}${"=".repeat(40)}${colors.reset}`);

  log(`
  ${colors.dim}Branch:${colors.reset} ${finalBranch}
  ${colors.dim}Commit:${colors.reset} ${commitHash}
  ${colors.dim}Type:${colors.reset}   ${typeInfo.emoji} ${changeType}${shouldPush ? `\n  ${colors.dim}Pushed:${colors.reset} ✓ origin/${finalBranch}` : ""}
`);
}

main().catch((err) => {
  console.error(`\n${colors.red}Error:${colors.reset}`, err.message);
  process.exit(1);
});
