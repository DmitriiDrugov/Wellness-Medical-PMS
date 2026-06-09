"use client";

import { useState } from "react";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import { useMutation } from "@/web/use-mutation";
import { Modal } from "@/web/components/Modal";
import { Icon } from "@/web/components/ui";
import { Field, FormError, FormActions } from "@/web/components/form";
import type { Treatment } from "@/web/types";

type Line = { treatmentId: string; quantity: number };

export function PackageFormModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { submit, submitting, error, fieldErrors } = useMutation();
  const treatments = useApi<Treatment[]>(() => api.get<Treatment[]>("/api/treatments"), []);
  const options = treatments.data ?? [];

  const [name, setName] = useState("");
  const [priceMajor, setPriceMajor] = useState("0");
  const [lines, setLines] = useState<Line[]>([{ treatmentId: "", quantity: 1 }]);

  function setLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((ls) => [...ls, { treatmentId: "", quantity: 1 }]);
  }
  function removeLine(i: number) {
    setLines((ls) => ls.filter((_, idx) => idx !== i));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      name,
      priceMinor: Math.round(Number(priceMajor) * 100),
      active: true,
      items: lines.filter((l) => l.treatmentId).map((l) => ({ treatmentId: l.treatmentId, quantity: l.quantity })),
    };
    const result = await submit(() => api.post("/api/packages", body));
    if (result !== undefined) onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title="New Package">
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        <Field label="Name" required error={fieldErrors.name}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Price (HUF)" required error={fieldErrors.priceMinor}>
          <input className="input" type="number" min={0} value={priceMajor} onChange={(e) => setPriceMajor(e.target.value)} />
        </Field>
        <div>
          <span className="label">Items</span>
          {fieldErrors.items && <span className="mb-1 block text-xs text-error">{fieldErrors.items}</span>}
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex gap-2">
                <select className="input flex-1" value={l.treatmentId} onChange={(e) => setLine(i, { treatmentId: e.target.value })}>
                  <option value="">Select treatment…</option>
                  {options.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <input className="input w-20" type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} />
                <button type="button" className="btn-ghost px-2" onClick={() => removeLine(i)} aria-label="Remove">
                  <Icon name="close" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn-ghost mt-2" onClick={addLine}>
            <Icon name="add" className="text-[18px]" /> Add item
          </button>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <FormActions onCancel={onClose} submitting={submitting} submitLabel="Create package" />
        </div>
      </form>
    </Modal>
  );
}
