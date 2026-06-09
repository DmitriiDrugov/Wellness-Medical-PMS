"use client";

import { useState } from "react";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import { useMutation } from "@/web/use-mutation";
import type { Guest, FolioSummary } from "@/web/types";
import { PageHeader, Card, StatusPill, Icon, DataState } from "@/web/components/ui";
import { fullName, initials, formatDate, formatMinor } from "@/web/format";
import { GuestFormModal } from "./GuestFormModal";
import { ConfirmDialog } from "@/web/components/ConfirmDialog";

export default function GuestsPage() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, meta, loading, error, reload } = useApi<Guest[]>(
    () => api.get<Guest[]>("/api/guests", { pageSize: 50, search: search || undefined }),
    [search],
  );
  const guests = data ?? [];
  const selected = guests.find((g) => g.id === selectedId) ?? null;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Guest | null>(null);
  const [deleting, setDeleting] = useState<Guest | null>(null);
  const del = useMutation();

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(g: Guest) {
    setEditing(g);
    setFormOpen(true);
  }
  async function confirmDelete() {
    if (!deleting) return;
    const ok = await del.submit(() => api.del(`/api/guests/${deleting.id}`));
    if (ok !== undefined) {
      setDeleting(null);
      reload();
    }
  }

  return (
    <div>
      <PageHeader
        title="Guest Profiles"
        subtitle={meta ? `${meta.total} total guests` : "Guest directory"}
        actions={
          <button className="btn-primary" onClick={openCreate}>
            <Icon name="person_add" className="text-[20px]" /> New Guest
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-0">
          <div className="border-b border-outline-variant/50 p-4">
            <div className="relative max-w-sm">
              <Icon
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-outline"
              />
              <input
                className="input pl-10"
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <DataState loading={loading} error={error} empty={guests.length === 0} emptyLabel="No guests match your search.">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-outline-variant/50 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  <th className="px-4 py-3">Guest</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Consent</th>
                  <th className="px-4 py-3">Added</th>
                </tr>
              </thead>
              <tbody>
                {guests.map((g) => (
                  <tr
                    key={g.id}
                    onClick={() => setSelectedId(g.id)}
                    className={`cursor-pointer border-b border-outline-variant/30 transition hover:bg-[#f4f8f7] ${
                      selectedId === g.id ? "bg-[#f4f8f7]" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                          {initials(g.firstName, g.lastName)}
                        </span>
                        <div>
                          <p className="font-medium text-on-surface">{fullName(g.firstName, g.lastName)}</p>
                          <p className="text-xs text-on-surface-variant">{g.nationality ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-on-surface">{g.email ?? "—"}</p>
                      <p className="text-xs text-on-surface-variant">{g.phone ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      {g.gdprConsentDataProcessing ? (
                        <StatusPill tone="success">GDPR ✓</StatusPill>
                      ) : (
                        <StatusPill tone="warning">No consent</StatusPill>
                      )}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{formatDate(g.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataState>
        </Card>

        <GuestDetail guest={selected} onEdit={openEdit} onDelete={setDeleting} onReload={reload} />
      </div>

      <GuestFormModal
        open={formOpen}
        guest={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          reload();
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Delete guest"
        message={`Soft-delete ${deleting?.firstName ?? ""} ${deleting?.lastName ?? ""}? They will be hidden from lists (GDPR erasure).`}
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

function GuestDetail({
  guest,
  onEdit,
  onDelete,
  onReload,
}: {
  guest: Guest | null;
  onEdit: (g: Guest) => void;
  onDelete: (g: Guest) => void;
  onReload: () => void;
}) {
  const { data: folios } = useApi<FolioSummary[]>(
    () => (guest ? api.get<FolioSummary[]>("/api/folios", { guestId: guest.id }) : Promise.resolve({ data: [] })),
    [guest?.id],
  );

  const consentMutation = useMutation();

  async function recordGdprConsent() {
    if (!guest) return;
    const result = await consentMutation.submit(() =>
      api.post(`/api/guests/${guest.id}/consents`, {
        type: "GDPR_DATA_PROCESSING",
        version: "1.0",
      }),
    );
    if (result !== undefined) onReload();
  }

  if (!guest) {
    return (
      <Card className="grid place-items-center text-center text-on-surface-variant">
        <div>
          <Icon name="contact_page" className="text-[40px] text-outline-variant" />
          <p className="mt-2 text-sm">Select a guest to view their profile.</p>
        </div>
      </Card>
    );
  }

  const totalCharges = (folios ?? []).reduce((s, f) => s + f.chargesMinor, 0);

  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-base font-semibold text-primary">
          {initials(guest.firstName, guest.lastName)}
        </span>
        <div>
          <h2 className="text-lg font-semibold text-on-surface">{fullName(guest.firstName, guest.lastName)}</h2>
          <p className="text-xs text-on-surface-variant">ID: {guest.id.slice(0, 8)}</p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button className="btn-secondary flex-1" onClick={() => onEdit(guest)}>
          <Icon name="edit" className="text-[18px]" /> Edit
        </button>
        <button className="btn-ghost text-error" onClick={() => onDelete(guest)}>
          <Icon name="delete" className="text-[18px]" /> Delete
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-surface-container-low p-3">
          <p className="text-xs text-on-surface-variant">Total Charges</p>
          <p className="text-lg font-semibold text-on-surface">{formatMinor(totalCharges)}</p>
        </div>
        <div className="rounded-lg bg-surface-container-low p-3">
          <p className="text-xs text-on-surface-variant">Folios</p>
          <p className="text-lg font-semibold text-on-surface">{folios?.length ?? 0}</p>
        </div>
      </div>

      <div className="mt-5 space-y-3 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Contact</p>
        <Detail icon="mail" label="Email" value={guest.email} />
        <Detail icon="call" label="Phone" value={guest.phone} />
        <Detail
          icon="location_on"
          label="Address"
          value={[guest.addressLine, guest.city, guest.postalCode, guest.country].filter(Boolean).join(", ") || null}
        />
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">GDPR Consent</p>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone={guest.gdprConsentDataProcessing ? "success" : "neutral"}>
            Data processing {guest.gdprConsentDataProcessing ? "✓" : "✗"}
          </StatusPill>
          <StatusPill tone={guest.gdprConsentMarketing ? "success" : "neutral"}>
            Marketing {guest.gdprConsentMarketing ? "✓" : "✗"}
          </StatusPill>
        </div>
        {!guest.gdprConsentDataProcessing && (
          <div className="mt-2">
            <button
              className="btn-secondary text-xs"
              onClick={recordGdprConsent}
              disabled={consentMutation.submitting}
            >
              <Icon name="check_circle" className="text-[16px]" />
              {consentMutation.submitting ? "Recording…" : "Record GDPR consent"}
            </button>
            {consentMutation.error && (
              <p className="mt-1 text-xs text-error">{consentMutation.error}</p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function Detail({ icon, label, value }: { icon: string; label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-3">
      <Icon name={icon} className="text-[20px] text-outline" />
      <div>
        <p className="text-on-surface">{value ?? "—"}</p>
        <p className="text-xs text-on-surface-variant">{label}</p>
      </div>
    </div>
  );
}
