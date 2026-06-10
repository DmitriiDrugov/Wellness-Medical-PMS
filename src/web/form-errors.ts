// src/web/form-errors.ts
import { ApiError } from "@/web/api-client";

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

export interface MutationErrorState {
  /** Banner message, or null when the error is fully expressed via fieldErrors. */
  error: string | null;
  fieldErrors: Record<string, string>;
}

/**
 * Classify a thrown mutation error into form display state.
 *
 * A 422 carries two distinct shapes: Zod schema failures (per-field messages) and
 * domain ValidationErrors (no `fieldErrors` — just a message, e.g. "Treatment
 * requires a SAUNA resource"). The latter must still surface as a banner; otherwise
 * the submit fails silently and the user sees nothing happen.
 */
export function classifyMutationError(err: unknown): MutationErrorState {
  if (err instanceof ApiError) {
    if (err.status === 422) {
      const fieldErrors = toFieldErrors(err.details);
      if (Object.keys(fieldErrors).length > 0) return { error: null, fieldErrors };
      // 422 without field details = domain ValidationError: show its message.
      return { error: err.message, fieldErrors: {} };
    }
    return { error: err.message, fieldErrors: {} };
  }
  return { error: "Something went wrong. Please try again.", fieldErrors: {} };
}
