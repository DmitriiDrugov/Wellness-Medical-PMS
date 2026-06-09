// src/web/form-errors.ts
/**
 * Flattens the `error.details` of a 422 response (Zod's `flatten()` shape:
 * `{ formErrors, fieldErrors }`) into `{ field: firstMessage }` for form display.
 * Tolerant of missing/odd shapes — always returns a plain object.
 */
export function toFieldErrors(details: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (details && typeof details === "object" && "fieldErrors" in details) {
    const fe = (details as { fieldErrors?: Record<string, string[]> }).fieldErrors ?? {};
    for (const [key, msgs] of Object.entries(fe)) {
      if (Array.isArray(msgs) && msgs.length > 0) out[key] = msgs[0]!;
    }
  }
  return out;
}
