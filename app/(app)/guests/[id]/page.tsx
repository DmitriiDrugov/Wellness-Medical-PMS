"use client";

import { use, useState } from "react";
import Link from "next/link";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import { useMutation } from "@/web/use-mutation";
import { useAuth } from "@/web/auth-context";
import { can } from "@/platform/rbac";
import type { Guest, MedicalProfile, GuestDocument, Reservation, FolioSummary } from "@/web/types";
import { PageHeader, Card, Icon, DataState, StatusPill } from "@/web/components/ui";
import { Field } from "@/web/components/form";
import { fullName, initials, formatDate, formatMinor } from "@/web/format";

type Tab = "identity" | "medical" | "documents" | "bookings" | "folio";

export default function PatientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const canClinical = user ? can(user.role, "clinical:read") : false;

  const [tab, setTab] = useState<Tab>("identity");
  const guest = useApi<Guest>(() => api.get<Guest>(`/api/guests/${id}`), [id]);

  const tabs: [Tab, string][] = [
    ["identity", "Identity"],
    ...(canClinical ? ([["medical", "Medical"]] as [Tab, string][]) : []),
    ["documents", "Documents"],
    ["bookings", "Bookings"],
    ["folio", "Folio"],
  ];

  const g = guest.data;

  return (
    <div>
      <div className="mb-4">
        <Link href="/guests" className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface">
          <Icon name="chevron_left" className="text-[18px]" /> Back to guests
        </Link>
      </div>

      <PageHeader
        title={g ? fullName(g.firstName, g.lastName) : "Patient profile"}
        subtitle="One patient, every window — registration, stay, treatments and billing."
      />

      <DataState loading={guest.loading} error={guest.error}>
        {g && (
          <>
            {/* Identity header card */}
            <Card className="mb-4 flex flex-wrap items-center gap-4">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-lg font-semibold text-primary">
                {initials(g.firstName, g.lastName)}
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-on-surface">{fullName(g.firstName, g.lastName)}</h2>
                <p className="text-sm text-on-surface-variant">
                  {[g.nationality, g.dateOfBirth ? `b. ${formatDate(g.dateOfBirth)}` : null, g.email]
                    .filter(Boolean)
                    .join(" · ") || "No contact details yet"}
                </p>
              </div>
              <div className="ml-auto flex gap-2">
                <StatusPill tone={g.gdprConsentDataProcessing ? "success" : "warning"}>
                  GDPR {g.gdprConsentDataProcessing ? "✓" : "✗"}
                </StatusPill>
              </div>
            </Card>

            {/* Tabs */}
            <div className="mb-5 flex flex-wrap gap-1 border-b border-outline-variant/50">
              {tabs.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
                    tab === key
                      ? "border-primary text-primary"
                      : "border-transparent text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "identity" && <IdentityTab g={g} />}
            {tab === "medical" && canClinical && <MedicalTab guestId={id} />}
            {tab === "documents" && <DocumentsTab guestId={id} />}
            {tab === "bookings" && <BookingsTab guestId={id} />}
            {tab === "folio" && <FolioTab guestId={id} />}
          </>
        )}
      </DataState>
    </div>
  );
}

function IdentityTab({ g }: { g: Guest }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-on-surface-variant">Personal</h3>
        <dl className="space-y-2 text-sm">
          <Row label="Full name" value={fullName(g.firstName, g.lastName)} />
          <Row label="Date of birth" value={g.dateOfBirth ? formatDate(g.dateOfBirth) : null} />
          <Row label="Gender" value={g.gender} />
          <Row label="Place of birth" value={g.placeOfBirth} />
          <Row label="Nationality" value={g.nationality} />
        </dl>
      </Card>
      <Card>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-on-surface-variant">Travel document</h3>
        <dl className="space-y-2 text-sm">
          <Row label="Document type" value={g.idDocumentType?.replace("_", " ") ?? null} />
          <Row label="Document number" value={g.idDocumentNumber} />
          <Row label="Expiry" value={g.idDocumentExpiry ? formatDate(g.idDocumentExpiry) : null} />
        </dl>
      </Card>
      <Card>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-on-surface-variant">Contact</h3>
        <dl className="space-y-2 text-sm">
          <Row label="Email" value={g.email} />
          <Row label="Phone" value={g.phone} />
        </dl>
      </Card>
      <Card>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-on-surface-variant">Address</h3>
        <dl className="space-y-2 text-sm">
          <Row label="Street" value={g.addressLine} />
          <Row label="City" value={g.city} />
          <Row label="Postal code" value={g.postalCode} />
          <Row label="Country" value={g.country} />
        </dl>
      </Card>
    </div>
  );
}

