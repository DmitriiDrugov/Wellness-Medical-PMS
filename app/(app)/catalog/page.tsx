"use client";

import { useState } from "react";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import type { Treatment, ServicePackage, Resource } from "@/web/types";
import { PageHeader, Card, StatusPill, Icon, DataState } from "@/web/components/ui";
import { formatMinor } from "@/web/format";
import { TreatmentFormModal } from "./TreatmentFormModal";
import { PackageFormModal } from "./PackageFormModal";
import { ResourceFormModal } from "./ResourceFormModal";

export default function CatalogPage() {
  const treatments = useApi<Treatment[]>(() => api.get<Treatment[]>("/api/treatments", { pageSize: 100 }), []);
  const packages = useApi<ServicePackage[]>(() => api.get<ServicePackage[]>("/api/packages", { pageSize: 100 }), []);
  const resources = useApi<Resource[]>(() => api.get<Resource[]>("/api/resources"), []);

  const [treatmentOpen, setTreatmentOpen] = useState(false);
  const [packageOpen, setPackageOpen] = useState(false);
  const [resourceOpen, setResourceOpen] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);

  return (
    <div>
      <PageHeader
        title="Service Catalog"
        subtitle="Manage wellness packages and à-la-carte treatments."
        actions={
          <>
            <button className="btn-secondary" onClick={() => { setEditingResource(null); setResourceOpen(true); }}>
              <Icon name="add" className="text-[20px]" /> New Therapy Room
            </button>
            <button className="btn-secondary" onClick={() => setPackageOpen(true)}>
              <Icon name="library_add" className="text-[20px]" /> New Package
            </button>
            <button className="btn-primary" onClick={() => { setEditingTreatment(null); setTreatmentOpen(true); }}>
              <Icon name="add" className="text-[20px]" /> New Treatment
            </button>
          </>
        }
      />

      <section className="mb-8">
        <h2 className="mb-3 text-base font-semibold text-on-surface">Wellness Packages</h2>
        <DataState
          loading={packages.loading}
          error={packages.error}
          empty={(packages.data ?? []).length === 0}
          emptyLabel="No packages defined yet."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(packages.data ?? []).map((p) => (
              <Card key={p.id}>
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-semibold text-on-surface">{p.name}</h3>
                  <StatusPill tone={p.active ? "success" : "neutral"}>{p.active ? "Active" : "Inactive"}</StatusPill>
                </div>
                <p className="mt-1 text-2xl font-semibold text-primary">{formatMinor(p.priceMinor)}</p>
                {p.items && p.items.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm text-on-surface-variant">
                    {p.items.map((it, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Icon name="check" className="text-[16px] text-primary" />
                        {it.quantity}× {it.treatment?.name ?? "Treatment"}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ))}
          </div>
        </DataState>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-on-surface">Treatments</h2>
        <Card className="p-0">
          <DataState
            loading={treatments.loading}
            error={treatments.error}
            empty={(treatments.data ?? []).length === 0}
            emptyLabel="No treatments defined yet."
          >
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-outline-variant/50 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  <th className="px-4 py-3">Treatment</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Resource</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {(treatments.data ?? []).map((t) => (
                  <tr key={t.id} className="border-b border-outline-variant/30 hover:bg-[#f4f8f7]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-on-surface">{t.name}</p>
                      {t.description && <p className="text-xs text-on-surface-variant">{t.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{t.durationMinutes} min</td>
                    <td className="px-4 py-3 text-on-surface-variant">{t.requiredResourceType ?? "—"}</td>
                    <td className="px-4 py-3 font-medium text-on-surface">{formatMinor(t.priceMinor)}</td>
                    <td className="px-4 py-3">
                      <StatusPill tone={t.active ? "success" : "neutral"}>{t.active ? "Active" : "Inactive"}</StatusPill>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="btn-ghost px-2"
                        aria-label="Edit treatment"
                        onClick={() => { setEditingTreatment(t); setTreatmentOpen(true); }}
                      >
                        <Icon name="edit" className="text-[18px]" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataState>
        </Card>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-on-surface">Therapy Rooms & Resources</h2>
        <Card className="p-0">
          <DataState
            loading={resources.loading}
            error={resources.error}
            empty={(resources.data ?? []).length === 0}
            emptyLabel="No therapy rooms or resources defined yet."
          >
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-outline-variant/50 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Capacity</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {(resources.data ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-outline-variant/30 hover:bg-[#f4f8f7]">
                    <td className="px-4 py-3 font-medium text-on-surface">{r.name}</td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {r.type === "TREATMENT_ROOM" ? "Treatment room" : "Equipment"}
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">{r.capacity}</td>
                    <td className="px-4 py-3">
                      <StatusPill tone={r.active ? "success" : "neutral"}>{r.active ? "Active" : "Inactive"}</StatusPill>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="btn-ghost px-2"
                        aria-label="Edit resource"
                        onClick={() => { setEditingResource(r); setResourceOpen(true); }}
                      >
                        <Icon name="edit" className="text-[18px]" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataState>
        </Card>
      </section>

      {resourceOpen && (
        <ResourceFormModal
          open={resourceOpen}
          resource={editingResource}
          onClose={() => setResourceOpen(false)}
          onSaved={() => { setResourceOpen(false); resources.reload(); }}
        />
      )}
      {treatmentOpen && (
        <TreatmentFormModal
          open={treatmentOpen}
          treatment={editingTreatment}
          onClose={() => setTreatmentOpen(false)}
          onSaved={() => { setTreatmentOpen(false); treatments.reload(); }}
        />
      )}
      {packageOpen && (
        <PackageFormModal
          open={packageOpen}
          onClose={() => setPackageOpen(false)}
          onSaved={() => { setPackageOpen(false); packages.reload(); }}
        />
      )}
    </div>
  );
}
