#!/usr/bin/env node

/**
 * CLI wrapper for ui.cjs - allows bash scripts to use the UI library
 * 
 * Usage:
 *   node scripts/ui-cli.cjs banner "Title" "Subtitle"
 *   node scripts/ui-cli.cjs spinner "Message" -- command arg1 arg2
 *   node scripts/ui-cli.cjs success "Message"
 *   node scripts/ui-cli.cjs error "Message"
 *   node scripts/ui-cli.cjs warn "Message"
 *   node scripts/ui-cli.cjs info "Message"
 *   node scripts/ui-cli.cjs step 1 5 "Step description"
 *   node scripts/ui-cli.cjs progress "Message"
 *   node scripts/ui-cli.cjs complete "Done!"
 * 
 * This file is part of >the_collective (Apache 2.0 licensed).
 */

const { spawn } = require("child_process");
const ui = require("./lib/ui.cjs");

const [, , command, ...args] = process.argv;

function runWithSpinner(message, cmdArgs) {
  const spinner = new ui.Spinner(message);
  spinner.start();

  // Find the command after "--"
  const dashIndex = cmdArgs.indexOf("--");
  if (dashIndex === -1) {
    spinner.fail("No command provided after --");
    process.exit(1);
  }

  const execArgs = cmdArgs.slice(dashIndex + 1);
  if (execArgs.length === 0) {
    spinner.fail("No command provided after --");
    process.exit(1);
  }

  const [cmd, ...cmdArgsRest] = execArgs;

  return new Promise((resolve) => {
    const child = spawn(cmd, cmdArgsRest, {
      stdio: ["inherit", "pipe", "pipe"],
      shell: true,
    });

    let _stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      _stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        spinner.succeed(message);
      } else {
        spinner.fail(message);
        if (stderr) {
          console.error(stderr);
        }
      }
      resolve(code);
    });

    child.on("error", (err) => {
      spinner.fail(`${message}: ${err.message}`);
      resolve(1);
    });
  });
}

async function main() {
  switch (command) {
    case "banner":
      ui.banner(args[0] || "", args[1] || "");
      break;

    case "spinner": {
      const exitCode = await runWithSpinner(args[0] || "Working...", args.slice(1));
      process.exit(exitCode);
      break;
    }

    case "success":
      ui.success(args.join(" "));
      break;

    case "error":
      ui.error(args.join(" "));
      break;

    case "warn":
      ui.warn(args.join(" "));
      break;

    case "info":
      ui.info(args.join(" "));
      break;

    case "step":
      ui.step(parseInt(args[0], 10), parseInt(args[1], 10), args.slice(2).join(" "));
      break;

    case "progress":
      // Simple progress indicator
      console.log(`   ${ui.colors.yellow}⏳${ui.colors.reset} ${ui.colors.dim}${args.join(" ")} (this may take a minute)...${ui.colors.reset}`);
      break;

    case "complete":
      ui.complete(args.join(" ") || "Complete!");
      break;

    case "divider":
      ui.divider(args[0] || "-", parseInt(args[1], 10) || 50);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error("Usage: node scripts/ui-cli.cjs <command> [args...]");
      console.error("Commands: banner, spinner, success, error, warn, info, step, progress, complete, divider");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
