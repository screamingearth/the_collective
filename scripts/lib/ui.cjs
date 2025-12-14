#!/usr/bin/env node

/**
 * the_collective - Shared UI Utilities
 *
 * A beautiful, consistent UI library for all CLI scripts.
 * Because developer experience matters.
 *
 * Cross-platform: Windows, macOS, Linux (including Fedora KDE, Ubuntu, etc.)
 */

// ============================================================================
// Platform Detection & TTY Utilities
// ============================================================================

const IS_WINDOWS = process.platform === "win32";
const IS_TTY = process.stdout.isTTY && process.stderr.isTTY;

/**
 * Check if terminal supports ANSI colors
 * Windows 10+ supports ANSI, older versions may not
 */
function supportsColor() {
  // Force color with FORCE_COLOR env var
  if (process.env.FORCE_COLOR === "1" || process.env.FORCE_COLOR === "true") {
    return true;
  }
  // Disable color with NO_COLOR env var (standard: https://no-color.org/)
  if (process.env.NO_COLOR !== undefined) {
    return false;
  }
  // Check if running in CI (most CI environments support color)
  if (process.env.CI) {
    return true;
  }
  // Not a TTY? No color
  if (!IS_TTY) {
    return false;
  }
  // Windows 10+ (build 10586+) supports ANSI
  if (IS_WINDOWS) {
    const osRelease = require("os").release().split(".");
    // Windows 10 is version 10.0.x
    return parseInt(osRelease[0], 10) >= 10;
  }
  // Unix terminals generally support color
  return true;
}

const COLOR_SUPPORTED = supportsColor();

// ============================================================================
// Colors & Formatting
// ============================================================================

// Raw ANSI codes
const rawColors = {
  // Reset
  reset: "\x1b[0m",

  // Styles
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  blink: "\x1b[5m",
  inverse: "\x1b[7m",
  hidden: "\x1b[8m",
  strikethrough: "\x1b[9m",

  // Foreground colors
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",

  // Bright foreground
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",
  brightWhite: "\x1b[97m",

  // Background colors
  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgWhite: "\x1b[47m",
};

// Export colors with fallback for non-color terminals
const colors = COLOR_SUPPORTED
  ? rawColors
  : Object.fromEntries(Object.keys(rawColors).map((k) => [k, ""]));

// Icons/Emojis for different contexts
const icons = {
  // Status
  success: "✓",
  error: "✗",
  warning: "⚠",
  info: "ℹ",
  question: "?",
  pending: "○",
  complete: "●",

  // Actions
  arrow: "→",
  arrowRight: "▶",
  arrowDown: "▼",
  pointer: "❯",
  bullet: "•",
  star: "★",
  sparkle: "✨",

  // Objects
  folder: "📁",
  file: "📄",
  package: "📦",
  gear: "⚙",
  wrench: "🔧",
  hammer: "🔨",
  magnifier: "🔍",
  rocket: "🚀",
  fire: "🔥",
  check: "✅",
  cross: "❌",
  lock: "🔒",
  key: "🔑",
  bulb: "💡",
  bolt: "⚡",
  heart: "♥",
  clock: "🕐",

  // the_collective specific
  nyx: "👁",
  prometheus: "🔥",
  cassandra: "🛡",
  apollo: "✨",
  collective: "🌐",
};

// ============================================================================
// Color Helper Functions
// ============================================================================

/**
 * Apply color to text
 */
function colorize(text, ...styles) {
  const styleStr = styles.map((s) => colors[s] || s).join("");
  return `${styleStr}${text}${colors.reset}`;
}

/**
 * Strip ANSI codes from string (for length calculation)
 */
function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Get visible length of string (excluding ANSI codes)
 */
function visibleLength(str) {
  return stripAnsi(str).length;
}

// ============================================================================
// Logging Functions
// ============================================================================

/**
 * Basic log with optional color
 */
function log(msg, color = "") {
  console.log(color ? `${color}${msg}${colors.reset}` : msg);
}

