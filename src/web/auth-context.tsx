"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  clearTokens,
  getStoredAccessToken,
  setTokens,
  setUnauthenticatedHandler,
} from "@/web/api-client";

export type Role =
  | "RECEPTION"
  | "RESERVATION_ADMIN"
  | "THERAPIST"
  | "HOUSEKEEPING"
  | "MANAGER"
  | "ADMIN";

export interface StaffProfile {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  isActive: boolean;
  propertyId: string;
}

interface AuthState {
  user: StaffProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<StaffProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Load the current profile if we already hold a token (page refresh / revisit).
  useEffect(() => {
    let active = true;
    setUnauthenticatedHandler(() => {
      clearTokens();
      setUser(null);
      router.replace("/login");
    });
    (async () => {
      if (!getStoredAccessToken()) {
        if (active) setLoading(false);
        return;
      }
      try {
        const { data } = await api.get<StaffProfile>("/api/me");
        if (active) setUser(data);
      } catch {
        clearTokens();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{ accessToken: string; refreshToken: string }>("/api/auth/login", {
      email,
      password,
    });
    setTokens(data);
    const me = await api.get<StaffProfile>("/api/me");
    setUser(me.data);
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = (await import("@/web/api-client")).getStoredRefreshToken();
    try {
      if (refreshToken) await api.post("/api/auth/logout", { refreshToken });
    } catch {
      /* best-effort */
    }
    clearTokens();
    setUser(null);
    router.replace("/login");
  }, [router]);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
