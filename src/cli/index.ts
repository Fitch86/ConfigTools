#!/usr/bin/env node
/**
 * configtools — Interactive Xray-core config generator CLI.
 *
 * Subcommands:
 *   new [name]           — create a new project interactively
 *   edit <name>          — reload & re-prompt, rebuild
 *   check <name>         — validate server.json
 *   format <name>        — reformat server.json in place
 *   ui [port]            — launch Web UI
 *   list                 — show projects in output/
 */

import { resolve } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import kleur from "kleur";

const VERSION = "0.1.0";
import { promptNewProject, promptEditProject } from "./prompts.js";
import { writeProject, printSummary } from "./output.js";
import { assembleXrayConfig } from "../engines/xray/assembler.js";
import { validateXrayConfig } from "../validate/index.js";
import { formatJsonString } from "../format/json.js";
import {
  loadProject,
  saveProject,
  listProjects,
  serverJsonPath,
  projectDir,
} from "../project/store.js";

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const subcommand = args[0] ?? "help";

  switch (subcommand) {
    case "new":
      await cmdNew(args[1]);
      break;
    case "edit":
      await cmdEdit(args[1]);
      break;
    case "check":
      await cmdCheck(args[1], args[2]);
      break;
    case "format":
      await cmdFormat(args[1]);
      break;
    case "list":
      cmdList();
      break;
    case "ui":
      await cmdUi(args[1]);
      break;
    case "version":
    case "-v":
    case "--version":
      console.log(`configtools v${VERSION}`);
      break;
    case "help":
    case "-h":
    case "--help":
    default:
      printHelp();
      break;
  }
}

// ---------------------------------------------------------------------------
// new
// ---------------------------------------------------------------------------

async function cmdNew(nameArg?: string): Promise<void> {
  const answers = await promptNewProject({ name: nameArg });
  if (!answers) {
    console.log(kleur.red("Aborted."));
    process.exit(1);
  }

  const { name, logLevel, routingPreset, inbounds, ctx } = answers;

  // Assemble the config
  const result = assembleXrayConfig({
    logLevel: logLevel as "warning" | "info" | "error" | "debug" | "none",
    routingPreset: routingPreset as "none" | "block-ads-cn",
    inbounds: inbounds.map(ib => ({ moduleId: ib.moduleId, options: ib.options })),
    ctx,
  });

  // Validate
  const validation = validateXrayConfig(result.config);
  if (!validation.valid) {
    console.log(kleur.red("\n✗ Generated config has validation errors:"));
    for (const issue of validation.issues) {
      const prefix = issue.level === "error" ? kleur.red("  ✗") : kleur.yellow("  ⚠");
      console.log(`${prefix} ${issue.path}: ${issue.message}`);
      if (issue.hint) console.log(kleur.gray(`    Hint: ${issue.hint}`));
    }
    console.log(kleur.yellow("\nConfig was NOT written. Fix the issues above and try again."));
    process.exit(1);
  }

  // Build project data
  const project = {
    name,
    engine: "xray" as const,
    logLevel,
    routingPreset,
    inbounds,
    ctx: {
      uuid: ctx.uuid,
      realityKeyPair: ctx.realityKeyPair,
      shortIds: ctx.shortIds,
      password: ctx.password,
    },
  };

  // Write
  writeProject({
    project,
    serverConfig: result.config as unknown as Record<string, unknown>,
    clientNodes: result.clientNodes,
    files: result.files,
  });

  // Print summary
  printSummary(project, result.clientNodes);
}

// ---------------------------------------------------------------------------
// edit
// ---------------------------------------------------------------------------

async function cmdEdit(nameArg?: string): Promise<void> {
  if (!nameArg) {
    console.log(kleur.red("Usage: configtools edit <name>"));
    process.exit(1);
  }

  const existing = loadProject(nameArg);
  const answers = await promptEditProject(existing);
  if (!answers) {
    console.log(kleur.red("Aborted."));
    process.exit(1);
  }

  const { name, logLevel, routingPreset, inbounds, ctx } = answers;

  const result = assembleXrayConfig({
    logLevel: logLevel as "warning" | "info" | "error" | "debug" | "none",
    routingPreset: routingPreset as "none" | "block-ads-cn",
    inbounds: inbounds.map(ib => ({ moduleId: ib.moduleId, options: ib.options })),
    ctx,
  });

  const project = {
    name,
    engine: "xray" as const,
    logLevel,
    routingPreset,
    inbounds,
    ctx: {
      uuid: ctx.uuid,
      realityKeyPair: ctx.realityKeyPair,
      shortIds: ctx.shortIds,
      password: ctx.password,
    },
  };

  writeProject({
    project,
    serverConfig: result.config as unknown as Record<string, unknown>,
    clientNodes: result.clientNodes,
    files: result.files,
  });

  printSummary(project, result.clientNodes);
}

