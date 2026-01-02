/**
 * Preflight Checks
 * Part of >the_collective by screamingearth (Apache 2.0 licensed)
 *
 * Pre-flight validation checks to run before installation or other operations.
 * Catches common issues early with clear error messages and fix suggestions.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const net = require("net");
const { execSync } = require("child_process");

/**
 * Check if a port is in use
 * @param {number} port - Port to check
 * @returns {Promise<boolean>} - True if port is in use
 */
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true));
    server.once("listening", () => {
      server.close();
      resolve(false);
    });
    server.listen(port, "127.0.0.1");
  });
}

/**
 * Get available disk space in bytes
 * @param {string} dir - Directory to check
 * @returns {number|null} - Available bytes, or null if unknown
 */
function getAvailableDiskSpace(dir) {
  try {
    if (process.platform === "win32") {
      // Windows: use wmic
      const drive = path.parse(dir).root.charAt(0);
      const result = execSync(`wmic logicaldisk where "DeviceID='${drive}:'" get FreeSpace`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      const lines = result.trim().split("\n");
      if (lines.length >= 2) {
        return parseInt(lines[1].trim(), 10);
      }
    } else {
      // Unix: use df
      const result = execSync(`df -k "${dir}" | tail -1 | awk '{print $4}'`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      return parseInt(result.trim(), 10) * 1024; // Convert KB to bytes
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Check if SELinux is enforcing
 * @returns {boolean}
 */
function isSelinuxEnforcing() {
  try {
    const result = execSync("getenforce", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return result.trim() === "Enforcing";
  } catch {
    return false;
  }
}

/**
 * Check if Docker is available and running
 * @returns {{ available: boolean, running: boolean, version: string|null, error: string|null }}
 */
function checkDocker() {
  try {
    const version = execSync("docker --version", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    try {
      execSync("docker info", {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      return { available: true, running: true, version, error: null };
    } catch {
      return { available: true, running: false, version, error: "Docker daemon not running" };
    }
  } catch {
    return { available: false, running: false, version: null, error: "Docker not installed" };
  }
}

/**
 * Check Node.js version
 * @returns {{ valid: boolean, version: string, major: number, error: string|null }}
 */
function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split(".")[0], 10);

  if (major < 20) {
    return {
      valid: false,
      version,
      major,
      error: `Node.js ${version} is too old. Minimum required: v20.0.0`,
    };
  }

  if (major >= 23) {
    return {
      valid: false,
      version,
      major,
      error: `Node.js ${version} is not supported. Native modules require v20 or v22 LTS.`,
    };
  }

  return { valid: true, version, major, error: null };
}

/**
 * Check write permissions for a directory
 * @param {string} dir - Directory to check
 * @returns {{ writable: boolean, error: string|null }}
 */
function checkWritePermissions(dir) {
  try {
    const testFile = path.join(dir, `.collective-permission-test-${Date.now()}`);
    fs.writeFileSync(testFile, "test");
    fs.unlinkSync(testFile);
    return { writable: true, error: null };
  } catch (error) {
    return { writable: false, error: `Cannot write to ${dir}: ${error.message}` };
  }
}

/**
 * Check if gemini config directory is accessible
 * @returns {{ accessible: boolean, path: string, error: string|null }}
 */
function checkGeminiConfigDir() {
  const geminiDir =
    process.platform === "win32"
      ? path.join(process.env.HOME || process.env.USERPROFILE || os.homedir(), ".gemini")
      : path.join(os.homedir(), ".gemini");

  try {
    if (!fs.existsSync(geminiDir)) {
      fs.mkdirSync(geminiDir, { recursive: true });
    }
    fs.accessSync(geminiDir, fs.constants.W_OK);
    return { accessible: true, path: geminiDir, error: null };
  } catch (error) {
    return { accessible: false, path: geminiDir, error: `Cannot access ${geminiDir}: ${error.message}` };
  }
}

/**
 * Check network connectivity
 * @returns {Promise<{ connected: boolean, error: string|null }>}
 */
function checkNetwork() {
  return new Promise((resolve) => {
    const req = require("https").get("https://registry.npmjs.org/-/ping", { timeout: 5000 }, (res) => {
      resolve({ connected: res.statusCode === 200, error: null });
    });

    req.on("error", (error) => {
      resolve({ connected: false, error: `Cannot reach npm registry: ${error.message}` });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({ connected: false, error: "Network timeout - check your internet connection" });
    });
  });
}

/**
 * Run all preflight checks
 * @param {object} options - Check options
 * @param {string} options.targetDir - Target directory for installation
 * @param {string} options.mode - Installation mode (docker/local)
 * @param {boolean} options.checkNetwork - Whether to check network connectivity
 * @returns {Promise<{ passed: string[], warnings: string[], errors: string[] }>}
 */
async function runPreflightChecks(options = {}) {
  const { targetDir = process.cwd(), mode = "docker", checkNetwork: doCheckNetwork = true } = options;

  const passed = [];
  const warnings = [];
  const errors = [];

  // 1. Node.js version
  const nodeCheck = checkNodeVersion();
  if (nodeCheck.valid) {
    passed.push(`Node.js ${nodeCheck.version}`);
  } else {
    errors.push(nodeCheck.error);
  }

  // 2. Write permissions
  const writeCheck = checkWritePermissions(targetDir);
  if (writeCheck.writable) {
    passed.push("Write permissions");
  } else {
    errors.push(writeCheck.error);
  }

  // 3. Disk space (minimum 2GB recommended)
  const diskSpace = getAvailableDiskSpace(targetDir);
  if (diskSpace !== null) {
    const minSpace = 2 * 1024 * 1024 * 1024; // 2GB
    if (diskSpace < minSpace) {
      warnings.push(`Low disk space: ${formatBytes(diskSpace)} available (2GB recommended)`);
    } else {
      passed.push(`Disk space: ${formatBytes(diskSpace)} available`);
    }
  }

  // 4. Docker (if docker mode)
  if (mode === "docker") {
    const dockerCheck = checkDocker();
    if (dockerCheck.running) {
      passed.push(`Docker: ${dockerCheck.version}`);

      // Check port availability
      const port3100InUse = await isPortInUse(3100);
      const port3101InUse = await isPortInUse(3101);

      if (port3100InUse) {
        errors.push("Port 3100 is already in use (memory server). Stop the existing process or use --mode=stdio");
      }
      if (port3101InUse) {
        errors.push("Port 3101 is already in use (gemini bridge). Stop the existing process or use --mode=stdio");
      }
      if (!port3100InUse && !port3101InUse) {
        passed.push("Ports 3100, 3101 available");
      }

      // Check SELinux
      if (isSelinuxEnforcing()) {
        warnings.push("SELinux is enforcing. Volume mounts will use :z flag for compatibility.");
      }
    } else if (dockerCheck.available) {
      errors.push("Docker installed but not running. Start Docker and try again.");
    } else {
      errors.push("Docker not installed. Install Docker or use --mode=stdio");
    }
  }

  // 5. Gemini config directory
  const geminiCheck = checkGeminiConfigDir();
  if (geminiCheck.accessible) {
    passed.push(`Gemini config dir: ${geminiCheck.path}`);
  } else {
    warnings.push(`${geminiCheck.error} - OAuth authentication may fail`);
  }

  // 6. Network connectivity
  if (doCheckNetwork) {
    const networkCheck = await checkNetwork();
    if (networkCheck.connected) {
      passed.push("Network connectivity");
    } else {
      errors.push(networkCheck.error);
    }
  }

  return { passed, warnings, errors };
}

/**
 * Format bytes to human readable string
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(1)} ${units[i]}`;
}

/**
 * Print preflight results in a formatted way
 * @param {{ passed: string[], warnings: string[], errors: string[] }} results
 */
function printPreflightResults(results) {
  const { passed, warnings, errors } = results;

  console.log("");
  console.log("Preflight Checks:");
  console.log("─".repeat(50));

  for (const item of passed) {
    console.log(`  ✓ ${item}`);
  }

  for (const item of warnings) {
    console.log(`  ⚠ ${item}`);
  }

  for (const item of errors) {
    console.log(`  ✗ ${item}`);
  }

  console.log("─".repeat(50));

  if (errors.length > 0) {
    console.log(`\n❌ ${errors.length} error(s) must be fixed before continuing.\n`);
    return false;
  }

  if (warnings.length > 0) {
    console.log(`\n⚠ ${warnings.length} warning(s). Proceeding anyway.\n`);
  } else {
    console.log("\n✓ All checks passed!\n");
  }

  return true;
}

module.exports = {
  isPortInUse,
  getAvailableDiskSpace,
  isSelinuxEnforcing,
  checkDocker,
  checkNodeVersion,
  checkWritePermissions,
  checkGeminiConfigDir,
  checkNetwork,
  runPreflightChecks,
  formatBytes,
  printPreflightResults,
};
