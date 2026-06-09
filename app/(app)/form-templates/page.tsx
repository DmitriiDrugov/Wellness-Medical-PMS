"use client";

import { useState } from "react";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import { useMutation } from "@/web/use-mutation";
import type { FormTemplate } from "@/web/types";
import { PageHeader, Card, StatusPill, Icon, DataState } from "@/web/components/ui";
import { formatDate } from "@/web/format";
import { TemplateFormModal } from "./TemplateFormModal";
import { ConfirmDialog } from "@/web/components/ConfirmDialog";

const TYPE_LABEL: Record<FormTemplate["type"], string> = {
  INTAKE: "Intake",
  MEDICAL_HISTORY: "Medical",
  CUSTOM: "Custom",
};

export default function FormTemplatesPage() {
  const { data, loading, error, reload } = useApi<FormTemplate[]>(
    () => api.get<FormTemplate[]>("/api/form-templates", { pageSize: 100 }),
    [],
  );
  const templates = data ?? [];

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FormTemplate | null>(null);
  const [deleting, setDeleting] = useState<FormTemplate | null>(null);
  const del = useMutation();

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(t: FormTemplate) {
    setEditing(t);
    setModalOpen(true);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const ok = await del.submit(() => api.del(`/api/form-templates/${deleting.id}`));
    if (ok !== undefined) {
      setDeleting(null);
      reload();
    }
  }

  return (
    <div>
      <PageHeader
        title="Form Templates"
        subtitle="Clinical intake and medical-history form definitions. Editing a template bumps its version."
        actions={
          <button className="btn-primary" onClick={openCreate}>
            <Icon name="add" className="text-[20px]" /> New Template
          </button>
        }
      />

      <Card className="p-0">
        <DataState loading={loading} error={error} empty={templates.length === 0} emptyLabel="No form templates yet.">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant/50 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                <th className="px-4 py-3">Template</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b border-outline-variant/30 hover:bg-[#f4f8f7]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Icon name="description" className="text-[20px] text-on-surface-variant" />
                      <span className="font-medium text-on-surface">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone="primary">{TYPE_LABEL[t.type]}</StatusPill>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">v{t.version}</td>
                  <td className="px-4 py-3">
                    <StatusPill tone={t.active ? "success" : "neutral"}>{t.active ? "Active" : "Inactive"}</StatusPill>
                  </td>
                  <td className="px-4 py-3 text-on-surface-variant">{formatDate(t.updatedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className="btn-ghost" onClick={() => openEdit(t)} title="Edit template">
                        <Icon name="edit" className="text-[18px]" />
                      </button>
                      <button
                        className="btn-ghost text-error"
                        onClick={() => setDeleting(t)}
                        title="Delete template"
                      >
                        <Icon name="delete" className="text-[18px]" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </Card>

      <p className="mt-4 text-xs text-on-surface-variant">
        Note: the mockup&apos;s 3-state status (Published / Draft / Archived) and a &quot;Consent&quot; category map to the
        backend&apos;s <code>active</code> flag and form types (Intake / Medical / Custom); consents are a separate entity.
      </p>

      {modalOpen && (
        <TemplateFormModal
          open={modalOpen}
          template={editing}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            reload();
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete template"
        message={`Delete template "${deleting?.name ?? ""}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        busy={del.submitting}
        error={del.error}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
