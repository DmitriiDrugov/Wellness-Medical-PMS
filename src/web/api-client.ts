/**
 * Browser API client for the PMS REST backend. Understands the response envelope
 * ({ data, error, meta? }), injects the Bearer access token, and transparently
 * rotates an expired access token via /api/auth/refresh once before failing.
 *
 * Token state lives in localStorage and is owned by the AuthProvider, which calls
 * `setTokens` / `clearTokens`. Keeping a module singleton lets any component call
 * `api.get(...)` without threading the token through props.
 */

export interface ListMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiResult<T> {
  data: T;
  meta?: ListMeta;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const ACCESS_KEY = "pms.accessToken";
const REFRESH_KEY = "pms.refreshToken";

let accessToken: string | null = null;
let refreshToken: string | null = null;
let onUnauthenticated: (() => void) | null = null;

function loadFromStorage() {
  if (typeof window === "undefined") return;
  accessToken = window.localStorage.getItem(ACCESS_KEY);
  refreshToken = window.localStorage.getItem(REFRESH_KEY);
}
loadFromStorage();

export function setTokens(tokens: { accessToken: string; refreshToken: string }) {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  }
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  }
}

export function getStoredAccessToken(): string | null {
  if (accessToken === null) loadFromStorage();
  return accessToken;
}

export function getStoredRefreshToken(): string | null {
  if (refreshToken === null) loadFromStorage();
  return refreshToken;
}

/** Called by AuthProvider so the client can redirect to /login when refresh fails. */
export function setUnauthenticatedHandler(fn: () => void) {
  onUnauthenticated = fn;
}

async function parseEnvelope<T>(res: Response): Promise<ApiResult<T>> {
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : null;
  if (!res.ok || (body && body.error)) {
    const err = body?.error ?? { code: "HTTP_ERROR", message: res.statusText };
    throw new ApiError(res.status, err.code, err.message, err.details);
  }
  return { data: (body?.data ?? null) as T, meta: body?.meta };
}

async function doRefresh(): Promise<boolean> {
  const rt = getStoredRefreshToken();
  if (!rt) return false;
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken: rt }),
    });
    const { data } = await parseEnvelope<{ accessToken: string; refreshToken: string }>(res);
    setTokens(data);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

/**
 * Single-flight refresh. Refresh tokens rotate (the presented one is revoked), so
 * concurrent 401s must share ONE refresh call — a second parallel attempt would
 * present the just-revoked token, fail, and wipe the freshly issued pair.
 */
let refreshInFlight: Promise<boolean> | null = null;
function tryRefresh(): Promise<boolean> {
  refreshInFlight ??= doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  const token = getStoredAccessToken();
  if (token) headers["authorization"] = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";

  const res = await fetch(path, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(method, path, body, false);
    onUnauthenticated?.();
  }
  return parseEnvelope<T>(res);
}

function qs(params?: Record<string, string | number | undefined | null>): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const api = {
  get: <T>(path: string, params?: Record<string, string | number | undefined | null>) =>
    request<T>("GET", path + qs(params)),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body ?? {}),
  del: <T>(path: string) => request<T>("DELETE", path),
};