/**
 * Log success message
 */
function success(msg) {
  console.log(`${colors.green}${icons.success}${colors.reset} ${msg}`);
}

/**
 * Log error message
 */
function error(msg, hint = "") {
  console.log(`${colors.red}${icons.error}${colors.reset} ${msg}`);
  if (hint) {
    console.log(`  ${colors.dim}${hint}${colors.reset}`);
  }
}

/**
 * Log warning message
 */
function warn(msg, hint = "") {
  console.log(`${colors.yellow}${icons.warning}${colors.reset} ${msg}`);
  if (hint) {
    console.log(`  ${colors.dim}${hint}${colors.reset}`);
  }
}

/**
 * Log info message
 */
function info(msg) {
  console.log(`${colors.dim}${icons.info} ${msg}${colors.reset}`);
}

/**
 * Log a step in a process
 */
function step(current, total, msg) {
  console.log(
    `\n${colors.cyan}[${current}/${total}]${colors.reset} ${colors.bold}${msg}${colors.reset}`,
  );
}

/**
 * Log a section header
 */
function section(title, icon = "") {
  const prefix = icon ? `${icon} ` : "";
  console.log(`\n${colors.blue}${colors.bold}${prefix}${title}${colors.reset}`);
}

/**
 * Log a divider line
 */
function divider(char = "-", length = 50) {
  console.log(colors.dim + char.repeat(length) + colors.reset);
}

// ============================================================================
// Box Drawing (converted to box-free style)
// ============================================================================

/**
 * Draw a titled section with content (no box, just clean formatting)
 */
function drawBox(title, lines, _options = {}) {
  // Title with underline
  console.log(`\n   ${colors.bold}${title}${colors.reset}`);
  console.log(`   ${colors.dim}${"-".repeat(40)}${colors.reset}`);

  // Content lines
  for (const line of lines) {
    console.log(`   ${line}`);
  }
  console.log();
}

/**
 * Draw a banner (for script headers)
 */
function banner(title, subtitle = "") {
  // Blocky pixel font header
  console.log(`
   ${colors.cyan}▀█▀ █ █ █▀▀${colors.reset}
   ${colors.cyan} █  █▀█ ██▄${colors.reset}
   ${colors.magenta}█▀▀ █▀█ █   █   █▀▀ █▀▀ ▀█▀ █ █ █ █▀▀${colors.reset}
   ${colors.magenta}█▄▄ █▄█ █▄▄ █▄▄ ██▄ █▄▄  █  █ ▀▄▀ ██▄${colors.reset}
`);

  // Title and subtitle below the logo
  if (title) {
    console.log(`   ${colors.bold}${title}${colors.reset}`);
  }
  if (subtitle) {
    console.log(`   ${colors.dim}${subtitle}${colors.reset}`);
  }
  console.log();
}

/**
 * Draw a completion banner
 */
function complete(title = "Complete!") {
  console.log(`
   ${colors.green}${colors.bold}${icons.success} ${title}${colors.reset}
`);
}

// ============================================================================
// Spinner
// ============================================================================

class Spinner {
  constructor(message) {
    this.message = message;
    // Use simpler ASCII frames on Windows or non-TTY for better compatibility
    this.frames =
      IS_TTY && !IS_WINDOWS
        ? ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
        : ["-", "\\", "|", "/"];
    this.current = 0;
    this.interval = null;
    this.isInteractive = IS_TTY;
  }

  start() {
    if (!this.isInteractive) {
      // Non-interactive: just print the message once
      console.log(`${colors.cyan}...${colors.reset} ${this.message}`);
      return;
    }
    process.stdout.write(`\n${colors.cyan}${this.frames[0]}${colors.reset} ${this.message}`);
    this.interval = setInterval(() => {
      this.current = (this.current + 1) % this.frames.length;
      // Safe clear line - check if methods exist (they should on Node 12+)
      if (process.stdout.clearLine && process.stdout.cursorTo) {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(
          `${colors.cyan}${this.frames[this.current]}${colors.reset} ${this.message}`,
        );
      }
    }, 80);
  }

