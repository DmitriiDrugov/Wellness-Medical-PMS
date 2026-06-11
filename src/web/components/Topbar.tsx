"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/web/auth-context";
import { visibleGroups, type NavGroup, type NavItem } from "@/web/nav";
import { Icon } from "@/web/components/ui";
import { fullName, initials } from "@/web/format";

const ROLE_LABEL: Record<string, string> = {
  RECEPTION: "Reception",
  RESERVATION_ADMIN: "Reservation Admin",
  THERAPIST: "Therapist",
  HOUSEKEEPING: "Housekeeping",
  MANAGER: "Manager",
  ADMIN: "Administrator",
};

function isItemActive(item: NavItem, pathname: string): boolean {
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

function isGroupActive(group: NavGroup, pathname: string): boolean {
  return group.items.some((i) => isItemActive(i, pathname));
}

/**
 * App header: brand, grouped top navigation (one dropdown per branch of the IA),
 * and the user cluster. Single-item groups render as a plain link; multi-item
 * groups open a menu on click and close on outside click, Escape, or navigation.
 */
export function Topbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  // The nav strip scrolls horizontally on narrow screens, and an overflow container
  // clips ANY overflow — an absolutely-positioned child menu included. So the menu
  // is fixed-positioned at the trigger's viewport coordinates instead.
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const navRef = useRef<HTMLElement>(null);

  function toggleGroup(label: string, trigger: HTMLElement) {
    if (openGroup === label) {
      setOpenGroup(null);
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const MENU_WIDTH = 224; // w-56
    setMenuPos({
      left: Math.max(8, Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8)),
      top: rect.bottom + 6,
    });
    setOpenGroup(label);
  }

  // Close the open menu on outside click, Escape, resize, or nav scroll.
  useEffect(() => {
    if (!openGroup) return;
    function onPointerDown(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenGroup(null);
    }
    const close = () => setOpenGroup(null);
    const nav = navRef.current;
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    nav?.addEventListener("scroll", close);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      nav?.removeEventListener("scroll", close);
    };
  }, [openGroup]);

  // Close on navigation.
  useEffect(() => setOpenGroup(null), [pathname]);

  if (!user) return null;
  const groups = visibleGroups(user.role);

  return (
    <header className="flex h-16 flex-shrink-0 items-center gap-6 border-b border-outline-variant bg-surface px-6">
      {/* Brand */}
      <Link href="/dashboard" className="flex flex-shrink-0 items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-on-primary shadow-xs">
          <Icon name="spa" className="text-[20px]" />
        </span>
        <span className="hidden leading-tight lg:block">
          <span className="block text-sm font-semibold text-on-surface">Sanctuary PMS</span>
          <span className="block text-xs text-on-surface-variant">Medical Wellness</span>
        </span>
      </Link>

      {/* Grouped navigation */}
      <nav ref={navRef} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" aria-label="Primary">
        {groups.map((group) => {
          const single = group.items.length === 1;
          const active = isGroupActive(group, pathname);
          if (single) {
            const item = group.items[0]!;
            return (
              <Link
                key={group.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex flex-shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
                ].join(" ")}
              >
                <Icon name={group.icon} className="text-[18px]" />
                {group.label}
              </Link>
            );
          }
          const open = openGroup === group.label;
          return (
            <div key={group.label} className="flex-shrink-0">
              <button
                aria-expanded={open}
                aria-haspopup="menu"
                onClick={(e) => toggleGroup(group.label, e.currentTarget)}
                className={[
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-primary/10 text-primary"
                    : open
                      ? "bg-surface-container-low text-on-surface"
                      : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
                ].join(" ")}
              >
                <Icon name={group.icon} className="text-[18px]" />
                {group.label}
                <Icon
                  name="chevron_right"
                  className={`text-[16px] transition-transform duration-150 ${open ? "-rotate-90" : "rotate-90"}`}
                />
              </button>
              {open && menuPos && (
                <div
                  role="menu"
                  style={{ left: menuPos.left, top: menuPos.top }}
                  className="fixed z-50 w-56 rounded-lg border border-outline-variant bg-surface p-1.5 shadow-lg"
                >
                  {group.items.map((item) => {
                    const itemActive = isItemActive(item, pathname);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        role="menuitem"
                        aria-disabled={item.stub}
                        aria-current={itemActive ? "page" : undefined}
                        className={[
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
                          itemActive
                            ? "bg-primary/10 text-primary"
                            : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
                        ].join(" ")}
                      >
                        <Icon name={item.icon} className="text-[18px]" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.stub && (
                          <span className="rounded-full bg-surface-container px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                            soon
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User cluster */}
      <div className="flex flex-shrink-0 items-center gap-3">
        <button className="grid h-10 w-10 place-items-center rounded-lg text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface">
          <Icon name="notifications" className="text-[20px]" />
        </button>
        <div className="h-6 w-px bg-outline-variant" />
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {initials(user.firstName, user.lastName)}
          </span>
          <div className="hidden leading-tight xl:block">
            <p className="text-sm font-semibold text-on-surface">{fullName(user.firstName, user.lastName)}</p>
            <p className="text-xs text-on-surface-variant">{ROLE_LABEL[user.role] ?? user.role}</p>
          </div>
          <button
            onClick={() => logout()}
            title="Sign out"
            className="grid h-9 w-9 place-items-center rounded-lg text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface"
          >
            <Icon name="logout" className="text-[18px]" />
          </button>
        </div>
      </div>
    </header>
  );
}
