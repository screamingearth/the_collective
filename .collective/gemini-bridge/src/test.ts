/*
 * This file is part of >the_collective.
 * Copyright (c) 2025 screamingearth.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { echo } from "./index.js";

async function main() {
  console.log("🔍 Checking Echo status...\n");

  const status = await echo.status();

  if (!status.installed) {
    console.error("❌ Gemini CLI is not installed.");
    console.log("\nRun: npm install");
    process.exit(1);
  }

  if (!status.authenticated) {
    console.error("❌ Gemini CLI is not authenticated.");
    console.log("\nRun: npm run auth");
    console.log("Then follow the browser authentication flow.");
    process.exit(1);
  }

  console.log("✅ Echo is ready!\n");
  console.log("Testing a simple invocation...\n");

  const result = await echo.invoke({
    prompt: "Say hello to the >the_collective team. Keep it brief - just one or two sentences.",
    outputFormat: "text",
  });

  if (result.success) {
    console.log("📣 Echo says:\n");
    console.log(result.response);
    console.log(`\n⏱️  Execution time: ${result.executionTime}ms`);
  } else {
    console.error("❌ Invocation failed:", result.error);
    process.exit(1);
  }
}

main().catch(console.error);
