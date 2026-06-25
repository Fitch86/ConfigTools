import { randomBytes } from "node:crypto";

/** Base64url random password (default 24 bytes). Forward-compat for sing-box/Shadowsocks. */
export function generatePassword(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}
