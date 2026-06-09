"use client";

import { useEffect, useState } from "react";
import { api } from "@/web/api-client";
import { useMutation } from "@/web/use-mutation";
import { Modal } from "@/web/components/Modal";
import { Field, FormError, FormActions } from "@/web/components/form";
import type { Guest } from "@/web/types";

type Props = {
  open: boolean;
  guest: Guest | null; // null => create
  onClose: () => void;
  onSaved: () => void;
};

function initial(g: Guest | null) {
  return {
    firstName: g?.firstName ?? "",
    lastName: g?.lastName ?? "",
    email: g?.email ?? "",
    phone: g?.phone ?? "",
    nationality: g?.nationality ?? "",
    gdprConsentDataProcessing: g?.gdprConsentDataProcessing ?? false,
    gdprConsentMarketing: g?.gdprConsentMarketing ?? false,
  };
}

export function GuestFormModal({ open, guest, onClose, onSaved }: Props) {
  const { submit, submitting, error, fieldErrors, reset } = useMutation();
  const [form, setForm] = useState(() => initial(guest));

  useEffect(() => {
    if (open) {
      setForm(initial(guest));
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, guest?.id]);

  function set<K extends keyof ReturnType<typeof initial>>(k: K, v: ReturnType<typeof initial>[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email || undefined,
      phone: form.phone || undefined,
      nationality: form.nationality || undefined,
      gdprConsentDataProcessing: form.gdprConsentDataProcessing,
      gdprConsentMarketing: form.gdprConsentMarketing,
    };
    const result = guest
      ? await submit(() => api.patch(`/api/guests/${guest.id}`, body))
      : await submit(() => api.post("/api/guests", body));
    if (result !== undefined) onSaved();
  }

  return (
    <Modal open={open} onClose={handleClose} title={guest ? "Edit Guest" : "New Guest"}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required error={fieldErrors.firstName}>
            <input
              className="input"
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
            />
          </Field>
          <Field label="Last name" required error={fieldErrors.lastName}>
            <input
              className="input"
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Email" error={fieldErrors.email}>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" error={fieldErrors.phone}>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>
          <Field label="Nationality (ISO-2)" error={fieldErrors.nationality}>
            <input
              className="input"
              maxLength={2}
              value={form.nationality}
              onChange={(e) => set("nationality", e.target.value.toUpperCase())}
            />
          </Field>
        </div>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.gdprConsentDataProcessing}
              onChange={(e) => set("gdprConsentDataProcessing", e.target.checked)}
            />
            GDPR data processing
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.gdprConsentMarketing}
              onChange={(e) => set("gdprConsentMarketing", e.target.checked)}
            />
            Marketing
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <FormActions
            onCancel={handleClose}
            submitting={submitting}
            submitLabel={guest ? "Save changes" : "Create guest"}
          />
        </div>
      </form>
    </Modal>
  );
}
