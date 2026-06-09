"use client";

import { useMemo, useState } from "react";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import type { Reservation } from "@/web/types";
import { PageHeader, Card, Icon, DataState } from "@/web/components/ui";
import { fullName } from "@/web/format";

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function pad(n: number): string {
  return String(n).padStart(2, "0");
}
/** Local calendar-date key (avoids the UTC off-by-one that toISOString causes). */
function localKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Whole-day offset of an ISO/`YYYY-MM-DD` date from the week's Monday. */
function dayOffset(dateStr: string, weekStart: Date): number {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  const date = Date.UTC(y!, m! - 1, d!);
  const base = Date.UTC(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
  return Math.round((date - base) / 86_400_000);
}

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface RoomRow {
  key: string;
  label: string;
  bookings: Reservation[];
}

export default function ReservationsPage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const from = localKey(weekStart);
  const to = localKey(addDays(weekStart, 7));

  const { data, loading, error } = useApi<Reservation[]>(
    () => api.get<Reservation[]>("/api/reservations", { from, to, pageSize: 100 }),
    [from, to],
  );
  const reservations = data ?? [];

  // Group bookings into room rows (derived from the bookings in view — no rooms-list endpoint yet).
  const rows: RoomRow[] = useMemo(() => {
    const map = new Map<string, RoomRow>();
    for (const r of reservations) {
      const key = r.room?.number ? `room:${r.room.number}` : `unassigned:${r.roomType?.name ?? "—"}`;
      const label = r.room ? `Room ${r.room.number}` : `Unassigned · ${r.roomType?.name ?? ""}`;
      if (!map.has(key)) map.set(key, { key, label, bookings: [] });
      map.get(key)!.bookings.push(r);
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [reservations]);

  return (
    <div>
      <PageHeader
        title="Reservations Calendar"
        subtitle="Room allocations and guest stays for the week."
        actions={
          <button className="btn-primary">
            <Icon name="add" className="text-[20px]" /> New Reservation
          </button>
        }
      />

      <Card className="mb-4 flex items-center gap-3 p-3">
        <button className="btn-ghost" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          <Icon name="chevron_left" />
        </button>
        <button className="btn-ghost" onClick={() => setWeekStart(startOfWeek(new Date()))}>
          Today
        </button>
        <button className="btn-ghost" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          <Icon name="chevron_right" />
        </button>
        <span className="ml-2 text-sm font-medium text-on-surface">
          {weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
        </span>
      </Card>

      <Card className="p-0">
        <DataState loading={loading} error={error} empty={rows.length === 0} emptyLabel="No reservations in this week.">
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              {/* Header */}
              <div
                className="grid items-center border-b border-outline-variant/50 text-xs font-semibold uppercase tracking-wide text-on-surface-variant"
                style={{ gridTemplateColumns: "180px repeat(7, minmax(0,1fr))" }}
              >
                <div className="px-4 py-3">Room</div>
                {days.map((d, i) => (
                  <div key={i} className="border-l border-outline-variant/30 px-2 py-3 text-center">
                    {DOW[i]} <span className="text-on-surface">{d.getDate()}</span>
                  </div>
                ))}
              </div>

              {/* Room rows with continuous booking bars */}
              {rows.map((row) => (
                <div
                  key={row.key}
                  className="grid items-center border-b border-outline-variant/30"
                  style={{ gridTemplateColumns: "180px repeat(7, minmax(0,1fr))", minHeight: "52px" }}
                >
                  <div className="px-4 py-2 font-medium text-on-surface">{row.label}</div>

                  {/* Day separators (background grid lines) */}
                  {days.map((_, i) => (
                    <div
                      key={`sep-${i}`}
                      className="h-full border-l border-outline-variant/20"
                      style={{ gridColumn: i + 2, gridRow: 1 }}
                    />
                  ))}

                  {/* Booking bars overlaid on the same grid row */}
                  {row.bookings.map((b) => {
                    const startOff = dayOffset(b.checkInDate, weekStart);
                    const endOff = dayOffset(b.checkOutDate, weekStart); // checkout = exclusive
                    if (endOff <= 0 || startOff >= 7) return null; // outside the visible week
                    const startCol = Math.max(0, startOff) + 2;
                    const endCol = Math.min(7, endOff) + 2;
                    const clippedLeft = startOff < 0;
                    const clippedRight = endOff > 7;
                    return (
                      <div
                        key={b.id}
                        className="z-10 mx-1 self-center"
                        style={{ gridColumn: `${startCol} / ${endCol}`, gridRow: 1 }}
                      >
                        <div
                          title={`${fullName(b.guest?.firstName, b.guest?.lastName)} · ${b.status}`}
                          className={[
                            "flex items-center gap-1 truncate px-3 py-1.5 text-xs font-medium",
                            bookingTone(b.status),
                            clippedLeft ? "rounded-l-none" : "rounded-l-full",
                            clippedRight ? "rounded-r-none" : "rounded-r-full",
                          ].join(" ")}
                        >
                          {clippedLeft && <Icon name="chevron_left" className="text-[14px] opacity-70" />}
                          <span className="truncate">{fullName(b.guest?.firstName, b.guest?.lastName)}</span>
                          {clippedRight && <Icon name="chevron_right" className="ml-auto text-[14px] opacity-70" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </DataState>
      </Card>
      <p className="mt-4 text-xs text-on-surface-variant">
        Note: rows are derived from bookings in view. Showing every room (including empty ones) and flagging
        “online / pending” bookings need a rooms-list endpoint and the Phase 7 <code>source</code> field.
      </p>
    </div>
  );
}

function bookingTone(status: Reservation["status"]): string {
  switch (status) {
    case "CHECKED_IN":
      return "bg-success/20 text-success";
    case "CHECKED_OUT":
      return "bg-surface-container-high text-on-surface-variant";
    case "CANCELLED":
    case "NO_SHOW":
      return "bg-surface-container-high text-on-surface-variant line-through";
    default: // PENDING / CONFIRMED
      return "bg-primary/15 text-primary";
  }
}
