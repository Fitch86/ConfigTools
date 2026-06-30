/**
 * Xray config validator — two-layer validation.
 *
 * Layer 1: JSON Schema (structural, powered by ajv)
 * Layer 2: Business rules (semantic, pure functions)
 */

import AjvDefault from "ajv";
import addFormatsDefault from "ajv-formats";
import { xrayConfigSchema } from "../engines/xray/schema.js";
import { applyBusinessRules, type ValidationIssue } from "./rules.js";
import type { XrayConfig } from "../engines/xray/types.js";

// Handle ESM default interop
const AjvCtor = (AjvDefault as any).default ?? AjvDefault;  // eslint-disable-line @typescript-eslint/no-explicit-any
const addFormatsFn = (addFormatsDefault as any).default ?? addFormatsDefault;  // eslint-disable-line @typescript-eslint/no-explicit-any

// ---------------------------------------------------------------------------
// Validate result
// ---------------------------------------------------------------------------

export interface ValidateResult {
  valid: boolean;
  issues: ValidationIssue[];
}

// ---------------------------------------------------------------------------
// Schema validator (singleton)
// ---------------------------------------------------------------------------

let ajvInstance: any = null;  // eslint-disable-line @typescript-eslint/no-explicit-any

function getAjv(): any {  // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!ajvInstance) {
    ajvInstance = new AjvCtor({ allErrors: true, strict: false });
    addFormatsFn(ajvInstance);
    ajvInstance.addSchema(xrayConfigSchema);
  }
  return ajvInstance;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate an Xray config object.
 *
 * Runs JSON Schema validation first, then business rules only if
 * schema validation passes (to avoid noise from structurally-invalid data).
 *
 * @param config — parsed Xray config object
 * @param projectDir — optional project dir path for file-existence checks
 */
export function validateXrayConfig(config: unknown, projectDir?: string): ValidateResult {
  const issues: ValidationIssue[] = [];

  // Layer 1: JSON Schema
  const ajv = getAjv();
  const isValid = ajv.validate(xrayConfigSchema, config);

  if (!isValid && ajv.errors) {
    for (const err of ajv.errors) {
      issues.push({
        level: "error",
        path: err.instancePath || "/",
        message: err.message ?? "Schema validation failed",
        hint: err.schemaPath
          ? `Schema: ${err.schemaPath}`
          : undefined,
      });
    }
    // Don't run business rules on structurally-invalid data
    return { valid: false, issues };
  }

  // Layer 2: Business rules
  const businessIssues = applyBusinessRules(config as XrayConfig, projectDir);
  issues.push(...businessIssues);

  const hasErrors = issues.some(i => i.level === "error");
  return { valid: !hasErrors, issues };
}