// ---------------------------------------------------------------------------
// check
// ---------------------------------------------------------------------------

async function cmdCheck(nameArg?: string, fileArg?: string): Promise<void> {
  if (!nameArg) {
    console.log(kleur.red("Usage: configtools check <name> [file]"));
    process.exit(1);
  }

  // If fileArg is provided, use it as the file path; otherwise default to server.json
  const actualPath = fileArg ? resolve(fileArg) : serverJsonPath(nameArg);

  if (!existsSync(actualPath)) {
    console.log(kleur.red(`File not found: ${actualPath}`));
    process.exit(1);
  }

  const raw = readFileSync(actualPath, "utf-8");
  let config: unknown;
  try {
    config = JSON.parse(raw);
  } catch {
    console.log(kleur.red("✗ Invalid JSON"));
    process.exit(1);
  }

  const dir = projectDir(nameArg);
  const result = validateXrayConfig(config, dir);

  if (result.issues.length === 0) {
    console.log(kleur.green("✓ Config is valid — no issues found"));
    process.exit(0);
  }

  let hasErrors = false;
  for (const issue of result.issues) {
    const prefix = issue.level === "error" ? kleur.red("  ✗") : kleur.yellow("  ⚠");
    console.log(`${prefix} ${issue.path}: ${issue.message}`);
    if (issue.hint) console.log(kleur.gray(`    Hint: ${issue.hint}`));
    if (issue.level === "error") hasErrors = true;
  }

  if (hasErrors) {
    console.log(kleur.red(`\n✗ ${result.issues.filter(i => i.level === "error").length} error(s) found`));
    process.exit(1);
  } else {
    console.log(kleur.yellow(`\n⚠ ${result.issues.length} warning(s)`));
    process.exit(0);
  }
}

// ---------------------------------------------------------------------------
// format
// ---------------------------------------------------------------------------

async function cmdFormat(nameArg?: string): Promise<void> {
  if (!nameArg) {
    console.log(kleur.red("Usage: configtools format <name>"));
    process.exit(1);
  }

  const path = serverJsonPath(nameArg);
  if (!existsSync(path)) {
    console.log(kleur.red(`File not found: ${path}`));
    process.exit(1);
  }

  const raw = readFileSync(path, "utf-8");
  const formatted = formatJsonString(raw);
  writeFileSync(path, formatted + "\n", "utf-8");
  console.log(kleur.green(`✓ Formatted ${path}`));
}

// ---------------------------------------------------------------------------
// ui — Launch Web UI
// ---------------------------------------------------------------------------

async function cmdUi(portArg?: string): Promise<void> {
  const port = parseInt(portArg || "3000", 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    console.log(kleur.red("Invalid port. Usage: configtools ui [port]"));
    process.exit(1);
  }

  const { startUiServer } = await import("../ui/server.js");
  console.log(kleur.cyan("\n  ⚙️  configtools Web UI\n"));
  startUiServer(port);

  // Auto-open browser after a short delay
  setTimeout(() => {
    const url = `http://localhost:${port}/ui/`;
    console.log(kleur.gray(`  Opening ${url} …`));
    try {
      const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
      execSync(`${cmd} ${url}`, { stdio: "ignore" });
    } catch {
      console.log(kleur.yellow(`  Could not auto-open browser. Please visit: ${url}`));
    }
  }, 500);
}

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

function cmdList(): void {
  const projects = listProjects();
  if (projects.length === 0) {
    console.log(kleur.gray("No projects found in output/"));
    return;
  }
  console.log(kleur.bold("Projects:"));
  for (const name of projects) {
    console.log(`  ${name}`);
  }
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

function printHelp(): void {
  console.log(`
${kleur.bold("configtools")} v${VERSION} — Interactive Xray-core config generator

${kleur.bold("Usage:")}
  configtools new [name]              Create a new project interactively
  configtools edit <name>            Reload & re-prompt, rebuild
  configtools check <name> [file]    Validate server.json
  configtools format <name>          Reformat server.json in place
  configtools ui [port]              Launch Web UI (default: 3000)
  configtools list                    Show projects in output/

${kleur.bold("Options:")}
  -h, --help      Show this help
  -v, --version   Show version
`.trim());
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main().catch(err => {
  console.error(kleur.red("Fatal error:"), err);
  process.exit(1);
});
