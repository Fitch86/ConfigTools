/**
 * Business validation rules for Xray configs.
 *
 * These are semantic checks beyond what JSON Schema validates.
 * Each rule is a pure function that inspects the config and returns
 * zero or more ValidationIssues.
 */

import type { XrayConfig, XrayInbound, XrayRealitySettings } from "../engines/xray/types.js";
import { UUID_REGEX } from "../crypto/uuid.js";
import { SHORTID_REGEX } from "../crypto/short-id.js";

// ---------------------------------------------------------------------------
// Issue type
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  level: "error" | "warning";
  path: string;
  message: string;
  hint?: string;
}

// ---------------------------------------------------------------------------
// All business rules
// ---------------------------------------------------------------------------

export function applyBusinessRules(config: XrayConfig, projectDir?: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const rule of rules) {
    issues.push(...rule(config, projectDir));
  }
  return issues;
}

type Rule = (config: XrayConfig, projectDir?: string) => ValidationIssue[];

const rules: Rule[] = [
  rulePortRange,
  rulePrivilegedPort,
  ruleUuidFormat,
  ruleRealityDest,
  ruleRealityServerNames,
  ruleRealityPrivateKeyLength,
  ruleShortIdsFormat,
  ruleDuplicatePorts,
  ruleRoutingTagRefs,
];

// ---------------------------------------------------------------------------
// Individual rules
// ---------------------------------------------------------------------------

function rulePortRange(config: XrayConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (let i = 0; i < config.inbounds.length; i++) {
    const port = config.inbounds[i].port;
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      issues.push({
        level: "error",
        path: `inbounds[${i}].port`,
        message: `Port ${port} is out of range (1–65535)`,
        hint: "Use a port between 1 and 65535",
      });
    }
  }
  return issues;
}

function rulePrivilegedPort(config: XrayConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (let i = 0; i < config.inbounds.length; i++) {
    const port = config.inbounds[i].port;
    if (Number.isInteger(port) && port >= 1 && port < 1024) {
      issues.push({
        level: "warning",
        path: `inbounds[${i}].port`,
        message: `Port ${port} is a privileged port (<1024), requires root/CAP_NET_BIND_SERVICE`,
        hint: "Consider using a non-privileged port (≥1024)",
      });
    }
  }
  return issues;
}

function ruleUuidFormat(config: XrayConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (let i = 0; i < config.inbounds.length; i++) {
    const inbound = config.inbounds[i];
    const clients = inbound.settings?.clients;
    if (!clients) continue;
    for (let j = 0; j < clients.length; j++) {
      const id = clients[j].id;
      if (!UUID_REGEX.test(id)) {
        issues.push({
          level: "error",
          path: `inbounds[${i}].settings.clients[${j}].id`,
          message: `"${id}" is not a valid RFC4122 v4 UUID`,
          hint: "Run `configtools edit` to regenerate the UUID",
        });
      }
    }
  }
  return issues;
}

function ruleRealityDest(config: XrayConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (let i = 0; i < config.inbounds.length; i++) {
    const rs = getRealitySettings(config.inbounds[i]);
    if (!rs) continue;
    if (!rs.dest || typeof rs.dest !== "string") {
      issues.push({
        level: "error",
        path: `inbounds[${i}].streamSettings.realitySettings.dest`,
        message: "Reality dest is missing or empty",
        hint: 'Set dest to "host:port" (e.g. "www.microsoft.com:443")',
      });
    } else if (!/^.+:\d+$/.test(rs.dest) && !/^\d+$/.test(rs.dest)) {
      issues.push({
        level: "error",
        path: `inbounds[${i}].streamSettings.realitySettings.dest`,
        message: `Reality dest "${rs.dest}" is not in host:port or port-only format`,
        hint: 'Use "host:port" format (e.g. "www.microsoft.com:443")',
      });
    }
  }
  return issues;
}

