"use client";

import { useState } from "react";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import { useMutation } from "@/web/use-mutation";
import { Modal } from "@/web/components/Modal";
import { Field, FormError, FormActions } from "@/web/components/form";
import type { Room, PropertyArea, StaffRef } from "@/web/types";

const TYPES = ["CLEANING", "TURNDOWN", "MAINTENANCE", "INSPECTION", "RESTOCK", "OTHER"];
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"];

export function TaskFormModal({
  open,
  onClose,
  onSaved,
  preset,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Pre-target the task at a room or area (e.g. clicked on the map). */
  preset?: { roomId?: string; areaId?: string; label?: string };
}) {
  const { submit, submitting, error, fieldErrors } = useMutation();
  const rooms = useApi<Room[]>(() => api.get<Room[]>("/api/rooms"), []);
  const areas = useApi<PropertyArea[]>(() => api.get<PropertyArea[]>("/api/areas"), []);
  const staff = useApi<StaffRef[]>(() => api.get<StaffRef[]>("/api/staff"), []);

  const [form, setForm] = useState({
    title: "",
    type: "CLEANING",
    priority: "NORMAL",
    target: preset?.roomId ? `room:${preset.roomId}` : preset?.areaId ? `area:${preset.areaId}` : "",
    assignedToStaffId: "",
    notes: "",
  });
  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const [kind, id] = form.target.split(":");
    const body = {
      title: form.title,
      type: form.type,
      priority: form.priority,
      roomId: kind === "room" ? id : undefined,
      areaId: kind === "area" ? id : undefined,
      assignedToStaffId: form.assignedToStaffId || undefined,
      notes: form.notes || undefined,
    };
    const res = await submit(() => api.post("/api/housekeeping/tasks", body));
    if (res !== undefined) onSaved();
  }

  const housekeepers = (staff.data ?? []).filter((s) =>
    ["HOUSEKEEPING", "MANAGER", "ADMIN"].includes(s.role),
  );

  return (
    <Modal open={open} onClose={onClose} title="New housekeeping task">
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        {preset?.label && (
          <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">Target: {preset.label}</p>
        )}
        <Field label="Title" required error={fieldErrors.title}>
          <input className="input" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Deep clean & restock" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <select className="input" value={form.type} onChange={(e) => set("type", e.target.value)}>
              {TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
            </select>
          </Field>
          <Field label="Priority">
            <select className="input" value={form.priority} onChange={(e) => set("priority", e.target.value)}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Location (room or area)">
          <select className="input" value={form.target} onChange={(e) => set("target", e.target.value)}>
            <option value="">General property</option>
            <optgroup label="Rooms">
              {(rooms.data ?? []).map((r) => <option key={r.id} value={`room:${r.id}`}>Room {r.number}</option>)}
            </optgroup>
            <optgroup label="Areas">
              {(areas.data ?? []).map((a) => <option key={a.id} value={`area:${a.id}`}>{a.name}</option>)}
            </optgroup>
          </select>
        </Field>
        <Field label="Assign to">
          <select className="input" value={form.assignedToStaffId} onChange={(e) => set("assignedToStaffId", e.target.value)}>
            <option value="">Unassigned</option>
            {housekeepers.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName} · {s.role}</option>)}
          </select>
        </Field>
        <Field label="Notes">
          <textarea className="input min-h-[64px]" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <FormActions onCancel={onClose} submitting={submitting} submitLabel="Create task" />
        </div>
      </form>
    </Modal>
  );
}
