import { randomBytes } from "node:crypto";

/** Matches a Reality shortId: even-length hex, 0–16 chars. */
export const SHORTID_REGEX = /^(?:[0-9a-f]{2}){0,8}$/;

export function isValidShortId(id: string): boolean {
  return SHORTID_REGEX.test(id);
}

export interface ShortIdOptions {
  /** Number of ids to generate. Default 1. */
  count?: number;
  /** Bytes per id (each byte → 2 hex chars). Must be 1..8. Default 4 (8 hex). */
  bytes?: number;
  /** Include the empty-string "match any" sentinel at the end. Default false. */
  includeEmpty?: boolean;
}

/** Generates Reality shortIds (hex, even length, ≤16 chars). */
export function generateShortIds(opts: ShortIdOptions = {}): string[] {
  const count = opts.count ?? 1;
  const bytes = opts.bytes ?? 4;
  if (bytes < 1 || bytes > 8) {
    throw new RangeError(`bytes must be 1..8, got ${bytes}`);
  }
  const ids = Array.from({ length: count }, () =>
    randomBytes(bytes).toString("hex")
  );
  if (opts.includeEmpty) ids.push("");
  return ids;
}
