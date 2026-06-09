// src/web/use-mutation.ts
"use client";

import { useCallback, useState } from "react";
import { ApiError } from "@/web/api-client";
import { toFieldErrors } from "@/web/form-errors";

/**
 * Runs a single async API call, exposing submitting/error state. On a 422 it maps
 * field errors via toFieldErrors; any other ApiError surfaces its message; unknown
 * errors get a generic message. `submit` resolves to the call result, or `undefined`
 * if it failed (so callers can `if (!result) return;`).
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
      if (err instanceof ApiError && err.status === 422) {
        setFieldErrors(toFieldErrors(err.details));
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
      return undefined;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { submit, submitting, error, fieldErrors, reset };
}
