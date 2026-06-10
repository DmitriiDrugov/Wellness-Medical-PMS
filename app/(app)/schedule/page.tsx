"use client";

import { useMemo, useState } from "react";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import { useMutation } from "@/web/use-mutation";
import type { Appointment } from "@/web/types";
import { Icon, DataState } from "@/web/components/ui";
import { fullName, formatTime, localDayRange } from "@/web/format";
import { AppointmentFormModal } from "./AppointmentFormModal";
import { ConfirmDialog } from "@/web/components/ConfirmDialog";

const START_HOUR = 8; // 8 AM — top of the timeline
const END_HOUR = 18; // 6 PM — bottom of the timeline
const HOUR_PX = 60; // pixels per hour block (1px per minute)
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const BODY_HEIGHT = (END_HOUR - START_HOUR) * HOUR_PX;

/** Repeating horizontal hour lines, matching the Stitch ".timeline-grid" background. */
const GRID_BG: React.CSSProperties = {
  backgroundImage: "linear-gradient(to bottom, #F0EEEB 1px, transparent 1px)",
  backgroundSize: `100% ${HOUR_PX}px`,
};

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}
/** Minutes elapsed since START_HOUR for a timestamp on the displayed day. */
function minutesFromStart(iso: string): number {
  const d = new Date(iso);
  return (d.getHours() - START_HOUR) * 60 + d.getMinutes();
}
function hourLabel(h: number): string {
  const period = h < 12 ? "AM" : "PM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display} ${period}`;
}

/** An appointment placed on the timeline, with conflict lane geometry. */
interface PlacedAppt {
  appt: Appointment;
  top: number;
  height: number;
  lane: number; // sub-column index within an overlap cluster
  lanes: number; // total sub-columns in the cluster
  conflict: boolean; // overlaps another active appointment
}

/**
 * Lays out one therapist's appointments: stacks overlapping bookings into
 * side-by-side lanes (the Stitch double-booking treatment) and flags conflicts.
 */
function layoutColumn(items: Appointment[]): PlacedAppt[] {
  const sorted = [...items].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );
  const placed: PlacedAppt[] = [];

  // Walk in time order, grouping into clusters of transitively-overlapping items.
  let cluster: PlacedAppt[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const lanes = cluster.reduce((m, p) => Math.max(m, p.lane + 1), 0);
    const conflict = cluster.length > 1;
    for (const p of cluster) {
      p.lanes = lanes;
      p.conflict = conflict;
    }
    placed.push(...cluster);
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const appt of sorted) {
    const start = minutesFromStart(appt.startTime);
    const end = minutesFromStart(appt.endTime);
    if (cluster.length > 0 && start >= clusterEnd) flush();

    // First lane whose current bookings have all ended by `start`.
    const laneEnds = cluster.map(() => 0) as number[];
    for (const p of cluster) {
      laneEnds[p.lane] = Math.max(laneEnds[p.lane] ?? 0, minutesFromStart(p.appt.endTime));
    }
    let lane = 0;
    while (laneEnds[lane] !== undefined && laneEnds[lane]! > start) lane++;

    cluster.push({
      appt,
      top: Math.max(0, start),
      height: Math.max(28, end - start),
      lane,
      lanes: 1,
      conflict: false,
    });
    clusterEnd = Math.max(clusterEnd, end);
  }
  if (cluster.length > 0) flush();
  return placed;
}

