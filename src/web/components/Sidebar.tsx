"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { visibleNav } from "@/web/nav";
import type { Role } from "@/web/auth-context";
import { Icon } from "@/web/components/ui";

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = visibleNav(role);

  return (
    <aside className="flex h-full w-sidebar flex-col border-r border-outline-variant/60 bg-surface-container-low">
      <div className="flex items-center gap-3 px-6 py-5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-on-primary">
          <Icon name="spa" />
        </span>
        <div>
          <p className="text-sm font-semibold leading-tight text-on-surface">Sanctuary PMS</p>
          <p className="text-xs text-on-surface-variant">Medical Wellness</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-disabled={item.stub}
              className={[
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
              ].join(" ")}
            >
              {active && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-primary" />}
              <Icon name={item.icon} className="text-[20px]" />
              <span className="flex-1">{item.label}</span>
              {item.stub && (
                <span className="rounded-full bg-surface-container-high px-1.5 py-0.5 text-[10px] font-semibold uppercase text-on-surface-variant">
                  soon
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
