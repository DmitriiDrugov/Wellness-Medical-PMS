"use client";

import { useEffect, useState } from "react";
import { api } from "@/web/api-client";
import { useMutation } from "@/web/use-mutation";
import { Modal } from "@/web/components/Modal";
import { Field, FormError, FormActions } from "@/web/components/form";
import type { FormTemplate } from "@/web/types";

type Props = {
  open: boolean;
  template: FormTemplate | null; // null => create
  onClose: () => void;
  onSaved: () => void;
};

function initial(t: FormTemplate | null) {
  return {
    name: t?.name ?? "",
    type: t?.type ?? ("INTAKE" as FormTemplate["type"]),
    active: t?.active ?? true,
  };
}

export function TemplateFormModal({ open, template, onClose, onSaved }: Props) {
  const { submit, submitting, error, fieldErrors, reset } = useMutation();
  const [form, setForm] = useState(() => initial(template));

  useEffect(() => {
    if (open) {
      setForm(initial(template));
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template?.id]);

  function set<K extends keyof ReturnType<typeof initial>>(k: K, v: ReturnType<typeof initial>[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // `schema` is required for create but is an open-ended JSON structure (question definitions).
    // We send an empty object as the default — editors can extend this via API or future UI.
    const body = {
      name: form.name,
      type: form.type,
      schema: {} as Record<string, unknown>,
      active: form.active,
    };
    const result = template
      ? await submit(() => api.patch(`/api/form-templates/${template.id}`, body))
      : await submit(() => api.post("/api/form-templates", body));
    if (result !== undefined) onSaved();
  }

  return (
    <Modal open={open} onClose={handleClose} title={template ? "Edit Template" : "New Template"}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        <Field label="Name" required error={fieldErrors.name}>
          <input
            className="input"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <Field label="Category" required error={fieldErrors.type}>
          <select
            className="input"
            value={form.type}
            onChange={(e) => set("type", e.target.value as FormTemplate["type"])}
          >
            <option value="INTAKE">Intake</option>
            <option value="MEDICAL_HISTORY">Medical History</option>
            <option value="CUSTOM">Custom</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => set("active", e.target.checked)}
          />
          Active
        </label>
        <p className="text-xs text-on-surface-variant">
          Note: the template schema (question definitions) defaults to an empty structure and can be
          extended via the API.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <FormActions
            onCancel={handleClose}
            submitting={submitting}
            submitLabel={template ? "Save changes" : "Create template"}
          />
        </div>
      </form>
    </Modal>
  );
}
