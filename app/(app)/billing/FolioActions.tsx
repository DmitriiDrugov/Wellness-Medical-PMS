"use client";

import { useState } from "react";
import { api } from "@/web/api-client";
import { useMutation } from "@/web/use-mutation";
import { Modal } from "@/web/components/Modal";
import { ConfirmDialog } from "@/web/components/ConfirmDialog";
import { Icon } from "@/web/components/ui";
import { Field, FormError, FormActions } from "@/web/components/form";
import type { Folio } from "@/web/types";

export function FolioActions({ folio, onChanged }: { folio: Folio; onChanged: () => void }) {
  const [charge, setCharge] = useState(false);
  const [payment, setPayment] = useState(false);
  const [closing, setClosing] = useState(false);
  const close = useMutation();

  async function confirmClose() {
    const ok = await close.submit(() => api.post(`/api/folios/${folio.id}/close`));
    if (ok !== undefined) {
      setClosing(false);
      onChanged();
    }
  }

  const disabled = folio.status !== "OPEN";

  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn-secondary" disabled={disabled} onClick={() => setCharge(true)}>
        <Icon name="add" className="text-[18px]" /> Add charge
      </button>
      <button className="btn-secondary" disabled={disabled} onClick={() => setPayment(true)}>
        <Icon name="payments" className="text-[18px]" /> Add payment
      </button>
      <button className="btn-primary" disabled={disabled || folio.balanceMinor !== 0} onClick={() => setClosing(true)}>
        <Icon name="lock" className="text-[18px]" /> Close folio
      </button>

      {charge && (
        <ChargeModal
          open={charge}
          folioId={folio.id}
          onClose={() => setCharge(false)}
          onSaved={() => {
            setCharge(false);
            onChanged();
          }}
        />
      )}
      {payment && (
        <PaymentModal
          open={payment}
          folioId={folio.id}
          onClose={() => setPayment(false)}
          onSaved={() => {
            setPayment(false);
            onChanged();
          }}
        />
      )}
      <ConfirmDialog
        open={closing}
        title="Close folio"
        message="Close this folio? It must have a zero balance and cannot be reopened."
        confirmLabel="Close folio"
        busy={close.submitting}
        error={close.error}
        onConfirm={confirmClose}
        onClose={() => setClosing(false)}
      />
    </div>
  );
}

function ChargeModal({
  open,
  folioId,
  onClose,
  onSaved,
}: {
  open: boolean;
  folioId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { submit, submitting, error, fieldErrors } = useMutation();
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitMajor, setUnitMajor] = useState("0");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      description,
      quantity: Number(quantity),
      unitPriceMinor: Math.round(Number(unitMajor) * 100),
    };
    const ok = await submit(() => api.post(`/api/folios/${folioId}/charges`, body));
    if (ok !== undefined) onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add charge">
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        <Field label="Description" required error={fieldErrors.description}>
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity" required error={fieldErrors.quantity}>
            <input
              className="input"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </Field>
          <Field label="Unit price (HUF)" required error={fieldErrors.unitPriceMinor}>
            <input
              className="input"
              type="number"
              min={0}
              value={unitMajor}
              onChange={(e) => setUnitMajor(e.target.value)}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <FormActions onCancel={onClose} submitting={submitting} submitLabel="Add charge" />
        </div>
      </form>
    </Modal>
  );
}

function PaymentModal({
  open,
  folioId,
  onClose,
  onSaved,
}: {
  open: boolean;
  folioId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { submit, submitting, error, fieldErrors } = useMutation();
  const [amountMajor, setAmountMajor] = useState("0");
  const [method, setMethod] = useState("CARD");
  const [reference, setReference] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      amountMinor: Math.round(Number(amountMajor) * 100),
      method,
      reference: reference || undefined,
    };
    const ok = await submit(() => api.post(`/api/folios/${folioId}/payments`, body));
    if (ok !== undefined) onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add payment">
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        <Field label="Amount (HUF)" required error={fieldErrors.amountMinor}>
          <input
            className="input"
            type="number"
            min={0}
            value={amountMajor}
            onChange={(e) => setAmountMajor(e.target.value)}
          />
        </Field>
        <Field label="Method" required error={fieldErrors.method}>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="CARD">Card</option>
            <option value="CASH">Cash</option>
            <option value="TRANSFER">Bank transfer</option>
          </select>
        </Field>
        <Field label="Reference" error={fieldErrors.reference}>
          <input
            className="input"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <FormActions onCancel={onClose} submitting={submitting} submitLabel="Add payment" />
        </div>
      </form>
    </Modal>
  );
}
