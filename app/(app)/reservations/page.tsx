"use client";

import { useMemo, useState } from "react";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import { useMutation } from "@/web/use-mutation";
import type { Reservation, RoomListItem } from "@/web/types";
import { PageHeader, Card, Icon, DataState } from "@/web/components/ui";
import { ConfirmDialog } from "@/web/components/ConfirmDialog";
import { fullName, formatDate } from "@/web/format";
import { ReservationFormModal } from "./ReservationFormModal";

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

  const { data, loading, error, reload } = useApi<Reservation[]>(
    () => api.get<Reservation[]>("/api/reservations", { from, to, pageSize: 100 }),
    [from, to],
  );
  const reservations = data ?? [];

  // Rooms list for assign-room picker
  const allRooms = useApi<RoomListItem[]>(() => api.get<RoomListItem[]>("/api/rooms"), []);

  // Modal / selection state
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Reservation | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [assignRoomId, setAssignRoomId] = useState<string>("");

  const action = useMutation();
  const cancelMutation = useMutation();

  async function lifecycle(id: string, op: "check-in" | "check-out") {
    const ok = await action.submit(() => api.post(`/api/reservations/${id}/${op}`));
    if (ok !== undefined) {
      setSelected(null);
      reload();
    }
  }
  async function doCancel() {
    if (!cancelTarget) return;
    const ok = await cancelMutation.submit(() => api.post(`/api/reservations/${cancelTarget.id}/cancel`));
    if (ok !== undefined) {
      setCancelTarget(null);
      setSelected(null);
      reload();
    }
  }
  async function assignRoom(id: string, roomId: string) {
    if (!roomId) return;
    const ok = await action.submit(() => api.post(`/api/reservations/${id}/assign-room`, { roomId }));
    if (ok !== undefined) {
      setAssignRoomId("");
      setSelected(null);
      reload();
    }
  }

  // Group bookings into room rows (derived from the bookings in view - no rooms-list endpoint yet).
  const rows: RoomRow[] = useMemo(() => {
    const map = new Map<string, RoomRow>();
    for (const r of reservations) {
      const key = r.room?.number ? `room:${r.room.number}` : `unassigned:${r.roomType?.name ?? "-"}`;
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
          <button className="btn-primary" onClick={() => setCreateOpen(true)}>
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
                        <button
                          type="button"
                          title={`${fullName(b.guest?.firstName, b.guest?.lastName)} · ${b.status}`}
                          onClick={() => { setSelected(b); setAssignRoomId(""); }}
                          className={[
                            "flex w-full items-center gap-1 truncate px-3 py-1.5 text-xs font-medium transition hover:brightness-95 active:brightness-90",
                            bookingTone(b.status),
                            selected?.id === b.id ? "ring-2 ring-primary ring-offset-1" : "",
                            clippedLeft ? "rounded-l-none" : "rounded-l-full",
                            clippedRight ? "rounded-r-none" : "rounded-r-full",
                          ].join(" ")}
                        >
                          {clippedLeft && <Icon name="chevron_left" className="text-[14px] opacity-70" />}
                          <span className="truncate">{fullName(b.guest?.firstName, b.guest?.lastName)}</span>
                          {clippedRight && <Icon name="chevron_right" className="ml-auto text-[14px] opacity-70" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </DataState>
      </Card>
      {/* Lifecycle detail panel */}
      {selected && (
        <Card className="mt-4 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-on-surface">
                {fullName(selected.guest?.firstName, selected.guest?.lastName)}
              </p>
              <p className="mt-0.5 text-sm text-on-surface-variant">
                {selected.roomType?.name ?? "-"} &middot; {formatDate(selected.checkInDate)} &rarr; {formatDate(selected.checkOutDate)} &middot;{" "}
                <span className={`pill ${statusPill(selected.status)}`}>{selected.status}</span>
              </p>
            </div>
            <button className="btn-ghost px-2" onClick={() => setSelected(null)} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>

          {action.error && (
            <p className="mt-2 rounded-lg bg-error-container/60 px-3 py-2 text-sm text-on-error-container">{action.error}</p>
          )}

          <div className="mt-3 flex flex-wrap items-end gap-2">
            {/* Check-in */}
            {(selected.status === "PENDING" || selected.status === "CONFIRMED") && (
              <button
                className="btn-primary"
                disabled={action.submitting}
                onClick={() => lifecycle(selected.id, "check-in")}
              >
                <Icon name="login" className="text-[18px]" /> Check in
              </button>
            )}

            {/* Check-out */}
            {selected.status === "CHECKED_IN" && (
              <button
                className="btn-primary"
                disabled={action.submitting}
                onClick={() => lifecycle(selected.id, "check-out")}
              >
                <Icon name="logout" className="text-[18px]" /> Check out
              </button>
            )}

            {/* Assign room */}
            {selected.status !== "CANCELLED" && selected.status !== "CHECKED_OUT" && selected.status !== "NO_SHOW" && (
              <div className="flex items-center gap-2">
                <select
                  className="input py-1.5 text-sm"
                  value={assignRoomId}
                  onChange={(e) => setAssignRoomId(e.target.value)}
                  disabled={action.submitting}
                >
                  <option value="">Assign room…</option>
                  {(allRooms.data ?? [])
                    .filter((r) => r.roomTypeId === selected.roomTypeId)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        Room {r.number} ({r.status})
                      </option>
                    ))}
                </select>
                <button
                  className="btn-secondary"
                  disabled={!assignRoomId || action.submitting}
                  onClick={() => assignRoom(selected.id, assignRoomId)}
                >
                  Assign
                </button>
              </div>
            )}

            {/* Cancel */}
            {selected.status !== "CANCELLED" && selected.status !== "CHECKED_OUT" && selected.status !== "NO_SHOW" && (
              <button
                className="btn-ghost text-error ml-auto"
                disabled={action.submitting}
                onClick={() => setCancelTarget(selected)}
              >
                <Icon name="cancel" className="text-[18px]" /> Cancel reservation
              </button>
            )}
          </div>
        </Card>
      )}

      <p className="mt-4 text-xs text-on-surface-variant">
        Note: rows are derived from bookings in view. Showing every room (including empty ones) and flagging
        "online / pending" bookings need a rooms-list endpoint and the Phase 7 <code>source</code> field.
      </p>

      {/* Create modal - conditionally mounted so each open is a fresh mount */}
      {createOpen && (
        <ReservationFormModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); reload(); }}
        />
      )}

      {/* Cancel confirmation */}
      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancel reservation"
        message={`Cancel the reservation for ${fullName(cancelTarget?.guest?.firstName, cancelTarget?.guest?.lastName)}? This cannot be undone.`}
        confirmLabel="Cancel reservation"
        danger
        busy={cancelMutation.submitting}
        error={cancelMutation.error}
        onConfirm={doCancel}
        onClose={() => setCancelTarget(null)}
      />
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

function statusPill(status: Reservation["status"]): string {
  switch (status) {
    case "CHECKED_IN":
      return "pill-success";
    case "CHECKED_OUT":
    case "CANCELLED":
    case "NO_SHOW":
      return "pill-neutral";
    default:
      return "pill-primary";
  }
}
