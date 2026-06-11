"use client";

import { useState } from "react";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import { useEventStream } from "@/web/use-event-stream";
import { useAuth } from "@/web/auth-context";
import type { HousekeepingTask } from "@/web/types";
import { PageHeader, DataState, Icon } from "@/web/components/ui";
import { TaskBoard } from "../hotel/TaskBoard";
import { TaskFormModal } from "../hotel/TaskFormModal";

export default function HousekeepingPage() {
  const { user } = useAuth();
  // Housekeeping staff default to their own queue (the mobile view); managers see all.
  const [mine, setMine] = useState(user?.role === "HOUSEKEEPING");
  const [createOpen, setCreateOpen] = useState(false);

  const tasks = useApi<HousekeepingTask[]>(
    () => api.get<HousekeepingTask[]>("/api/housekeeping/tasks", mine ? { mine: "true" } : undefined),
    [mine],
  );
  useEventStream((ev) => {
    if (ev.entity === "housekeeping") tasks.reload();
  });

  return (
    <div>
      <PageHeader
        title="Housekeeping Board"
        subtitle="Cleaning, maintenance and inspection tasks across the property."
        actions={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-on-surface-variant">
              <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> My tasks only
            </label>
            <button className="btn-primary" onClick={() => setCreateOpen(true)}>
              <Icon name="add" className="text-[20px]" /> New task
            </button>
          </div>
        }
      />
      <DataState loading={tasks.loading} error={tasks.error}>
        <TaskBoard tasks={tasks.data ?? []} onChanged={tasks.reload} />
      </DataState>
      {createOpen && (
        <TaskFormModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); tasks.reload(); }} />
      )}
    </div>
  );
}
