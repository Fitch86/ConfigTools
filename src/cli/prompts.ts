/**
 * CLI prompts — interactive question flow for `configtools new` and `edit`.
 *
 * Uses the `prompts` library (lightweight, cancellable).
 * All prompt specs come from inbound modules' .prompts arrays.
 */

import prompts from "prompts";
import kleur from "kleur";
import { getAllModules, getModuleIds } from "../engines/xray/registry.js";
import type { BuildContext, PromptSpec } from "../engines/xray/module-api.js";
import type { RoutingPreset } from "../engines/xray/skeleton.js";
import type { ProjectData, InboundEntry } from "../project/store.js";
import { generateUuid } from "../crypto/uuid.js";
import { generateRealityKeyPair } from "../crypto/reality-keys.js";
import { generateShortIds } from "../crypto/short-id.js";
import { generatePassword } from "../crypto/password.js";
import { generateSelfSignedCert } from "../cert/self-signed.js";

// ---------------------------------------------------------------------------
// Prompt for a new project
// ---------------------------------------------------------------------------

export interface NewProjectAnswers {
  name: string;
  inboundIds: string[];
  logLevel: string;
  routingPreset: RoutingPreset;
  inbounds: InboundEntry[];
  ctx: BuildContext;
}

export async function promptNewProject(overrides?: Partial<{ name: string }>): Promise<NewProjectAnswers | null> {
  // 1. Project name
  const { name } = await prompts({
    type: "text",
    name: "name",
    message: "Project name",
    initial: overrides?.name ?? "my-xray",
  });
  if (!name) return null;

  // 2. Choose inbound types
  const modules = getAllModules();
  const { inboundIds } = await prompts({
    type: "multiselect",
    name: "inboundIds",
    message: "Select inbound protocols",
    choices: modules.map(m => ({ title: m.label, value: m.id, selected: m.id === "reality" })),
  });
  if (!inboundIds || inboundIds.length === 0) return null;

  // 3. Common options
  const { logLevel, routingPreset } = await prompts([
    {
      type: "select",
      name: "logLevel",
      message: "Log level",
      choices: [
        { title: "warning", value: "warning", selected: true },
        { title: "info", value: "info" },
        { title: "error", value: "error" },
        { title: "debug", value: "debug" },
        { title: "none", value: "none" },
      ],
    },
    {
      type: "select",
      name: "routingPreset",
      message: "Routing preset",
      choices: [
        { title: "none — all traffic direct", value: "none" },
        { title: "block-ads-cn — block ads & CN direct", value: "block-ads-cn", selected: true },
      ],
    },
  ]);

  // 4. Ask domain if WS/gRPC are present (needed for cert SAN + TLS SNI)
  const needsDomain = (inboundIds as string[]).some((id: string) => id !== "reality");
  let domain = "";
  if (needsDomain) {
    const { d } = await prompts({
      type: "text",
      name: "d",
      message: "Domain for TLS + cert SAN (WS/gRPC)",
      initial: "my.proxy.tld",
    });
    domain = d;
  }

  // 5. Per-inbound options
  const inbounds: InboundEntry[] = [];
  for (const id of inboundIds) {
    const mod = getAllModules().find(m => m.id === id)!;
    const options = await promptModuleOptions(mod.prompts, id, domain);
    inbounds.push({ moduleId: id, options });
  }

  // 6. Build context (generate secrets centrally)
  const ctx = buildContext(inboundIds, domain);

  return { name, inboundIds, logLevel, routingPreset, inbounds, ctx };
}

// ---------------------------------------------------------------------------
// Prompt for editing an existing project
// ---------------------------------------------------------------------------

