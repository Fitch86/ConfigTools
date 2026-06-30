/**
 * Assembles a complete Xray-core config from a skeleton + inbound module results.
 *
 * This is the main entry point for the Xray engine. It:
 * 1. Builds the skeleton (log/dns/routing/outbounds)
 * 2. Runs each chosen inbound module's build()
 * 3. Merges everything into a single XrayConfig
 */

import type { XrayConfig, XrayInbound } from "./types.js";
import type { BuildContext, InboundResult } from "./module-api.js";
import { buildSkeleton, type RoutingPreset, type SkeletonOptions } from "./skeleton.js";
import { getModule } from "./registry.js";

// ---------------------------------------------------------------------------
// Assembler input
// ---------------------------------------------------------------------------

export interface AssemblerInput {
  logLevel?: SkeletonOptions["logLevel"];
  routingPreset?: RoutingPreset;
  /** List of inbound module IDs + their per-module options */
  inbounds: InboundSpec[];
  /** Shared build context (UUID, keys, cert, etc.) */
  ctx: BuildContext;
}

export interface InboundSpec {
  moduleId: string;
  options: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Assembler output
// ---------------------------------------------------------------------------

export interface AssemblerResult {
  config: XrayConfig;
  /** All files to write (from all inbound modules) */
  files: { name: string; content: string }[];
  /** All client nodes (for README / share links) */
  clientNodes: InboundResult["clientNode"][];
}

// ---------------------------------------------------------------------------
// Assemble
// ---------------------------------------------------------------------------

export function assembleXrayConfig(input: AssemblerInput): AssemblerResult {
  const skeleton = buildSkeleton({
    logLevel: input.logLevel,
    routingPreset: input.routingPreset,
  });

  const inbounds: XrayInbound[] = [];
  const files: AssemblerResult["files"] = [];
  const clientNodes: AssemblerResult["clientNodes"] = [];

  for (const spec of input.inbounds) {
    const mod = getModule(spec.moduleId);
    const result = mod.build(input.ctx, spec.options);
    inbounds.push(result.inbound);
    if (result.files) files.push(...result.files);
    clientNodes.push(result.clientNode);
  }

  const config: XrayConfig = {
    ...skeleton,
    inbounds,
  };

  return { config, files, clientNodes };
}
