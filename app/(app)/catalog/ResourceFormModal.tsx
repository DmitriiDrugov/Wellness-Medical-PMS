"use client";

import { useState } from "react";
import { api } from "@/web/api-client";
import { useMutation } from "@/web/use-mutation";
import { Modal } from "@/web/components/Modal";
import { Field, FormError, FormActions } from "@/web/components/form";
import type { Resource } from "@/web/types";

export function ResourceFormModal({
  open,
  resource,
  onClose,
  onSaved,
}: {
  open: boolean;
  resource: Resource | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { submit, submitting, error, fieldErrors } = useMutation();
  const [form, setForm] = useState({
    name: resource?.name ?? "",
    type: (resource?.type as string) ?? "TREATMENT_ROOM",
    capacity: String(resource?.capacity ?? 1),
    active: resource?.active ?? true,
  });
  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      name: form.name,
      type: form.type,
      capacity: Number(form.capacity),
      active: form.active,
    };
    const result = resource
      ? await submit(() => api.patch(`/api/resources/${resource.id}`, body))
      : await submit(() => api.post("/api/resources", body));
    if (result !== undefined) onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title={resource ? "Edit Resource" : "New Therapy Room"}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        <Field label="Name" required error={fieldErrors.name}>
          <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Massage Room 1" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" required error={fieldErrors.type}>
            <select className="input" value={form.type} onChange={(e) => set("type", e.target.value)}>
              <option value="TREATMENT_ROOM">Treatment room</option>
              <option value="EQUIPMENT">Equipment</option>
            </select>
          </Field>
          <Field label="Capacity" required error={fieldErrors.capacity}>
            <input className="input" type="number" min={1} value={form.capacity} onChange={(e) => set("capacity", e.target.value)} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Active
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <FormActions onCancel={onClose} submitting={submitting} submitLabel={resource ? "Save changes" : "Create room"} />
        </div>
      </form>
    </Modal>
  );
}
