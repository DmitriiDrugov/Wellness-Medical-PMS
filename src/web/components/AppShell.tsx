"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/web/auth-context";
import { Topbar } from "@/web/components/Topbar";
import { Icon } from "@/web/components/ui";

/** Authenticated layout: guards the route, then renders the top nav + page. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="grid h-screen place-items-center text-on-surface-variant">
        <span className="flex items-center gap-3">
          <Icon name="progress_activity" className="animate-spin" />
          Loading…
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Topbar />
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
