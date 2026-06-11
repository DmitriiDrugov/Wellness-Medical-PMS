"use client";

import { useState } from "react";
import { api } from "@/web/api-client";
import { useMutation } from "@/web/use-mutation";
import { Modal } from "@/web/components/Modal";
import { Field, FormError, FormActions } from "@/web/components/form";

const KINDS = ["COMMON", "POOL", "SPA", "RESTAURANT", "CORRIDOR", "BACK_OFFICE", "OUTDOOR", "OTHER"];

export function AreaFormModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { submit, submitting, error, fieldErrors } = useMutation();
  const [form, setForm] = useState({ name: "", kind: "COMMON", floor: "0", notes: "" });
  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      name: form.name,
      kind: form.kind,
      floor: form.floor === "" ? undefined : Number(form.floor),
      notes: form.notes || undefined,
    };
    const res = await submit(() => api.post("/api/areas", body));
    if (res !== undefined) onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title="New area / zone">
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        <Field label="Name" required error={fieldErrors.name}>
          <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Thermal Pool, Lobby" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind">
            <select className="input" value={form.kind} onChange={(e) => set("kind", e.target.value)}>
              {KINDS.map((k) => <option key={k} value={k}>{k.replace("_", " ")}</option>)}
            </select>
          </Field>
          <Field label="Floor" error={fieldErrors.floor}>
            <input className="input" type="number" value={form.floor} onChange={(e) => set("floor", e.target.value)} />
          </Field>
        </div>
        <Field label="Notes">
          <input className="input" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <FormActions onCancel={onClose} submitting={submitting} submitLabel="Create area" />
        </div>
      </form>
    </Modal>
  );
}
