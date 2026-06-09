"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/web/auth-context";
import { ApiError } from "@/web/api-client";
import { Icon } from "@/web/components/ui";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-surface-container-low px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-xl bg-primary text-on-primary">
            <Icon name="spa" className="text-[28px]" />
          </span>
          <h1 className="mt-4 text-xl font-semibold text-on-surface">Sanctuary PMS</h1>
          <p className="text-sm text-on-surface-variant">Medical Wellness Administration</p>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4 p-6">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-error-container/60 px-3 py-2 text-sm text-on-error-container">
              <Icon name="error" className="text-[18px]" />
              {error}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-on-surface-variant">Email Address</label>
            <div className="relative">
              <Icon
                name="mail"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-outline"
              />
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input pl-10"
                placeholder="you@sanctuary.com"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-on-surface-variant">Password</label>
            <div className="relative">
              <Icon
                name="lock"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-outline"
              />
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input px-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant"
              >
                <Icon name={showPassword ? "visibility" : "visibility_off"} className="text-[20px]" />
              </button>
            </div>
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Signing in…" : "Access Dashboard"}
            <Icon name="arrow_forward" className="text-[20px]" />
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-on-surface-variant">Need assistance? Contact IT Support</p>
      </div>
    </div>
  );
}