const MEDICAL_FIELDS: [keyof MedicalForm, string][] = [
  ["dietaryNotes", "Dietary notes"],
  ["allergies", "Allergies"],
  ["contraindications", "Contraindications / complications"],
  ["currentMedications", "Current medications"],
  ["prescriptions", "Prescriptions"],
  ["mobilityNotes", "Mobility notes"],
  ["generalNotes", "General clinical notes"],
];
type MedicalForm = {
  dietaryNotes: string;
  allergies: string;
  contraindications: string;
  currentMedications: string;
  prescriptions: string;
  mobilityNotes: string;
  generalNotes: string;
};

function MedicalTab({ guestId }: { guestId: string }) {
  const { user } = useAuth();
  const canEdit = user ? can(user.role, "clinical:write") : false;
  const profile = useApi<MedicalProfile | null>(
    () => api.get<MedicalProfile | null>(`/api/guests/${guestId}/medical-profile`),
    [guestId],
  );
  const save = useMutation();
  const [form, setForm] = useState<MedicalForm | null>(null);

  // Seed the editable form once data arrives.
  const seeded = form ?? toForm(profile.data);
  function set<K extends keyof MedicalForm>(k: K, v: string) {
    setForm({ ...seeded, [k]: v });
  }

  async function persist() {
    const body = Object.fromEntries(Object.entries(seeded).map(([k, v]) => [k, v || null]));
    const res = await save.submit(() => api.put<MedicalProfile>(`/api/guests/${guestId}/medical-profile`, body));
    if (res !== undefined) {
      setForm(null);
      profile.reload();
    }
  }

  return (
    <Card>
      <div className="mb-4 flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs text-[#7a4f17]">
        <Icon name="lock" className="text-[16px]" /> Clinical data — access is audited.
      </div>
      <DataState loading={profile.loading} error={profile.error}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {MEDICAL_FIELDS.map(([key, label]) => (
            <Field key={key} label={label}>
              <textarea
                className="input min-h-[72px]"
                value={seeded[key]}
                disabled={!canEdit}
                onChange={(e) => set(key, e.target.value)}
              />
            </Field>
          ))}
        </div>
        {canEdit && (
          <div className="mt-4 flex items-center gap-3">
            <button className="btn-primary" onClick={persist} disabled={save.submitting}>
              <Icon name="save" className="text-[18px]" /> {save.submitting ? "Saving…" : "Save medical profile"}
            </button>
            {save.error && <span className="text-sm text-error">{save.error}</span>}
          </div>
        )}
      </DataState>
    </Card>
  );
}

function toForm(p: MedicalProfile | null | undefined): MedicalForm {
  return {
    dietaryNotes: p?.dietaryNotes ?? "",
    allergies: p?.allergies ?? "",
    contraindications: p?.contraindications ?? "",
    currentMedications: p?.currentMedications ?? "",
    prescriptions: p?.prescriptions ?? "",
    mobilityNotes: p?.mobilityNotes ?? "",
    generalNotes: p?.generalNotes ?? "",
  };
}

const DOC_KINDS = ["PASSPORT", "MEDICAL_REPORT", "PRESCRIPTION", "CONSENT", "OTHER"];

