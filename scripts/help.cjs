#!/usr/bin/env node

/*
 * the_collective - Help & Command Reference
 *
 * Shows all available commands and their usage.
 *
 * Usage:
 *   npm run help
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

const {
  colors: c,
  banner: drawBanner,
  section: logSection,
  divider,
  log,
} = require("./lib/ui.cjs");

function section(title) {
  logSection(title);
}

function command(name, description, flags = []) {
  console.log(`  ${c.green}${c.bold}npm run ${name}${c.reset}`);
  console.log(`  ${c.dim}${description}${c.reset}`);
  if (flags.length > 0) {
    flags.forEach((flag) => {
      console.log(`    ${c.yellow}${flag.flag}${c.reset}  ${c.dim}${flag.desc}${c.reset}`);
    });
  }
  console.log();
}

function main() {
  drawBanner("Command Reference", "");

  section("🚀 Getting Started");
  console.log(`  ${c.green}${c.bold}./setup.sh${c.reset}`);
  console.log(`  ${c.dim}Universal setup - installs Node.js if needed, deps, builds, bootstraps${c.reset}`);
  console.log();
  command("help", "Show this help message");

  section("💻 Development Workflow");
  command("commit", "Smart commit tool with changelog integration", [
    { flag: "-t, --type <type>", desc: "Change type (feat, fix, docs, build, ci, chore, refactor, perf, test, breaking, security)" },
    { flag: "-m, --message <msg>", desc: "Commit message" },
    { flag: "-g, --generate", desc: "Auto-generate messages from diff" },
    { flag: "-p, --push", desc: "Auto-push after commit" },
    { flag: "--no-verify", desc: "Skip pre-commit hooks" },
    { flag: "--dry-run", desc: "Preview without making changes" },
    { flag: "-v, --version", desc: "Show version" },
  ]);

  section("🔍 Validation & Testing");
  command("check", "Run health check on the framework", [
    { flag: "--strict", desc: "Fail on warnings, audit moderate+ vulns (CI mode)" },
    { flag: "--memory", desc: "Check memory system only" },
    { flag: "--quick", desc: "Skip slow checks (db count, security audit)" },
  ]);
  command("validate", "Run linting and formatting checks", [
    { flag: "--fix", desc: "Auto-fix issues where possible" },
  ]);

  section("🔧 Maintenance");
  command("clean", "Remove build artifacts and dependencies", [
    { flag: "--force", desc: "Skip confirmation" },
    { flag: "--dry", desc: "Preview only" },
    { flag: "--keep-db", desc: "Preserve memory database" },
  ]);
  command("update", "Update all dependencies and rebuild");

  section("🖥️ Supported Platforms");
  console.log(`
  ${c.green}✓${c.reset} Linux (Fedora, Ubuntu, Debian, Arch, etc.)
  ${c.green}✓${c.reset} macOS (Intel & Apple Silicon)
  ${c.green}✓${c.reset} Windows 10/11
  ${c.dim}Requires Node.js 20+ on all platforms${c.reset}
`);

  section("📥 One-Liner Install");
  console.log(`
  ${c.dim}# macOS / Linux / Windows (Git Bash or WSL):${c.reset}
  ${c.cyan}curl -fsSL https://raw.githubusercontent.com/screamingearth/the_collective/main/setup.sh | bash${c.reset}

  ${c.dim}# Windows users: Use Git Bash (comes with Git for Windows) or WSL${c.reset}
`);

  section("🤖 The Agents");
  console.log(`
  ${c.magenta}👁  Nyx${c.reset}         Strategic orchestrator, user interface
  ${c.yellow}🔥 Prometheus${c.reset}   Implementation & architecture
  ${c.green}🛡  Cassandra${c.reset}    Validation & risk analysis
  ${c.cyan}✨ Apollo${c.reset}       Optimization & quality certification
`);

  section("📚 Documentation");
  console.log(`
  ${c.dim}README.md${c.reset}           Project overview and quick start
  ${c.dim}QUICKSTART.md${c.reset}       Detailed setup guide
  ${c.dim}AGENTS.md${c.reset}           Agent workflow documentation
  ${c.dim}docs/${c.reset}               Deep-dive documentation
    ${c.dim}|-- MCP_SERVERS.md${c.reset}      MCP server configuration
    ${c.dim}|-- MEMORY_ARCHITECTURE.md${c.reset}  Memory system design
    ${c.dim}+-- GITHUB_INTEGRATION.md${c.reset}   Commit tool & templates
`);

  section("💡 Tips");
  console.log(`
  ${c.cyan}•${c.reset} Type ${c.green}"auto"${c.reset} when prompted to generate commit messages
  ${c.cyan}•${c.reset} All prompts pre-fill with smart defaults you can edit
  ${c.cyan}•${c.reset} Run ${c.green}npm run check${c.reset} before committing to catch issues
  ${c.cyan}•${c.reset} Most commands support ${c.green}--help${c.reset} for detailed usage
`);

  divider("-", 50);
  log(`${c.dim}Made with 💜 by >the_collective${c.reset}\n`);
}

main();
