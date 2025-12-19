#!/usr/bin/env node
/* eslint-disable no-console */
/*
 * This file is part of >the_collective.
 * Copyright (c) 2025 screamingearth.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/**
 * Health check utility for Gemini Bridge
 *
 * This is NOT a test - it's a pre-flight check for users to verify
 * their Gemini CLI installation and authentication status.
 *
 * Usage: npm run doctor
 */

import { exec } from "child_process";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  fix?: string;
}

function checkBuildStatus(): CheckResult {
  const distPath = join(import.meta.dirname ?? __dirname, "..", "dist", "mcp-server.js");

  if (existsSync(distPath)) {
    return {
      name: "Build Status",
      passed: true,
      message: "TypeScript compiled successfully",
    };
  }

  return {
    name: "Build Status",
    passed: false,
    message: "Build artifacts not found",
    fix: "Run: npm run build",
  };
}

async function checkGeminiCli(): Promise<CheckResult> {
  try {
    await execAsync("npx @google/gemini-cli --version");
    return {
      name: "Gemini CLI",
      passed: true,
      message: "Gemini CLI is available",
    };
  } catch {
    return {
      name: "Gemini CLI",
      passed: false,
      message: "Gemini CLI not available",
      fix: "Run: npm install",
    };
  }
}

function checkAuthentication(): CheckResult {
  // Check for API key first (preferred fast path)
  if (process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim()) {
    return {
      name: "Authentication",
      passed: true,
      message: "API key configured (fast HTTP mode)",
    };
  }

  // Check for .env file with API key (in gemini-bridge root)
  // import.meta.dirname is src/ or dist/, so go up one level to gemini-bridge/
  const envPath = join(import.meta.dirname ?? __dirname, "..", ".env");
  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, "utf-8");
      if (content.includes("GEMINI_API_KEY=")) {
        return {
          name: "Authentication",
          passed: true,
          message: "API key found in .env file (fast HTTP mode)",
        };
      }
    } catch {
      // Ignore
    }
  }

  // Check for gemini-cli OAuth (fallback subprocess mode)
  const accountsPath = join(homedir(), ".gemini", "google_accounts.json");
  if (existsSync(accountsPath)) {
    try {
      const content = readFileSync(accountsPath, "utf-8");
      const data = JSON.parse(content) as { active?: string };
      if (data.active) {
        return {
          name: "Authentication",
          passed: true,
          message: `OAuth configured (${data.active}) - subprocess mode`,
        };
      }
    } catch {
      // Ignore parse errors
    }
  }

  return {
    name: "Authentication",
    passed: false,
    message: "Not authenticated with Gemini",
    fix: "Set GEMINI_API_KEY env var, or run: npm run auth",
  };
}

function checkMcpServer(): CheckResult {
  const serverPath = join(import.meta.dirname ?? __dirname, "..", "dist", "mcp-server.js");

  if (existsSync(serverPath)) {
    return {
      name: "MCP Server",
      passed: true,
      message: "MCP server binary exists at dist/mcp-server.js",
    };
  }

  return {
    name: "MCP Server",
    passed: false,
    message: "MCP server not built",
    fix: "Run: npm run build",
  };
}

async function runDoctor(): Promise<void> {
  console.log("🩺 Gemini Bridge Health Check\n");
  console.log("=".repeat(50) + "\n");

  // Run sync checks and async check
  const geminiCliCheck = await checkGeminiCli();
  const checks: CheckResult[] = [
    checkBuildStatus(),
    geminiCliCheck,
    checkAuthentication(),
    checkMcpServer(),
  ];

  let allPassed = true;

  for (const check of checks) {
    const icon = check.passed ? "✅" : "❌";
    console.log(`${icon} ${check.name}: ${check.message}`);
    if (!check.passed && check.fix) {
      console.log(`   └─ Fix: ${check.fix}`);
      allPassed = false;
    }
  }

  console.log("\n" + "=".repeat(50));

  if (allPassed) {
    console.log("\n🎉 All checks passed! Gemini Bridge is ready.\n");
    console.log("To use the MCP server:");
    console.log("1. Configure in VS Code MCP settings");
    console.log("2. Tools available: mcp_gemini_query, mcp_gemini_analyze_code, mcp_gemini_validate");
    console.log("3. Free tier: 60 req/min, 1000 req/day\n");
    process.exit(0);
  } else {
    console.log("\n⚠️  Some checks failed. Please fix the issues above.\n");
    process.exit(1);
  }
}

runDoctor().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("Doctor failed:", message);
  process.exit(1);
});