  update(message) {
    this.message = message;
  }

  stop(succeeded = true, finalMessage = null) {
    if (this.interval) {
      clearInterval(this.interval);
    }
    const icon = succeeded
      ? `${colors.green}${icons.success}${colors.reset}`
      : `${colors.red}${icons.error}${colors.reset}`;

    if (this.isInteractive && process.stdout.clearLine && process.stdout.cursorTo) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
    }
    console.log(`${icon} ${finalMessage || this.message}`);
  }

  succeed(message = null) {
    this.stop(true, message);
  }

  fail(message = null) {
    this.stop(false, message);
  }
}

// ============================================================================
// Progress Bar
// ============================================================================

class ProgressBar {
  constructor(total, options = {}) {
    this.total = total;
    this.current = 0;
    this.width = options.width || 30;
    // Use ASCII fallback characters on Windows for better compatibility
    this.complete = options.complete || (IS_WINDOWS ? "#" : "█");
    this.incomplete = options.incomplete || (IS_WINDOWS ? "-" : "░");
    this.showPercent = options.showPercent !== false;
    this.showCount = options.showCount !== false;
    this.isInteractive = IS_TTY;
    this.lastPrintedPercent = -1;
  }

  update(current, message = "") {
    this.current = current;
    const percent = Math.floor((current / this.total) * 100);
    const filled = Math.floor((current / this.total) * this.width);
    const empty = this.width - filled;

    const bar = `${colors.green}${this.complete.repeat(filled)}${colors.reset}${colors.dim}${this.incomplete.repeat(
      empty,
    )}${colors.reset}`;

    let info = "";
    if (this.showPercent) {
      info += ` ${percent}%`;
    }
    if (this.showCount) {
      info += ` (${current}/${this.total})`;
    }

    if (this.isInteractive && process.stdout.clearLine && process.stdout.cursorTo) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(`${bar}${info} ${message}`);
    } else if (percent !== this.lastPrintedPercent) {
      // Non-interactive: only print on percent change to avoid spam
      console.log(`${bar}${info} ${message}`);
      this.lastPrintedPercent = percent;
    }
  }

  increment(message = "") {
    this.update(this.current + 1, message);
  }

  complete(message = "Done!") {
    this.update(this.total, message);
    console.log();
  }
}

// ============================================================================
// Interactive Prompts
// ============================================================================

const readline = require("readline");

/**
 * Simple text prompt with optional pre-filled default value
 * @param {string} question - The prompt question
 * @param {string} defaultValue - Default value (shown as hint, used if empty input)
 * @param {boolean} prefill - If true, pre-fills input with default so user can edit it
 */
