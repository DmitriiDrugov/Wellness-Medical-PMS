// src/web/use-mutation.ts
"use client";

import { useCallback, useState } from "react";
import { classifyMutationError } from "@/web/form-errors";

/**
 * Runs a single async API call, exposing submitting/error state. Errors are routed
 * through classifyMutationError: Zod 422s map to field errors, domain ValidationErrors
 * and other ApiErrors surface as a banner message, unknown errors get a generic one.
 * `submit` resolves to the call result, or `undefined` if it failed (so callers can
 * `if (!result) return;`).
 */
export function useMutation() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const reset = useCallback(() => {
    setError(null);
    setFieldErrors({});
  }, []);

  const submit = useCallback(async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      return await fn();
    } catch (err) {
      const { error, fieldErrors } = classifyMutationError(err);
      setError(error);
      setFieldErrors(fieldErrors);
      return undefined;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { submit, submitting, error, fieldErrors, reset };
}
