import { randomUUID } from "node:crypto";

/** RFC4122 version 4 UUID. */
export function generateUuid(): string {
  return randomUUID();
}

/** Matches a canonical RFC4122 v4 UUID. */
export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
