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
    <header className="flex h-16 items-center justify-between border-b border-outline-variant/60 bg-surface px-6">
      <div className="relative w-full max-w-md">
        <Icon
          name="search"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-outline"
        />
        <input className="input pl-10" placeholder="Search guests, reservations…" disabled />
      </div>

      <div className="flex items-center gap-4">
        <button className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container">
          <Icon name="notifications" />
        </button>
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
            {initials(user.firstName, user.lastName)}
          </span>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold leading-tight text-on-surface">
              {fullName(user.firstName, user.lastName)}
            </p>
            <p className="text-xs text-on-surface-variant">{ROLE_LABEL[user.role] ?? user.role}</p>
          </div>
          <button
            onClick={() => logout()}
            title="Sign out"
            className="grid h-9 w-9 place-items-center rounded-full text-on-surface-variant hover:bg-surface-container"
          >
            <Icon name="logout" />
          </button>
        </div>
      </div>
    </header>
  );
}
