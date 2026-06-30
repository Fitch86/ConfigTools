/**
 * JSON formatter — pretty-print with stable key sort.
 *
 * Produces deterministic JSON output so `format ∘ format === format`
 * (idempotency). Keys are sorted alphabetically at every nesting level,
 * which minimizes diff noise and makes `configtools format` safe to run
 * repeatedly.
 */

/**
 * Format a JSON-parseable value into a stable, pretty-printed string.
 *
 * @param value — any JSON value (typically parsed from a config file)
 * @param indent — indentation string (default: 2 spaces)
 */
export function formatJson(value: unknown, indent: string = "  "): string {
  return stableStringify(value, indent, 0);
}

/**
 * Format a JSON string in place (parse + re-format).
 * Throws on invalid JSON.
 */
export function formatJsonString(jsonString: string, indent?: string): string {
  const parsed = JSON.parse(jsonString);
  return formatJson(parsed, indent);
}

// ---------------------------------------------------------------------------
// Stable stringify (sorted keys, deterministic output)
// ---------------------------------------------------------------------------

function stableStringify(value: unknown, indent: string, depth: number): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value.toString();
  if (typeof value === "number") return isFinite(value) ? JSON.stringify(value) : "null";
  if (typeof value === "string") return JSON.stringify(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map(item =>
      `${indent.repeat(depth + 1)}${stableStringify(item, indent, depth + 1)}`
    );
    return `[\n${items.join(",\n")}\n${indent.repeat(depth)}]`;
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    if (keys.length === 0) return "{}";
    const entries = keys.map(key => {
      const val = obj[key];
      return `${indent.repeat(depth + 1)}${JSON.stringify(key)}: ${stableStringify(val, indent, depth + 1)}`;
    });
    return `{\n${entries.join(",\n")}\n${indent.repeat(depth)}}`;
  }

  // Fallback (shouldn't happen for valid JSON)
  return JSON.stringify(value);
}
