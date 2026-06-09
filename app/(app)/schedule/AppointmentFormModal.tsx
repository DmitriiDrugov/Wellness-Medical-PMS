"use client";

import { useState } from "react";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import { useMutation } from "@/web/use-mutation";
import { Modal } from "@/web/components/Modal";
import { Field, FormError, FormActions } from "@/web/components/form";
import { fullName } from "@/web/format";
import type { Guest, Treatment, StaffRef } from "@/web/types";

interface ResourceRef {
  id: string;
  name: string;
  type: string;
}

export function AppointmentFormModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { submit, submitting, error, fieldErrors } = useMutation();
  const guests = useApi<Guest[]>(() => api.get<Guest[]>("/api/guests", { pageSize: 100 }), []);
  const treatments = useApi<Treatment[]>(() => api.get<Treatment[]>("/api/treatments"), []);
  const therapists = useApi<StaffRef[]>(() => api.get<StaffRef[]>("/api/staff", { role: "THERAPIST" }), []);
  const resources = useApi<ResourceRef[]>(() => api.get<ResourceRef[]>("/api/resources"), []);

  const [form, setForm] = useState({ guestId: "", treatmentId: "", therapistId: "", resourceId: "", startTime: "" });
  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      guestId: form.guestId,
      treatmentId: form.treatmentId,
      therapistId: form.therapistId,
      resourceId: form.resourceId,
      startTime: new Date(form.startTime).toISOString(),
    };
    const result = await submit(() => api.post("/api/appointments", body));
    if (result !== undefined) onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title="Book Appointment">
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        <Field label="Guest" required error={fieldErrors.guestId}>
          <select className="input" value={form.guestId} onChange={(e) => set("guestId", e.target.value)}>
            <option value="">Select guest…</option>
            {(guests.data ?? []).map((g) => (
              <option key={g.id} value={g.id}>{fullName(g.firstName, g.lastName)}</option>
            ))}
          </select>
        </Field>
        <Field label="Treatment" required error={fieldErrors.treatmentId}>
          <select className="input" value={form.treatmentId} onChange={(e) => set("treatmentId", e.target.value)}>
            <option value="">Select treatment…</option>
            {(treatments.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Therapist" required error={fieldErrors.therapistId}>
            <select className="input" value={form.therapistId} onChange={(e) => set("therapistId", e.target.value)}>
              <option value="">Select…</option>
              {(therapists.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>{fullName(s.firstName, s.lastName)}</option>
              ))}
            </select>
          </Field>
          <Field label="Resource" required error={fieldErrors.resourceId}>
            <select className="input" value={form.resourceId} onChange={(e) => set("resourceId", e.target.value)}>
              <option value="">Select…</option>
              {(resources.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Start time" required error={fieldErrors.startTime}>
          <input className="input" type="datetime-local" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <FormActions onCancel={onClose} submitting={submitting} submitLabel="Book appointment" />
        </div>
      </form>
    </Modal>
  );
}
