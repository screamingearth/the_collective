/**
 * gemini-bridge test script
 *
 * Quick test to verify Echo is working
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
    prompt: "Say hello to the_collective team. Keep it brief - just one or two sentences.",
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
