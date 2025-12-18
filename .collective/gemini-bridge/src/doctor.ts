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
import { existsSync } from "fs";
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
  const credsPath = join(homedir(), ".gemini", "oauth_creds.json");

  if (existsSync(credsPath)) {
    return {
      name: "Authentication",
      passed: true,
      message: "OAuth credentials found",
    };
  }

  return {
    name: "Authentication",
    passed: false,
    message: "Not authenticated with Gemini",
    fix: "Run: npm run auth (then follow browser flow)",
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
