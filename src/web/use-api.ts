"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, type ApiResult } from "@/web/api-client";

interface QueryState<T> {
  data: T | null;
  meta?: ApiResult<T>["meta"];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Run an async API call on mount and whenever a dependency changes. The fetcher
 * should return the raw ApiResult from the api client.
 */
export function useApi<T>(fetcher: () => Promise<ApiResult<T>>, deps: unknown[] = []): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [meta, setMeta] = useState<ApiResult<T>["meta"]>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetcher()
      .then((res) => {
        if (!active) return;
        setData(res.data);
        setMeta(res.meta);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof ApiError ? err.message : "Failed to load data");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, meta, loading, error, reload };
}