export default function SchedulePage() {
  const [day, setDay] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const { from, to } = localDayRange(day);

  const { data, loading, error, reload } = useApi<Appointment[]>(
    () => api.get<Appointment[]>("/api/appointments", { from, to, pageSize: 100 }),
    [from, to],
  );
  const appts = data ?? [];

  const [view, setView] = useState<"daily" | "weekly">("daily");
  const [bookOpen, setBookOpen] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const action = useMutation();

  async function complete(id: string) {
    const ok = await action.submit(() => api.post(`/api/appointments/${id}/complete`));
    if (ok !== undefined) {
      setSelectedAppt(null);
      reload();
    }
  }
  async function cancel(id: string) {
    const ok = await action.submit(() => api.post(`/api/appointments/${id}/cancel`));
    if (ok !== undefined) {
      setCancelTarget(null);
      setSelectedAppt(null);
      reload();
    }
  }

  // Therapist columns (resource shown as the sub-label, like the Stitch "Room N").
  const columns = useMemo(() => {
    const map = new Map<string, { name: string; resource: string; items: Appointment[] }>();
    for (const a of appts) {
      const key = a.therapistId;
      if (!map.has(key)) {
        map.set(key, {
          name: fullName(a.therapist?.firstName, a.therapist?.lastName),
          resource: a.resource?.name ?? "",
          items: [],
        });
      }
      const col = map.get(key)!;
      if (!col.resource && a.resource?.name) col.resource = a.resource.name;
      col.items.push(a);
    }
    return [...map.entries()].map(([id, c]) => ({ id, ...c, placed: layoutColumn(c.items) }));
  }, [appts]);

  // Red "now" line — only while viewing today and within business hours.
  const now = new Date();
  const showNow = isSameDay(day, now) && now.getHours() >= START_HOUR && now.getHours() < END_HOUR;
  const nowTop = (now.getHours() - START_HOUR) * 60 + now.getMinutes();

  const minWidth = 80 + columns.length * 220;

  return (
    <div className="-mx-6 -my-6 flex h-[calc(100vh-4rem)] flex-col bg-background">
      {/* Schedule header & toolbar */}
      <div className="flex flex-shrink-0 flex-col items-start justify-between gap-4 border-b border-surface-variant bg-surface/50 px-6 py-4 backdrop-blur-sm sm:flex-row sm:items-center">
        <div>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight text-on-surface">Treatment Schedule</h1>
          <div className="flex items-center gap-2 text-sm text-on-surface-variant">
            <button
              className="grid h-6 w-6 place-items-center rounded hover:bg-surface-container"
              onClick={() => setDay(addDays(day, -1))}
              aria-label="Previous day"
            >
              <Icon name="chevron_left" className="text-[18px]" />
            </button>
            <Icon name="calendar_today" className="text-[18px]" />
            <span>
              {day.toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <button
              className="grid h-6 w-6 place-items-center rounded hover:bg-surface-container"
              onClick={() => setDay(addDays(day, 1))}
              aria-label="Next day"
            >
              <Icon name="chevron_right" className="text-[18px]" />
            </button>
          </div>
        </div>

        <div className="flex w-full items-center gap-3 sm:w-auto">
          {/* View toggle */}
          <div className="mr-2 flex rounded-lg border border-surface-variant bg-surface-container-low p-1">
            <button
              className={`rounded px-4 py-1.5 text-xs font-medium transition-colors ${
                view === "daily" ? "bg-surface text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
              }`}
              onClick={() => setView("daily")}
            >
              Daily
            </button>
            <button
              className={`rounded px-4 py-1.5 text-xs font-medium transition-colors ${
                view === "weekly" ? "bg-surface text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
              }`}
              onClick={() => setView("weekly")}
            >
              Weekly
            </button>
          </div>
          <button
            className="rounded-lg border border-surface-variant p-2 text-on-surface transition-colors hover:bg-surface-variant"
            aria-label="Filter"
          >
            <Icon name="filter_list" />
          </button>
          <button
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-on-primary shadow-sm transition-colors hover:bg-primary-container sm:flex-none"
            onClick={() => setBookOpen(true)}
          >
            <Icon name="add" className="text-[18px]" /> Book Appointment
          </button>
        </div>
      </div>

      {/* Scheduler canvas */}
      <div className="relative flex-1 overflow-auto bg-surface-container-lowest">
        <DataState
          loading={loading}
          error={error}
          empty={columns.length === 0}
          emptyLabel="No appointments scheduled for this day."
        >
          <div className="flex h-full flex-col" style={{ minWidth }}>
            {/* Resource header row (therapists / rooms) */}
            <div className="sticky top-0 z-20 flex h-[70px] border-b border-surface-variant bg-surface shadow-sm">
              <div className="flex w-[80px] flex-shrink-0 items-end justify-end border-r border-surface-variant bg-surface-container-lowest p-2 text-xs text-outline-variant">
                GMT
              </div>
              <div
                className="grid flex-1 divide-x divide-surface-variant"
                style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
              >
                {columns.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-col items-center justify-center bg-surface-container-lowest px-4 py-3"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-on-surface">{c.name}</span>
                    {c.resource && <span className="text-sm text-on-surface-variant">{c.resource}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline body */}
            <div className="relative flex flex-1" style={{ minHeight: BODY_HEIGHT }}>
              {/* Time axis */}
              <div
                className="z-10 w-[80px] flex-shrink-0 border-r border-surface-variant bg-surface-container-lowest"
                style={GRID_BG}
              >
                {HOURS.map((h) => (
                  <div key={h} className="relative" style={{ height: HOUR_PX }}>
                    <span className="absolute -top-3 right-2 text-xs text-on-surface-variant">{hourLabel(h)}</span>
                  </div>
                ))}
              </div>

              {/* Columns grid */}
              <div
                className="relative grid flex-1 divide-x divide-surface-variant"
                style={{ ...GRID_BG, gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
              >
                {/* Current-time indicator */}
                {showNow && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-10 h-px bg-error"
                    style={{ top: nowTop }}
                  >
                    <div className="absolute -left-2 -top-1.5 h-3 w-3 rounded-full bg-error" />
                  </div>
                )}

                {columns.map((c) => (
                  <div key={c.id} className="relative h-full">
                    {c.placed.map(({ appt, top, height, lane, lanes, conflict }) => {
                      const widthPct = 100 / lanes;
                      const cancelled = appt.status === "CANCELLED";
                      const completed = appt.status === "COMPLETED";
                      const tone = conflict && !cancelled
                        ? "border-error bg-error-container"
                        : completed
                          ? "border-success bg-success/15"
                          : cancelled
                            ? "border-outline-variant bg-surface-container"
                            : "border-primary bg-primary/10";
                      return (
                        // Wrapper holds the slot geometry; the inner card may grow past
                        // it on hover to reveal extra detail, overlapping the slots below.
                        <div
                          key={appt.id}
                          className={`group absolute hover:z-30 ${conflict && !cancelled ? "z-20" : ""}`}
                          style={{
                            top,
                            left: `calc(${lane * widthPct}% + 4px)`,
                            width: `calc(${widthPct}% - ${lanes > 1 ? 6 : 8}px)`,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => appt.status === "SCHEDULED" && setSelectedAppt(appt)}
                            className={`relative block w-full cursor-pointer overflow-hidden rounded-r-md border-l-4 p-2 text-left shadow-sm transition-all duration-200 group-hover:shadow-lg ${tone} ${
                              conflict && !cancelled ? "outline outline-2 outline-error ring-4 ring-error/10" : ""
                            }`}
                            style={{ minHeight: height }}
                          >
                            {conflict && !cancelled && (
                              <span className="absolute -right-2 -top-3 rounded-full bg-error p-0.5 text-on-error shadow-md">
                                <Icon name="warning" className="text-[14px]" />
                              </span>
                            )}
                            <div
                              className={`mb-0.5 truncate text-xs font-semibold uppercase tracking-wide ${
                                conflict && !cancelled
                                  ? "text-on-error-container"
                                  : cancelled
                                    ? "text-on-surface-variant line-through"
                                    : "text-on-primary-fixed"
                              }`}
                            >
                              {appt.treatment?.name ?? "Treatment"}
                            </div>
                            <div
                              className={`truncate text-sm ${
                                conflict && !cancelled ? "text-on-error-container/80" : "text-on-surface-variant"
                              }`}
                            >
                              {fullName(appt.guest?.firstName, appt.guest?.lastName)}
                            </div>
                            {/* Extra detail — collapsed until hover, expanding the card. */}
                            <div className="mt-1 flex max-h-0 items-center gap-1 overflow-hidden text-xs text-on-surface-variant/70 opacity-0 transition-all duration-200 group-hover:max-h-8 group-hover:opacity-100">
                              <Icon name="schedule" className="text-[14px]" />
                              {formatTime(appt.startTime)} – {formatTime(appt.endTime)}
                            </div>
                            {appt.resource?.name && (
                              <div className="flex max-h-0 items-center gap-1 overflow-hidden text-xs text-on-surface-variant/70 opacity-0 transition-all duration-200 group-hover:mt-0.5 group-hover:max-h-8 group-hover:opacity-100">
                                <Icon name="meeting_room" className="text-[14px]" />
                                {appt.resource.name}
                              </div>
                            )}
                          </button>
                        </div>
                      );
                    })}

                    {/* Double-booking banner under the earliest conflict in this column */}
                    {(() => {
                      const conflicts = c.placed.filter((p) => p.conflict && p.appt.status !== "CANCELLED");
                      if (conflicts.length === 0) return null;
                      const bannerTop = Math.max(...conflicts.map((p) => p.top + p.height)) + 4;
                      return (
                        <div
                          className="absolute left-1 right-1 flex items-center gap-1 rounded bg-error/5 p-1 text-xs font-medium text-error"
                          style={{ top: bannerTop }}
                        >
                          <Icon name="error" className="text-[14px]" /> Double-booking detected
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DataState>
      </div>

      {/* Appointment detail / actions popover */}
      {selectedAppt && (
        <div className="modal-overlay" onClick={() => setSelectedAppt(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-outline-variant/50 px-5 py-3">
              <h2 className="text-lg font-semibold text-on-surface">
                {selectedAppt.treatment?.name ?? "Appointment"}
              </h2>
              <button className="btn-ghost px-2" onClick={() => setSelectedAppt(null)} aria-label="Close">
                <Icon name="close" />
              </button>
            </div>
            <div className="space-y-2 px-5 py-4 text-sm text-on-surface-variant">
              <p><span className="font-medium text-on-surface">Guest:</span> {fullName(selectedAppt.guest?.firstName, selectedAppt.guest?.lastName)}</p>
              <p><span className="font-medium text-on-surface">Therapist:</span> {fullName(selectedAppt.therapist?.firstName, selectedAppt.therapist?.lastName)}</p>
              <p><span className="font-medium text-on-surface">Resource:</span> {selectedAppt.resource?.name ?? "—"}</p>
              <p><span className="font-medium text-on-surface">Start:</span> {formatTime(selectedAppt.startTime)}</p>
              {action.error && (
                <p className="rounded-lg bg-error-container/60 px-3 py-2 text-sm text-on-error-container">{action.error}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-outline-variant/50 px-5 py-3">
              <button
                className="btn-ghost text-error"
                disabled={action.submitting}
                onClick={() => { setSelectedAppt(null); setCancelTarget(selectedAppt); }}
              >
                <Icon name="cancel" className="text-[18px]" /> Cancel
              </button>
              <button
                className="btn-primary"
                disabled={action.submitting}
                onClick={() => complete(selectedAppt.id)}
              >
                {action.submitting ? "Working…" : <><Icon name="check_circle" className="text-[18px]" /> Complete</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {bookOpen && (
        <AppointmentFormModal
          open={bookOpen}
          onClose={() => setBookOpen(false)}
          onSaved={() => { setBookOpen(false); reload(); }}
        />
      )}

      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancel appointment"
        message={`Cancel the appointment for ${fullName(cancelTarget?.guest?.firstName, cancelTarget?.guest?.lastName)}? This cannot be undone.`}
        confirmLabel="Cancel appointment"
        danger
        busy={action.submitting}
        error={action.error}
        onConfirm={() => cancelTarget && cancel(cancelTarget.id)}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  );
}
