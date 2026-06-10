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
    <aside className="flex h-full w-sidebar flex-col border-r border-outline-variant bg-surface">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-on-primary shadow-xs">
          <Icon name="spa" className="text-[22px]" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-on-surface">Sanctuary PMS</p>
          <p className="text-xs text-on-surface-variant">Medical Wellness</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-disabled={item.stub}
              aria-current={active ? "page" : undefined}
              className={[
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
              ].join(" ")}
            >
              <Icon name={item.icon} className="text-[20px]" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.stub && (
                <span className="rounded-full bg-surface-container px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
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
