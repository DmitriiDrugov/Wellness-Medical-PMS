"use client";

import { useMemo, useState } from "react";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import { useMutation } from "@/web/use-mutation";
import { useEventStream } from "@/web/use-event-stream";
import type { BookingGridResponse, GridBooking, GridRoom, RoomListItem } from "@/web/types";
import { PageHeader, Card, Icon, DataState } from "@/web/components/ui";
import { ConfirmDialog } from "@/web/components/ConfirmDialog";
import { formatDate } from "@/web/format";
import { BookingFormModal } from "./BookingFormModal";

type View = "day" | "week";

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x;
}
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
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
/** Whole-day offset of an ISO/`YYYY-MM-DD` date from the window's first day. */
function dayOffset(dateStr: string, windowStart: Date): number {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  const date = Date.UTC(y!, m! - 1, d!);
  const base = Date.UTC(windowStart.getFullYear(), windowStart.getMonth(), windowStart.getDate());
  return Math.round((date - base) / 86_400_000);
}

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface RoomRow {
  kind: "room";
  key: string;
  label: string;
  sub: string;
  housekeepingStatus: GridRoom["housekeepingStatus"];
  roomId: string;
  roomTypeId: string;
  bookings: GridBooking[];
}
interface UnassignedRow {
  kind: "unassigned";
  key: string;
  label: string;
  sub: string;
  roomTypeId: string;
  bookings: GridBooking[];
}
type Row = RoomRow | UnassignedRow;

interface FloorGroup {
  floor: number | null;
  rows: Row[];
}

