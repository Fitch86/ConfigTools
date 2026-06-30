/**
 * Xray engine — public API.
 *
 * Re-exports the assembler, registry, types, and module-api
 * so consumers can build configs and access modules programmatically.
 */

export { assembleXrayConfig, type AssemblerInput, type AssemblerResult, type InboundSpec } from "./assembler.js";
export { getModule, getModuleIds, getAllModules } from "./registry.js";
export { buildSkeleton, type RoutingPreset, type SkeletonOptions } from "./skeleton.js";
export type { InboundModule, BuildContext, InboundResult, ClientNode, PromptSpec } from "./module-api.js";
export type * from "./types.js";