function ruleRealityServerNames(config: XrayConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (let i = 0; i < config.inbounds.length; i++) {
    const rs = getRealitySettings(config.inbounds[i]);
    if (!rs) continue;
    if (!rs.serverNames || rs.serverNames.length === 0) {
      issues.push({
        level: "error",
        path: `inbounds[${i}].streamSettings.realitySettings.serverNames`,
        message: "Reality serverNames is empty",
        hint: "Add at least one domain that appears in the dest target's certificate",
      });
    }
  }
  return issues;
}

function ruleRealityPrivateKeyLength(config: XrayConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (let i = 0; i < config.inbounds.length; i++) {
    const rs = getRealitySettings(config.inbounds[i]);
    if (!rs) continue;
    try {
      const buf = Buffer.from(rs.privateKey, "base64url");
      if (buf.length !== 32) {
        issues.push({
          level: "error",
          path: `inbounds[${i}].streamSettings.realitySettings.privateKey`,
          message: `Reality privateKey decodes to ${buf.length} bytes, expected 32`,
          hint: "Regenerate the Reality keypair with `configtools edit`",
        });
      }
    } catch {
      issues.push({
        level: "error",
        path: `inbounds[${i}].streamSettings.realitySettings.privateKey`,
        message: "Reality privateKey is not valid base64url",
        hint: "Regenerate the Reality keypair with `configtools edit`",
      });
    }
  }
  return issues;
}

function ruleShortIdsFormat(config: XrayConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (let i = 0; i < config.inbounds.length; i++) {
    const rs = getRealitySettings(config.inbounds[i]);
    if (!rs) continue;
    for (let j = 0; j < rs.shortIds.length; j++) {
      const sid = rs.shortIds[j];
      if (!SHORTID_REGEX.test(sid)) {
        issues.push({
          level: "error",
          path: `inbounds[${i}].streamSettings.realitySettings.shortIds[${j}]`,
          message: `"${sid}" is not a valid shortId (hex, even length, ≤16 chars)`,
          hint: "Use hex digits with even length, e.g. 'abcdef12'",
        });
      }
    }
  }
  return issues;
}

function ruleDuplicatePorts(config: XrayConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Map<number, number>(); // port → first inbound index
  for (let i = 0; i < config.inbounds.length; i++) {
    const port = config.inbounds[i].port;
    const first = seen.get(port);
    if (first !== undefined) {
      issues.push({
        level: "error",
        path: `inbounds[${i}].port`,
        message: `Port ${port} is also used by inbounds[${first}]`,
        hint: "Each inbound must use a unique port",
      });
    } else {
      seen.set(port, i);
    }
  }
  return issues;
}

function ruleRoutingTagRefs(config: XrayConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!config.routing?.rules) return issues;

  const outboundTags = new Set(config.outbounds.map(o => o.tag));
  const inboundTags = new Set(config.inbounds.map(ib => ib.tag));

  for (let i = 0; i < config.routing.rules.length; i++) {
    const rule = config.routing.rules[i];
    if (rule.outboundTag && !outboundTags.has(rule.outboundTag)) {
      issues.push({
        level: "error",
        path: `routing.rules[${i}].outboundTag`,
        message: `"${rule.outboundTag}" does not match any outbound tag`,
        hint: "Make sure the outbound tag exists in outbounds[]",
      });
    }
    if (rule.inboundTag) {
      for (const tag of rule.inboundTag) {
        if (!inboundTags.has(tag)) {
          issues.push({
            level: "error",
            path: `routing.rules[${i}].inboundTag`,
            message: `"${tag}" does not match any inbound tag`,
            hint: "Make sure the inbound tag exists in inbounds[]",
          });
        }
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRealitySettings(inbound: XrayInbound): XrayRealitySettings | undefined {
  if (inbound.streamSettings?.security !== "reality") return undefined;
  return inbound.streamSettings.realitySettings;
}
