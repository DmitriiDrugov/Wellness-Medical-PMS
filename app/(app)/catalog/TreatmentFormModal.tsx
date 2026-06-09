"use client";

import { useState } from "react";
import { api } from "@/web/api-client";
import { useMutation } from "@/web/use-mutation";
import { Modal } from "@/web/components/Modal";
import { Field, FormError, FormActions } from "@/web/components/form";
import type { Treatment } from "@/web/types";

export function TreatmentFormModal({
  open,
  treatment,
  onClose,
  onSaved,
}: {
  open: boolean;
  treatment: Treatment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { submit, submitting, error, fieldErrors } = useMutation();
  const [form, setForm] = useState({
    name: treatment?.name ?? "",
    description: treatment?.description ?? "",
    durationMinutes: String(treatment?.durationMinutes ?? 50),
    priceMajor: String((treatment?.priceMinor ?? 0) / 100),
    requiredResourceType: (treatment?.requiredResourceType as string) ?? "TREATMENT_ROOM",
    active: treatment?.active ?? true,
  });
  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      name: form.name,
      description: form.description || undefined,
      durationMinutes: Number(form.durationMinutes),
      priceMinor: Math.round(Number(form.priceMajor) * 100),
      requiredResourceType: form.requiredResourceType,
      active: form.active,
    };
    const result = treatment
      ? await submit(() => api.patch(`/api/treatments/${treatment.id}`, body))
      : await submit(() => api.post("/api/treatments", body));
    if (result !== undefined) onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title={treatment ? "Edit Treatment" : "New Treatment"}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        <Field label="Name" required error={fieldErrors.name}>
          <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Description" error={fieldErrors.description}>
          <textarea className="input" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Duration (min)" required error={fieldErrors.durationMinutes}>
            <input className="input" type="number" min={5} value={form.durationMinutes} onChange={(e) => set("durationMinutes", e.target.value)} />
          </Field>
          <Field label="Price (HUF)" required error={fieldErrors.priceMinor}>
            <input className="input" type="number" min={0} value={form.priceMajor} onChange={(e) => set("priceMajor", e.target.value)} />
          </Field>
        </div>
        <Field label="Required resource" required error={fieldErrors.requiredResourceType}>
          <select className="input" value={form.requiredResourceType} onChange={(e) => set("requiredResourceType", e.target.value)}>
            <option value="TREATMENT_ROOM">Treatment room</option>
            <option value="EQUIPMENT">Equipment</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Active
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <FormActions onCancel={onClose} submitting={submitting} submitLabel={treatment ? "Save changes" : "Create treatment"} />
        </div>
      </form>
    </Modal>
  );
}
