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

const DOC_TYPES = ["", "PASSPORT", "NATIONAL_ID", "DRIVING_LICENCE"] as const;

function dateInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : "";
}

function initial(g: Guest | null) {
  return {
    firstName: g?.firstName ?? "",
    lastName: g?.lastName ?? "",
    email: g?.email ?? "",
    phone: g?.phone ?? "",
    nationality: g?.nationality ?? "",
    dateOfBirth: dateInput(g?.dateOfBirth),
    gender: g?.gender ?? "",
    placeOfBirth: g?.placeOfBirth ?? "",
    idDocumentType: g?.idDocumentType ?? "",
    idDocumentNumber: g?.idDocumentNumber ?? "",
    idDocumentExpiry: dateInput(g?.idDocumentExpiry),
    addressLine: g?.addressLine ?? "",
    city: g?.city ?? "",
    postalCode: g?.postalCode ?? "",
    country: g?.country ?? "",
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
      dateOfBirth: form.dateOfBirth || undefined,
      gender: form.gender || undefined,
      placeOfBirth: form.placeOfBirth || undefined,
      idDocumentType: form.idDocumentType || undefined,
      idDocumentNumber: form.idDocumentNumber || undefined,
      idDocumentExpiry: form.idDocumentExpiry || undefined,
      addressLine: form.addressLine || undefined,
      city: form.city || undefined,
      postalCode: form.postalCode || undefined,
      country: form.country || undefined,
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

        {/* Identity / travel document */}
        <p className="border-t border-outline-variant/40 pt-3 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          Identity
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date of birth" error={fieldErrors.dateOfBirth}>
            <input className="input" type="date" value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
          </Field>
          <Field label="Gender" error={fieldErrors.gender}>
            <input className="input" value={form.gender} onChange={(e) => set("gender", e.target.value)} />
          </Field>
        </div>
        <Field label="Place of birth" error={fieldErrors.placeOfBirth}>
          <input className="input" value={form.placeOfBirth} onChange={(e) => set("placeOfBirth", e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="ID type" error={fieldErrors.idDocumentType}>
            <select className="input" value={form.idDocumentType} onChange={(e) => set("idDocumentType", e.target.value)}>
              {DOC_TYPES.map((t) => (
                <option key={t} value={t}>{t ? t.replace("_", " ") : "—"}</option>
              ))}
            </select>
          </Field>
          <Field label="ID number" error={fieldErrors.idDocumentNumber}>
            <input className="input" value={form.idDocumentNumber} onChange={(e) => set("idDocumentNumber", e.target.value)} />
          </Field>
          <Field label="ID expiry" error={fieldErrors.idDocumentExpiry}>
            <input className="input" type="date" value={form.idDocumentExpiry} onChange={(e) => set("idDocumentExpiry", e.target.value)} />
          </Field>
        </div>

        {/* Address */}
        <p className="border-t border-outline-variant/40 pt-3 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          Address
        </p>
        <Field label="Address line" error={fieldErrors.addressLine}>
          <input className="input" value={form.addressLine} onChange={(e) => set("addressLine", e.target.value)} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="City" error={fieldErrors.city}>
            <input className="input" value={form.city} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label="Postal code" error={fieldErrors.postalCode}>
            <input className="input" value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
          </Field>
          <Field label="Country" error={fieldErrors.country}>
            <input className="input" value={form.country} onChange={(e) => set("country", e.target.value)} />
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