export default function BookingPage() {
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));

  const span = view === "week" ? 7 : 1;
  const windowStart = view === "week" ? startOfWeek(anchor) : startOfDay(anchor);
  const days = useMemo(
    () => Array.from({ length: span }, (_, i) => addDays(windowStart, i)),
    [windowStart, span],
  );
  const from = localKey(windowStart);
  const to = localKey(addDays(windowStart, span));

  const { data, loading, error, reload } = useApi<BookingGridResponse>(
    () => api.get<BookingGridResponse>("/api/booking-grid", { from, to, view }),
    [from, to, view],
  );

  // Live: refetch when any booking/folio event lands for this property.
  useEventStream((ev) => {
    if (ev.entity === "booking" || ev.entity === "room") reload();
  });

  const allRooms = useApi<RoomListItem[]>(() => api.get<RoomListItem[]>("/api/rooms"), []);

  // ---- Filters ----
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [floorFilter, setFloorFilter] = useState<number | "all">("all");
  const [hideCheckedOut, setHideCheckedOut] = useState(false);

  function toggleType(id: string) {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  // Empty set = "all types" (nothing excluded).
  const typeAllowed = (id: string) => typeFilter.size === 0 || typeFilter.has(id);

  // ---- Selection / lifecycle ----
  const [createOpen, setCreateOpen] = useState(false);
  const [createCtx, setCreateCtx] = useState<{ roomTypeId?: string; checkIn?: string }>({});
  const [selected, setSelected] = useState<GridBooking | null>(null);
  const [cancelTarget, setCancelTarget] = useState<GridBooking | null>(null);
  const [assignRoomId, setAssignRoomId] = useState("");
  const action = useMutation();
  const cancelMutation = useMutation();

  async function lifecycle(id: string, op: "check-in" | "check-out" | "no-show") {
    const ok = await action.submit(() => api.post(`/api/reservations/${id}/${op}`));
    if (ok !== undefined) { setSelected(null); reload(); }
  }
  async function assignRoom(id: string, roomId: string) {
    if (!roomId) return;
    const ok = await action.submit(() => api.post(`/api/reservations/${id}/assign-room`, { roomId }));
    if (ok !== undefined) { setAssignRoomId(""); setSelected(null); reload(); }
  }
  async function doCancel() {
    if (!cancelTarget) return;
    const ok = await cancelMutation.submit(() => api.post(`/api/reservations/${cancelTarget.id}/cancel`));
    if (ok !== undefined) { setCancelTarget(null); setSelected(null); reload(); }
  }

  const grid = data;

  // ---- Build floor groups (rooms) + unassigned rows ----
  const groups: FloorGroup[] = useMemo(() => {
    if (!grid) return [];
    const visibleBookings = grid.bookings.filter(
      (b) => typeAllowed(b.roomTypeId) && !(hideCheckedOut && b.status === "CHECKED_OUT"),
    );
    const byRoom = new Map<string, GridBooking[]>();
    for (const b of visibleBookings) {
      if (b.roomId) {
        if (!byRoom.has(b.roomId)) byRoom.set(b.roomId, []);
        byRoom.get(b.roomId)!.push(b);
      }
    }

    const rooms = grid.rooms
      .filter((r) => typeAllowed(r.roomTypeId))
      .filter((r) => floorFilter === "all" || r.floor === floorFilter);

    const floors = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => (a ?? 99) - (b ?? 99));
    const result: FloorGroup[] = floors.map((floor) => ({
      floor,
      rows: rooms
        .filter((r) => r.floor === floor)
        .map<Row>((r) => ({
          kind: "room",
          key: `room:${r.id}`,
          label: `Room ${r.number}`,
          sub: r.roomTypeName,
          housekeepingStatus: r.housekeepingStatus,
          roomId: r.id,
          roomTypeId: r.roomTypeId,
          bookings: byRoom.get(r.id) ?? [],
        })),
    }));

    // Unassigned bookings (no room yet) grouped by type into their own section.
    const unassigned = visibleBookings.filter((b) => !b.roomId);
    if (unassigned.length > 0 && floorFilter === "all") {
      const byType = new Map<string, GridBooking[]>();
      for (const b of unassigned) {
        if (!byType.has(b.roomTypeId)) byType.set(b.roomTypeId, []);
        byType.get(b.roomTypeId)!.push(b);
      }
      result.push({
        floor: null,
        rows: [...byType.entries()].map(([typeId, bookings]) => ({
          kind: "unassigned",
          key: `unassigned:${typeId}`,
          label: "Unassigned",
          sub: bookings[0]!.roomTypeName,
          roomTypeId: typeId,
          bookings,
        })),
      });
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, typeFilter, floorFilter, hideCheckedOut]);

  const totalRows = groups.reduce((n, g) => n + g.rows.length, 0);
  const gridCols = `200px repeat(${span}, minmax(0, 1fr))`;
  const floorOptions = useMemo(
    () => [...new Set((grid?.rooms ?? []).map((r) => r.floor))].sort((a, b) => (a ?? 99) - (b ?? 99)),
    [grid],
  );

  function rangeLabel(): string {
    if (view === "day") {
      return windowStart.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
    }
    const end = addDays(windowStart, 6);
    return `${windowStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
  }

  return (
    <div>
      <PageHeader
        title="Booking Grid"
        subtitle="Room allocations and guest stays — the origin of every patient journey."
        actions={
          <button
            className="btn-primary"
            onClick={() => { setCreateCtx({}); setCreateOpen(true); }}
          >
            <Icon name="add" className="text-[20px]" /> Book
          </button>
        }
      />

      {/* Toolbar */}
      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <button className="btn-ghost px-2" onClick={() => setAnchor(addDays(anchor, -span))} aria-label="Previous">
          <Icon name="chevron_left" />
        </button>
        <button className="btn-ghost" onClick={() => setAnchor(new Date())}>Today</button>
        <button className="btn-ghost px-2" onClick={() => setAnchor(addDays(anchor, span))} aria-label="Next">
          <Icon name="chevron_right" />
        </button>
        <span className="ml-1 text-sm font-medium text-on-surface">{rangeLabel()}</span>

        {/* View toggle */}
        <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-outline-variant/60">
          {(["day", "week"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 text-sm font-medium capitalize transition ${
                view === v ? "bg-primary text-on-primary" : "bg-surface text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </Card>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Grid */}
        <Card className="min-w-0 flex-1 p-0">
          <DataState loading={loading} error={error} empty={totalRows === 0} emptyLabel="No rooms match the current filters.">
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                {/* Header */}
                <div
                  className="grid items-center border-b border-outline-variant/50 bg-surface-container-low text-xs font-semibold uppercase tracking-wide text-on-surface-variant"
                  style={{ gridTemplateColumns: gridCols }}
                >
                  <div className="px-4 py-3">Resource</div>
                  {days.map((d, i) => (
                    <div key={i} className="border-l border-outline-variant/30 px-2 py-3 text-center">
                      <span className="block">{DOW[(d.getDay() + 6) % 7]}</span>
                      <span className="text-sm text-on-surface">{d.getDate()}</span>
                    </div>
                  ))}
                </div>

                {/* Floor groups */}
                {groups.map((group) => (
                  <div key={`floor-${group.floor ?? "unassigned"}`}>
                    <div className="border-b border-outline-variant/30 bg-surface-container-high px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                      {group.floor === null ? "Unassigned bookings" : `Floor ${group.floor}`}
                    </div>
                    {group.rows.map((row) => (
                      <div
                        key={row.key}
                        className="grid items-stretch border-b border-outline-variant/30"
                        style={{ gridTemplateColumns: gridCols, minHeight: "52px" }}
                      >
                        <div className="flex flex-col justify-center px-4 py-2">
                          <span className="font-medium text-on-surface">{row.label}</span>
                          <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                            {row.sub}
                            {row.kind === "room" && row.housekeepingStatus !== "CLEAN" && row.housekeepingStatus !== "INSPECTED" && (
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning" title={row.housekeepingStatus} />
                            )}
                          </span>
                        </div>

                        {/* Day separators */}
                        {days.map((_, i) => (
                          <div key={`sep-${i}`} className="h-full border-l border-outline-variant/20" style={{ gridColumn: i + 2, gridRow: 1 }} />
                        ))}

                        {/* Booking bars */}
                        {row.bookings.map((b) => {
                          const startOff = dayOffset(b.checkInDate, windowStart);
                          const endOff = dayOffset(b.checkOutDate, windowStart); // checkout exclusive
                          if (endOff <= 0 || startOff >= span) return null;
                          const startCol = Math.max(0, startOff) + 2;
                          const endCol = Math.min(span, endOff) + 2;
                          const clippedLeft = startOff < 0;
                          const clippedRight = endOff > span;
                          return (
                            <div key={b.id} className="z-10 mx-1 self-center" style={{ gridColumn: `${startCol} / ${endCol}`, gridRow: 1 }}>
                              <button
                                type="button"
                                title={`${b.guestName} · ${b.status}`}
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
                                <span className="truncate">{b.guestName}</span>
                                {clippedRight && <Icon name="chevron_right" className="ml-auto text-[14px] opacity-70" />}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer stats */}
            {grid && (
              <div className="flex items-center justify-between gap-4 border-t border-outline-variant/50 px-4 py-3 text-sm">
                <span className="text-on-surface-variant">
                  Total resources <span className="font-semibold text-on-surface">{grid.rooms.length}</span>
                </span>
                <span className="text-on-surface-variant">
                  Occupancy{" "}
                  <span className="font-semibold text-on-surface">{grid.utilization.ratePct}%</span>{" "}
                  <span className="text-xs">
                    ({grid.utilization.occupiedRoomNights}/{grid.utilization.availableRoomNights} room-nights)
                  </span>
                </span>
              </div>
            )}
          </DataState>
        </Card>

        {/* Filters sidebar */}
        <Card className="h-fit w-full p-4 lg:w-64">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Grid Filters</p>

          <p className="mb-1.5 text-sm font-medium text-on-surface">Room types</p>
          <div className="space-y-1.5">
            {(grid?.roomTypes ?? []).map((rt) => (
              <label key={rt.id} className="flex items-center gap-2 text-sm text-on-surface-variant">
                <input type="checkbox" checked={typeAllowed(rt.id)} onChange={() => toggleType(rt.id)} />
                {rt.name}
              </label>
            ))}
            {typeFilter.size > 0 && (
              <button className="text-xs text-primary hover:underline" onClick={() => setTypeFilter(new Set())}>
                Clear — show all
              </button>
            )}
          </div>

          <hr className="my-4 border-outline-variant/40" />
          <p className="mb-1.5 text-sm font-medium text-on-surface">Floor</p>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm text-on-surface-variant">
              <input type="radio" name="floor" checked={floorFilter === "all"} onChange={() => setFloorFilter("all")} />
              All floors
            </label>
            {floorOptions.filter((f) => f !== null).map((f) => (
              <label key={f} className="flex items-center gap-2 text-sm text-on-surface-variant">
                <input type="radio" name="floor" checked={floorFilter === f} onChange={() => setFloorFilter(f as number)} />
                Floor {f}
              </label>
            ))}
          </div>

          <hr className="my-4 border-outline-variant/40" />
          <label className="flex items-center gap-2 text-sm text-on-surface-variant">
            <input type="checkbox" checked={hideCheckedOut} onChange={(e) => setHideCheckedOut(e.target.checked)} />
            Hide checked-out
          </label>

          <hr className="my-4 border-outline-variant/40" />
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Legend</p>
          <ul className="space-y-1.5 text-xs text-on-surface-variant">
            <li className="flex items-center gap-2"><span className="h-3 w-4 rounded-full bg-primary/15" /> Booked / confirmed</li>
            <li className="flex items-center gap-2"><span className="h-3 w-4 rounded-full bg-success/20" /> In-house</li>
            <li className="flex items-center gap-2"><span className="h-3 w-4 rounded-full bg-surface-container-high" /> Checked-out</li>
          </ul>
        </Card>
      </div>

      {/* Lifecycle detail panel */}
      {selected && (
        <Card className="mt-4 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-on-surface">{selected.guestName}</p>
              <p className="mt-0.5 text-sm text-on-surface-variant">
                {selected.roomTypeName}
                {selected.roomNumber ? ` · Room ${selected.roomNumber}` : " · Unassigned"} ·{" "}
                {formatDate(selected.checkInDate)} → {formatDate(selected.checkOutDate)} ·{" "}
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
            {(selected.status === "PENDING" || selected.status === "CONFIRMED") && (
              <button className="btn-primary" disabled={action.submitting} onClick={() => lifecycle(selected.id, "check-in")}>
                <Icon name="login" className="text-[18px]" /> Check in
              </button>
            )}
            {selected.status === "CHECKED_IN" && (
              <button className="btn-primary" disabled={action.submitting} onClick={() => lifecycle(selected.id, "check-out")}>
                <Icon name="logout" className="text-[18px]" /> Check out
              </button>
            )}
            {(selected.status === "PENDING" || selected.status === "CONFIRMED") && (
              <button className="btn-secondary" disabled={action.submitting} onClick={() => lifecycle(selected.id, "no-show")}>
                <Icon name="person_off" className="text-[18px]" /> No show
              </button>
            )}
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
                      <option key={r.id} value={r.id}>Room {r.number}</option>
                    ))}
                </select>
                <button className="btn-secondary" disabled={!assignRoomId || action.submitting} onClick={() => assignRoom(selected.id, assignRoomId)}>
                  Assign
                </button>
              </div>
            )}
            {selected.status !== "CANCELLED" && selected.status !== "CHECKED_OUT" && selected.status !== "NO_SHOW" && (
              <button className="btn-ghost text-error ml-auto" disabled={action.submitting} onClick={() => setCancelTarget(selected)}>
                <Icon name="cancel" className="text-[18px]" /> Cancel booking
              </button>
            )}
          </div>
        </Card>
      )}

      {createOpen && (
        <BookingFormModal
          open={createOpen}
          defaultRoomTypeId={createCtx.roomTypeId}
          defaultCheckIn={createCtx.checkIn}
          onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); reload(); }}
        />
      )}

      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancel booking"
        message={`Cancel the booking for ${cancelTarget?.guestName ?? ""}? This cannot be undone.`}
        confirmLabel="Cancel booking"
        danger
        busy={cancelMutation.submitting}
        error={cancelMutation.error}
        onConfirm={doCancel}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  );
}

function bookingTone(status: GridBooking["status"]): string {
  switch (status) {
    case "CHECKED_IN":
      return "bg-success/20 text-success";
    case "CHECKED_OUT":
      return "bg-surface-container-high text-on-surface-variant";
    default: // PENDING / CONFIRMED
      return "bg-primary/15 text-primary";
  }
}

function statusPill(status: GridBooking["status"]): string {
  switch (status) {
    case "CHECKED_IN":
      return "pill-success";
    case "CHECKED_OUT":
      return "pill-neutral";
    default:
      return "pill-primary";
  }
}