export async function promptEditProject(existing: ProjectData): Promise<NewProjectAnswers | null> {
  console.log(kleur.gray(`Editing project: ${existing.name}`));
  console.log();

  // Re-ask all questions with current values as defaults
  const modules = getAllModules();
  const currentIds = existing.inbounds.map(ib => ib.moduleId);

  const { inboundIds } = await prompts({
    type: "multiselect",
    name: "inboundIds",
    message: "Select inbound protocols",
    choices: modules.map(m => ({
      title: m.label,
      value: m.id,
      selected: currentIds.includes(m.id),
    })),
  });
  if (!inboundIds || inboundIds.length === 0) return null;

  const { logLevel, routingPreset } = await prompts([
    {
      type: "select",
      name: "logLevel",
      message: "Log level",
      initial: existing.logLevel ?? "warning",
      choices: [
        { title: "warning", value: "warning" },
        { title: "info", value: "info" },
        { title: "error", value: "error" },
        { title: "debug", value: "debug" },
        { title: "none", value: "none" },
      ],
    },
    {
      type: "select",
      name: "routingPreset",
      message: "Routing preset",
      initial: existing.routingPreset ?? "none",
      choices: [
        { title: "none — all traffic direct", value: "none" },
        { title: "block-ads-cn — block ads & CN direct", value: "block-ads-cn" },
      ],
    },
  ]);

  const needsDomain = (inboundIds as string[]).some((id: string) => id !== "reality");
  let domain = "";
  if (needsDomain) {
    // Try to extract domain from existing WS/gRPC module options
    const existingDomain = existing.inbounds
      .filter(ib => ib.moduleId !== "reality")
      .map(ib => ib.options.domain as string)
      .find(Boolean) ?? "my.proxy.tld";

    const { d } = await prompts({
      type: "text",
      name: "d",
      message: "Domain for TLS + cert SAN (WS/gRPC)",
      initial: existingDomain,
    });
    domain = d;
  }

  const inbounds: InboundEntry[] = [];
  for (const id of inboundIds) {
    const mod = getAllModules().find(m => m.id === id)!;
    // Pre-fill with existing options for this module if available
    const existingOpts = existing.inbounds.find(ib => ib.moduleId === id)?.options ?? {};
    const options = await promptModuleOptions(mod.prompts, id, domain, existingOpts);
    inbounds.push({ moduleId: id, options });
  }

  // Re-generate context (or re-use existing secrets)
  const ctx = buildContext(inboundIds, domain, {
    uuid: existing.ctx.uuid,
    realityKeyPair: existing.ctx.realityKeyPair,
    shortIds: existing.ctx.shortIds,
    password: existing.ctx.password,
  });

  return { name: existing.name, inboundIds, logLevel, routingPreset, inbounds, ctx };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function promptModuleOptions(
  specs: PromptSpec[],
  moduleId: string,
  domain: string,
  defaults?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  console.log(kleur.cyan(`\n── ${moduleId} options ──`));

  const questions = specs.map(spec => {
    // Resolve initial value: explicit default > existing value > spec default
    let initial = defaults?.[spec.name] ?? spec.initial;

    // Auto-fill domain for WS/gRPC modules
    if (spec.name === "domain" && domain) {
      initial = domain;
    }

    // For serverNames, convert comma-separated string to array for display
    if (spec.name === "serverNames" && Array.isArray(initial)) {
      initial = (initial as string[]).join(",");
    }

    switch (spec.type) {
      case "text":
        return { type: "text" as const, name: spec.name, message: spec.message, initial };
      case "number":
        return {
          type: "number" as const,
          name: spec.name,
          message: spec.message,
          initial,
          min: (spec as { min?: number }).min,
          max: (spec as { max?: number }).max,
        };
      case "select":
        return { type: "select" as const, name: spec.name, message: spec.message, initial, choices: (spec as { choices: { title: string; value: unknown }[] }).choices };
      case "confirm":
        return { type: "confirm" as const, name: spec.name, message: spec.message, initial };
      default:
        return { type: "text" as const, name: spec.name, message: spec.message, initial };
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const answers = await prompts(questions as any);

  // Post-process: split comma-separated serverNames into array
  if (typeof answers.serverNames === "string") {
    answers.serverNames = (answers.serverNames as string)
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
  }

  return answers;
}

function buildContext(
  inboundIds: string[],
  domain: string,
  existing?: Partial<ProjectData["ctx"]>,
): BuildContext {
  const ctx: BuildContext = {
    uuid: existing?.uuid ?? generateUuid(),
    password: existing?.password ?? generatePassword(),
  };

  const hasReality = inboundIds.includes("reality");
  if (hasReality) {
    ctx.realityKeyPair = existing?.realityKeyPair ?? generateRealityKeyPair();
    ctx.shortIds = existing?.shortIds ?? generateShortIds({ count: 1, bytes: 4 });
  }

  const needsCert = (inboundIds as string[]).some((id: string) => id !== "reality");
  if (needsCert && domain) {
    ctx.selfSignedCert = generateSelfSignedCert({ domain });
  }

  return ctx;
}
