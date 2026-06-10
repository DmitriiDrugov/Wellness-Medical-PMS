"use client";

import { api } from "@/web/api-client";
import { useMutation } from "@/web/use-mutation";
import type { HousekeepingTask, TaskStatus, TaskPriority } from "@/web/types";
import { Card, Icon, StatusPill } from "@/web/components/ui";

const COLUMNS: { status: TaskStatus; label: string; icon: string }[] = [
  { status: "OPEN", label: "Open", icon: "warning" },
  { status: "IN_PROGRESS", label: "In Progress", icon: "cleaning_services" },
  { status: "BLOCKED", label: "Blocked", icon: "close" },
  { status: "DONE", label: "Done", icon: "check_circle" },
];

const PRIORITY_TONE: Record<TaskPriority, "neutral" | "info" | "warning" | "success"> = {
  LOW: "neutral",
  NORMAL: "info",
  HIGH: "warning",
  URGENT: "warning",
};

export function TaskBoard({ tasks, onChanged }: { tasks: HousekeepingTask[]; onChanged: () => void }) {
  const action = useMutation();

  async function start(id: string) {
    if ((await action.submit(() => api.post(`/api/housekeeping/tasks/${id}/start`))) !== undefined) onChanged();
  }
  async function complete(id: string) {
    if ((await action.submit(() => api.post(`/api/housekeeping/tasks/${id}/complete`))) !== undefined) onChanged();
  }
  async function setStatus(id: string, status: TaskStatus) {
    if ((await action.submit(() => api.patch(`/api/housekeeping/tasks/${id}`, { status }))) !== undefined) onChanged();
  }

  const byStatus = (s: TaskStatus) => tasks.filter((t) => t.status === s);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col) => {
        const items = byStatus(col.status);
        return (
          <div key={col.status} className="flex flex-col">
            <div className="mb-2 flex items-center gap-2 px-1">
              <Icon name={col.icon} className="text-[18px] text-on-surface-variant" />
              <h3 className="text-sm font-semibold text-on-surface">{col.label}</h3>
              <span className="ml-auto rounded-full bg-surface-container-high px-2 text-xs text-on-surface-variant">{items.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {items.length === 0 && (
                <div className="rounded-lg border border-dashed border-outline-variant/60 py-6 text-center text-xs text-on-surface-variant">—</div>
              )}
              {items.map((t) => (
                <Card key={t.id} className="p-3">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-on-surface">{t.title}</p>
                    <StatusPill tone={PRIORITY_TONE[t.priority]}>{t.priority}</StatusPill>
                  </div>
                  <p className="flex items-center gap-1 text-xs text-on-surface-variant">
                    <Icon name={t.room ? "meeting_room" : "location_on"} className="text-[14px]" />
                    {t.room ? `Room ${t.room.number}` : t.area ? t.area.name : "General property"}
                    <span className="ml-1 rounded bg-surface-container-high px-1.5 py-0.5 text-[10px] uppercase">{t.type}</span>
                  </p>
                  {t.assignedTo && (
                    <p className="mt-1 text-xs text-on-surface-variant">→ {t.assignedTo.firstName} {t.assignedTo.lastName}</p>
                  )}
                  {t.notes && <p className="mt-1 text-xs text-on-surface-variant/80">{t.notes}</p>}

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {t.status === "OPEN" && (
                      <button className="btn-secondary px-2 py-1 text-xs" disabled={action.submitting} onClick={() => start(t.id)}>Start</button>
                    )}
                    {t.status === "IN_PROGRESS" && (
                      <button className="btn-primary px-2 py-1 text-xs" disabled={action.submitting} onClick={() => complete(t.id)}>
                        <Icon name="check_circle" className="text-[14px]" /> Complete
                      </button>
                    )}
                    {(t.status === "OPEN" || t.status === "IN_PROGRESS") && (
                      <button className="btn-ghost px-2 py-1 text-xs" disabled={action.submitting} onClick={() => setStatus(t.id, "BLOCKED")}>Block</button>
                    )}
                    {t.status === "BLOCKED" && (
                      <button className="btn-secondary px-2 py-1 text-xs" disabled={action.submitting} onClick={() => setStatus(t.id, "IN_PROGRESS")}>Resume</button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
