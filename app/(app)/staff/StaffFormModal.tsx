"use client";

import { useEffect, useState } from "react";
import { api } from "@/web/api-client";
import { useMutation } from "@/web/use-mutation";
import { Modal } from "@/web/components/Modal";
import { Field, FormError, FormActions } from "@/web/components/form";
import type { StaffMember } from "@/web/types";

type Props = {
  open: boolean;
  member: StaffMember | null; // null => create
  selfId: string; // the signed-in admin (own role select is locked)
  onClose: () => void;
  onSaved: () => void;
};

export const ROLE_OPTIONS = [
  { value: "RECEPTION", label: "Reception" },
  { value: "RESERVATION_ADMIN", label: "Reservation Admin" },
  { value: "THERAPIST", label: "Therapist" },
  { value: "HOUSEKEEPING", label: "Housekeeping" },
  { value: "MANAGER", label: "Manager" },
  { value: "ADMIN", label: "Administrator" },
] as const;

function initial(m: StaffMember | null) {
  return {
    firstName: m?.firstName ?? "",
    lastName: m?.lastName ?? "",
    email: m?.email ?? "",
    role: m?.role && m.role !== "AI_AGENT" ? m.role : "RECEPTION",
    password: "",
  };
}

export function StaffFormModal({ open, member, selfId, onClose, onSaved }: Props) {
  const { submit, submitting, error, fieldErrors, reset } = useMutation();
  const [form, setForm] = useState(() => initial(member));
  const isSelf = member?.id === selfId;

  useEffect(() => {
    if (open) {
      setForm(initial(member));
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, member?.id]);

  function set<K extends keyof ReturnType<typeof initial>>(k: K, v: ReturnType<typeof initial>[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = member
      ? await submit(() =>
          api.patch(`/api/staff/${member.id}`, {
            firstName: form.firstName,
            lastName: form.lastName,
            ...(isSelf ? {} : { role: form.role }),
            ...(form.password ? { password: form.password } : {}),
          }),
        )
      : await submit(() =>
          api.post("/api/staff", {
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            role: form.role,
            password: form.password,
          }),
        );
    if (result !== undefined) onSaved();
  }

  return (
    <Modal open={open} onClose={handleClose} title={member ? "Edit staff member" : "New staff member"}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />

        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required error={fieldErrors.firstName}>
            <input className="input" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required />
          </Field>
          <Field label="Last name" required error={fieldErrors.lastName}>
            <input className="input" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required />
          </Field>
        </div>

        <Field label="Email" required error={fieldErrors.email}>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            required
            disabled={!!member} // login identity; changing it would orphan the account
          />
        </Field>

        <Field label="Role" required error={fieldErrors.role}>
          <select
            className="input"
            value={form.role}
            onChange={(e) => set("role", e.target.value as ReturnType<typeof initial>["role"])}
            disabled={isSelf}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          {isSelf && <span className="mt-1 block text-xs text-on-surface-variant">You cannot change your own role.</span>}
        </Field>

        <Field
          label={member ? "New password (optional — resets their sessions)" : "Password"}
          required={!member}
          error={fieldErrors.password}
        >
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            required={!member}
            minLength={8}
            placeholder={member ? "Leave blank to keep current" : "At least 8 characters"}
          />
        </Field>

        <div className="flex justify-end gap-2 border-t border-outline-variant/50 pt-4">
          <FormActions onCancel={handleClose} submitting={submitting} submitLabel={member ? "Save changes" : "Create account"} />
        </div>
      </form>
    </Modal>
  );
}
