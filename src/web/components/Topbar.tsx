"use client";

import { useAuth } from "@/web/auth-context";
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

export function Topbar() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-outline-variant bg-surface px-6">
      <div className="relative w-full max-w-md">
        <Icon
          name="search"
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-outline"
        />
        <input className="input pl-10" placeholder="Search guests, reservations…" disabled />
      </div>

      <div className="flex items-center gap-3">
        <button className="grid h-10 w-10 place-items-center rounded-lg text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface">
          <Icon name="notifications" className="text-[20px]" />
        </button>
        <div className="h-6 w-px bg-outline-variant" />
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {initials(user.firstName, user.lastName)}
          </span>
          <div className="hidden leading-tight sm:block">
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
