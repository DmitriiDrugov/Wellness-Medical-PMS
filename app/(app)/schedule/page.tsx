"use client";

import { useMemo, useState } from "react";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import { useMutation } from "@/web/use-mutation";
import type { Appointment } from "@/web/types";
import { PageHeader, Card, Icon, DataState } from "@/web/components/ui";
import { fullName, formatTime } from "@/web/format";
import { AppointmentFormModal } from "./AppointmentFormModal";
import { ConfirmDialog } from "@/web/components/ConfirmDialog";

const HOURS = Array.from({ length: 11 }, (_, i) => 8 + i); // 08:00–18:00

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export default function SchedulePage() {
  const [day, setDay] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const from = dayKey(day);
  const to = dayKey(addDays(day, 1));

  const { data, loading, error, reload } = useApi<Appointment[]>(
    () => api.get<Appointment[]>("/api/appointments", { from, to, pageSize: 100 }),
    [from, to],
  );
  const appts = data ?? [];

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

  const therapists = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of appts) map.set(a.therapistId, fullName(a.therapist?.firstName, a.therapist?.lastName));
    return [...map.entries()];
  }, [appts]);

  function apptAt(therapistId: string, hour: number): Appointment | undefined {
    return appts.find((a) => a.therapistId === therapistId && new Date(a.startTime).getHours() === hour);
  }

  return (
    <div>
      <PageHeader
        title="Treatment Schedule"
        subtitle="Therapist day view. Completing an appointment posts its charge to the linked folio."
        actions={
          <button className="btn-primary" onClick={() => setBookOpen(true)}>
            <Icon name="add" className="text-[20px]" /> Book Appointment
          </button>
        }
      />

      <Card className="mb-4 flex items-center gap-3 p-3">
        <button className="btn-ghost" onClick={() => setDay(addDays(day, -1))}>
          <Icon name="chevron_left" />
        </button>
        <button
          className="btn-ghost"
          onClick={() => {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            setDay(d);
          }}
        >
          Today
        </button>
        <button className="btn-ghost" onClick={() => setDay(addDays(day, 1))}>
          <Icon name="chevron_right" />
        </button>
        <span className="ml-2 text-sm font-medium text-on-surface">
          {day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </span>
      </Card>

      <Card className="p-0">
        <DataState
          loading={loading}
          error={error}
          empty={therapists.length === 0}
          emptyLabel="No appointments scheduled for this day."
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-outline-variant/50 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  <th className="sticky left-0 bg-surface-container-lowest px-4 py-3 text-left">Therapist</th>
                  {HOURS.map((h) => (
                    <th key={h} className="px-2 py-3 text-center">{h}:00</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {therapists.map(([id, name]) => (
                  <tr key={id} className="border-b border-outline-variant/30">
                    <td className="sticky left-0 bg-surface-container-lowest px-4 py-2 font-medium text-on-surface">
                      {name}
                    </td>
                    {HOURS.map((h) => {
                      const a = apptAt(id, h);
                      return (
                        <td key={h} className="px-1 py-1 align-top">
                          {a ? (
                            <button
                              type="button"
                              className={`w-full rounded px-2 py-1 text-left text-xs font-medium transition hover:opacity-80 ${
                                a.status === "COMPLETED"
                                  ? "bg-success/15 text-success"
                                  : a.status === "CANCELLED"
                                    ? "bg-surface-container-high text-on-surface-variant line-through"
                                    : "bg-primary/15 text-primary"
                              }`}
                              title={`${a.treatment?.name} · ${a.resource?.name ?? ""}`}
                              onClick={() => a.status === "SCHEDULED" && setSelectedAppt(a)}
                            >
                              <p className="truncate">{a.treatment?.name ?? "Treatment"}</p>
                              <p className="truncate opacity-80">
                                {fullName(a.guest?.firstName, a.guest?.lastName)} · {formatTime(a.startTime)}
                              </p>
                            </button>
                          ) : (
                            <div className="h-9" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
      </Card>

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