function prompt(question, defaultValue = "", prefill = false) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // If prefill is enabled and we have a default, pre-populate the input
  if (prefill && defaultValue) {
    return new Promise((resolve) => {
      // Write the question
      process.stdout.write(`${question} `);

      // Pre-fill the input buffer with the default value
      rl.write(defaultValue);

      rl.on("line", (answer) => {
        rl.close();
        resolve(answer.trim() || defaultValue);
      });
    });
  }

  // Standard behavior: show default as hint
  const defaultHint = defaultValue ? ` ${colors.dim}(${defaultValue})${colors.reset}` : "";

  return new Promise((resolve) => {
    rl.question(`${question}${defaultHint} `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

/**
 * Yes/No confirmation prompt
 * @param {string} question - The question to ask
 * @param {boolean|null} defaultYes - true = Y is default, false = N is default, null = no default (requires explicit input)
 */
function confirm(question, defaultYes = true) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Determine hint based on default
  let hint;
  if (defaultYes === null) {
    hint = `${colors.dim}[y/n]${colors.reset}`; // No default - requires explicit input
  } else if (defaultYes) {
    hint = `${colors.dim}[Y/n]${colors.reset}`;
  } else {
    hint = `${colors.dim}[y/N]${colors.reset}`;
  }

  return new Promise((resolve) => {
    const ask = () => {
      rl.question(`${question} ${hint} `, (answer) => {
        const a = answer.trim().toLowerCase();

        // If no default and empty input, ask again
        if (a === "" && defaultYes === null) {
          console.log(`${colors.yellow}Please enter y or n${colors.reset}`);
          ask(); // Ask again
          return;
        }

        rl.close();
        if (a === "") {
          resolve(defaultYes);
        } else {
          resolve(a === "y" || a === "yes");
        }
      });
    };
    ask();
  });
}

/**
 * Selection prompt (number-based)
 */
async function select(question, options, defaultIndex = 0) {
  console.log(`\n${colors.cyan}${question}${colors.reset}\n`);

  options.forEach((opt, i) => {
    const isDefault = i === defaultIndex;
    const marker = isDefault ? `${colors.green}→${colors.reset}` : " ";
    const label = typeof opt === "string" ? opt : opt.label;
    const hint =
      typeof opt === "object" && opt.hint ? ` ${colors.dim}${opt.hint}${colors.reset}` : "";
    const defaultLabel = isDefault ? ` ${colors.dim}(default)${colors.reset}` : "";
    console.log(
      `  ${marker} ${colors.bold}${i + 1}.${colors.reset} ${label}${hint}${defaultLabel}`,
    );
  });

  const answer = await prompt(
    `\n${colors.yellow}Enter number:${colors.reset}`,
    String(defaultIndex + 1),
  );
  const num = parseInt(answer, 10);

  if (num >= 1 && num <= options.length) {
    return num - 1;
  }
  return defaultIndex;
}

// ============================================================================
// Table Formatting
// ============================================================================

/**
 * Print a simple table
 */
function table(headers, rows, options = {}) {
  const { padding = 2 } = options;

  // Calculate column widths
  const widths = headers.map((h, i) => {
    const headerLen = visibleLength(h);
    const maxRowLen = Math.max(...rows.map((r) => visibleLength(String(r[i] || ""))));
    return Math.max(headerLen, maxRowLen);
  });

  // Print header
  const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join(" ".repeat(padding));
  console.log(`${colors.bold}${headerLine}${colors.reset}`);
  console.log(
    colors.dim + widths.map((w) => "-".repeat(w)).join("-".repeat(padding)) + colors.reset,
  );

  // Print rows
  for (const row of rows) {
    const rowLine = row
      .map((cell, i) => String(cell || "").padEnd(widths[i]))
      .join(" ".repeat(padding));
    console.log(rowLine);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format bytes to human readable
/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) {
    return "0 B";
  }
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Format duration in ms to human readable
 */
function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}

/**
 * Truncate string with ellipsis
 */
function truncate(str, maxLen, ellipsis = "...") {
  if (str.length <= maxLen) {
    return str;
  }
  return str.slice(0, maxLen - ellipsis.length) + ellipsis;
}

/**
 * Pad string to center
 */
function center(str, width) {
  const padding = Math.max(0, width - str.length);
  const left = Math.floor(padding / 2);
  const right = padding - left;
  return " ".repeat(left) + str + " ".repeat(right);
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  // Platform detection
  IS_WINDOWS,
  IS_TTY,
  COLOR_SUPPORTED,
  supportsColor,

  // Colors & formatting
  colors,
  icons,
  colorize,
  stripAnsi,
  visibleLength,

  // Logging
  log,
  success,
  error,
  warn,
  info,
  step,
  section,
  divider,

  // Boxes & banners
  drawBox,
  banner,
  complete,

  // Interactive
  Spinner,
  ProgressBar,
  prompt,
  confirm,
  select,

  // Tables
  table,

  // Utilities
  formatBytes,
  formatDuration,
  truncate,
  center,
};