function DocumentsTab({ guestId }: { guestId: string }) {
  const docs = useApi<GuestDocument[]>(() => api.get<GuestDocument[]>(`/api/guests/${guestId}/documents`), [guestId]);
  const add = useMutation();
  const del = useMutation();
  const [form, setForm] = useState({ kind: "PASSPORT", label: "", externalRef: "" });

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const res = await add.submit(() => api.post(`/api/guests/${guestId}/documents`, form));
    if (res !== undefined) {
      setForm({ kind: "PASSPORT", label: "", externalRef: "" });
      docs.reload();
    }
  }
  async function remove(docId: string) {
    const res = await del.submit(() => api.del(`/api/guests/${guestId}/documents/${docId}`));
    if (res !== undefined) docs.reload();
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2 p-0">
        <DataState loading={docs.loading} error={docs.error} empty={(docs.data ?? []).length === 0} emptyLabel="No documents on file.">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant/50 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Label</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(docs.data ?? []).map((d) => (
                <tr key={d.id} className="border-b border-outline-variant/30">
                  <td className="px-4 py-3"><StatusPill tone="info">{d.kind.replace("_", " ")}</StatusPill></td>
                  <td className="px-4 py-3 font-medium text-on-surface">{d.label}</td>
                  <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">{d.externalRef}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-ghost text-error px-2" onClick={() => remove(d.id)} disabled={del.submitting} aria-label="Remove">
                      <Icon name="delete" className="text-[18px]" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-on-surface-variant">Attach document</h3>
        <form onSubmit={onAdd} className="space-y-3">
          <Field label="Kind">
            <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {DOC_KINDS.map((k) => <option key={k} value={k}>{k.replace("_", " ")}</option>)}
            </select>
          </Field>
          <Field label="Label">
            <input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Passport scan" />
          </Field>
          <Field label="External reference (URL / storage key)">
            <input className="input" value={form.externalRef} onChange={(e) => setForm({ ...form, externalRef: e.target.value })} placeholder="s3://… or https://…" />
          </Field>
          {add.error && <p className="text-sm text-error">{add.error}</p>}
          <button className="btn-primary w-full justify-center" disabled={add.submitting || !form.label || !form.externalRef}>
            <Icon name="add" className="text-[18px]" /> {add.submitting ? "Adding…" : "Add document"}
          </button>
        </form>
        <p className="mt-3 text-xs text-on-surface-variant">References only — no files are stored by the PMS.</p>
      </Card>
    </div>
  );
}

function BookingsTab({ guestId }: { guestId: string }) {
  const bookings = useApi<Reservation[]>(() => api.get<Reservation[]>("/api/reservations", { guestId, pageSize: 100 }), [guestId]);
  return (
    <Card className="p-0">
      <DataState loading={bookings.loading} error={bookings.error} empty={(bookings.data ?? []).length === 0} emptyLabel="No bookings for this patient yet.">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-outline-variant/50 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              <th className="px-4 py-3">Room</th>
              <th className="px-4 py-3">Dates</th>
              <th className="px-4 py-3">Guests</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(bookings.data ?? []).map((b) => (
              <tr key={b.id} className="border-b border-outline-variant/30">
                <td className="px-4 py-3 font-medium text-on-surface">{b.room ? `Room ${b.room.number}` : b.roomType?.name ?? "Unassigned"}</td>
                <td className="px-4 py-3 text-on-surface-variant">{formatDate(b.checkInDate)} → {formatDate(b.checkOutDate)}</td>
                <td className="px-4 py-3 text-on-surface-variant">{b.adults}+{b.children}</td>
                <td className="px-4 py-3"><StatusPill tone="neutral">{b.status}</StatusPill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataState>
    </Card>
  );
}

function FolioTab({ guestId }: { guestId: string }) {
  const folios = useApi<FolioSummary[]>(() => api.get<FolioSummary[]>("/api/folios", { guestId }), [guestId]);
  const list = folios.data ?? [];
  return (
    <Card className="p-0">
      <DataState loading={folios.loading} error={folios.error} empty={list.length === 0} emptyLabel="No folios for this patient yet.">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-outline-variant/50 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              <th className="px-4 py-3">Folio</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Charges</th>
              <th className="px-4 py-3">Payments</th>
              <th className="px-4 py-3">Balance</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((f) => (
              <tr key={f.id} className="border-b border-outline-variant/30">
                <td className="px-4 py-3 font-mono text-xs text-on-surface-variant">{f.id.slice(0, 8)}</td>
                <td className="px-4 py-3"><StatusPill tone={f.status === "OPEN" ? "success" : "neutral"}>{f.status}</StatusPill></td>
                <td className="px-4 py-3 text-on-surface-variant">{formatMinor(f.chargesMinor)}</td>
                <td className="px-4 py-3 text-on-surface-variant">{formatMinor(f.paymentsMinor)}</td>
                <td className="px-4 py-3 font-semibold text-on-surface">{formatMinor(f.balanceMinor)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href="/billing" className="text-sm font-medium text-primary hover:underline">Open in billing</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataState>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-on-surface-variant">{label}</dt>
      <dd className="text-right font-medium text-on-surface">{value || "—"}</dd>
    </div>
  );
}
