export const VERSION = "0.1.0";

// Re-export public API for programmatic use
export { assembleXrayConfig, type AssemblerInput, type AssemblerResult, type InboundSpec } from "./engines/xray/assembler.js";
export { getModule, getModuleIds, getAllModules } from "./engines/xray/registry.js";
export type { InboundModule, BuildContext, InboundResult, ClientNode, PromptSpec } from "./engines/xray/module-api.js";
export type * from "./engines/xray/types.js";
export { validateXrayConfig, type ValidateResult } from "./validate/index.js";
export type { ValidationIssue } from "./validate/rules.js";
export { formatJson, formatJsonString } from "./format/json.js";
export { generateUuid } from "./crypto/uuid.js";
export { generateRealityKeyPair } from "./crypto/reality-keys.js";
export { generateShortIds, isValidShortId } from "./crypto/short-id.js";
export { generatePassword } from "./crypto/password.js";
export { generateSelfSignedCert } from "./cert/self-signed.js";
