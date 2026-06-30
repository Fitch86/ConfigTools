/**
 * Inbound module registry.
 *
 * Maps module IDs to their implementations. The CLI and assembler use this
 * to look up modules chosen by the user.
 */

import type { AnyInboundModule } from "./module-api.js";
import { realityModule } from "./inbounds/reality.js";
import { vlessWsModule } from "./inbounds/vless-ws.js";
import { vlessGrpcModule } from "./inbounds/vless-grpc.js";

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const modules: AnyInboundModule[] = [
  realityModule as unknown as AnyInboundModule,
  vlessWsModule as unknown as AnyInboundModule,
  vlessGrpcModule as unknown as AnyInboundModule,
];

const registry = new Map<string, AnyInboundModule>();

for (const mod of modules) {
  registry.set(mod.id, mod);
}

/** Look up a module by ID. Throws if not found. */
export function getModule(id: string): AnyInboundModule {
  const mod = registry.get(id);
  if (!mod) throw new Error(`Unknown inbound module: "${id}"`);
  return mod;
}

/** All available module IDs */
export function getModuleIds(): string[] {
  return [...registry.keys()];
}

/** All registered modules (for prompts listing) */
export function getAllModules(): AnyInboundModule[] {
  return [...registry.values()];
}
