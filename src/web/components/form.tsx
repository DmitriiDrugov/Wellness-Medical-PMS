// src/web/components/form.tsx
"use client";

import type { ReactNode } from "react";

export function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">
        {label}
        {required && <span className="text-error"> *</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-error">{error}</span>}
    </label>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="rounded-lg bg-error-container/60 px-3 py-2 text-sm text-on-error-container">{message}</div>
  );
}

export function FormActions({
  onCancel,
  submitLabel = "Save",
  submitting,
}: {
  onCancel: () => void;
  submitLabel?: string;
  submitting?: boolean;
}) {
  return (
    <>
      <button type="button" className="btn-ghost" onClick={onCancel} disabled={submitting}>
        Cancel
      </button>
      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? "Saving…" : submitLabel}
      </button>
    </>
  );
}
