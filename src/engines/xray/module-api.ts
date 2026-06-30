/**
 * The shared interface that every inbound protocol module must implement.
 *
 * Modules are self-contained: they describe their options (schema + prompts)
 * and produce a complete inbound entry from a shared build context.
 */

import type { JSONSchemaType } from "ajv";
import type { XrayInbound } from "./types.js";

// ---------------------------------------------------------------------------
// Build context — secrets generated centrally, consumed by modules
// ---------------------------------------------------------------------------

export interface BuildContext {
  /** Shared client UUID (one per project) */
  uuid: string;
  /** Reality keypair — only present when a Reality inbound is chosen */
  realityKeyPair?: { privateKey: string; publicKey: string };
  /** Reality shortIds — only present when a Reality inbound is chosen */
  shortIds?: string[];
  /** Self-signed cert — only present when a WS/gRPC inbound is chosen */
  selfSignedCert?: { certPem: string; keyPem: string };
  /** Random password (forward-compat for v2 protocols) */
  password: string;
}

// ---------------------------------------------------------------------------
// Inbound module shape
// ---------------------------------------------------------------------------

export interface InboundModule<TOptions = Record<string, unknown>> {
  /** Unique registry key */
  id: string;
  /** Human-readable label shown in prompts */
  label: string;
  /** JSON Schema describing the per-inbound options */
  optionSchema: Record<string, unknown>;
  /** Prompt specification for each option field */
  prompts: PromptSpec[];
  /** Build one inbound entry from the shared context + per-inbound options */
  build(ctx: BuildContext, options: TOptions): InboundResult;
}

/** Type-erased inbound module stored in the registry */
export type AnyInboundModule = InboundModule<Record<string, unknown>>;

// ---------------------------------------------------------------------------
// Prompt specification
// ---------------------------------------------------------------------------

export type PromptSpec =
  | StringPromptSpec
  | NumberPromptSpec
  | SelectPromptSpec
  | ConfirmPromptSpec
  | MultiSelectPromptSpec;

interface BasePromptSpec {
  name: string;
  message: string;
  initial?: unknown;
}

export interface StringPromptSpec extends BasePromptSpec {
  type: "text";
}

export interface NumberPromptSpec extends BasePromptSpec {
  type: "number";
  min?: number;
  max?: number;
}

export interface SelectPromptSpec extends BasePromptSpec {
  type: "select";
  choices: { title: string; value: unknown }[];
}

export interface ConfirmPromptSpec extends BasePromptSpec {
  type: "confirm";
}

export interface MultiSelectPromptSpec extends BasePromptSpec {
  type: "multiselect";
  choices: { title: string; value: unknown }[];
}

// ---------------------------------------------------------------------------
// Inbound result — what build() returns
// ---------------------------------------------------------------------------

export interface InboundResult {
  /** One complete entry for config.inbounds[] */
  inbound: XrayInbound;
  /** Files to write alongside config (cert, key) */
  files?: { name: string; content: string }[];
  /** Client node info for README / share links */
  clientNode: ClientNode;
}

// ---------------------------------------------------------------------------
// Client node — printed in README / share links
// ---------------------------------------------------------------------------

export interface ClientNode {
  protocol: string;
  port: number;
  network: string;
  security: string;
  remarks?: string;
  extra?: Record<string, string>;
}
