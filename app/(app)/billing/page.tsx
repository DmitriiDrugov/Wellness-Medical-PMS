"use client";

import { useEffect, useState } from "react";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import { useEventStream } from "@/web/use-event-stream";
import type { Reservation, Folio, FolioSummary } from "@/web/types";
import { PageHeader, Card, StatusPill, Icon, DataState } from "@/web/components/ui";
import { fullName, formatDate, formatMinor } from "@/web/format";
import { FolioActions } from "./FolioActions";

export default function BillingPage() {
  const { data: reservations, loading } = useApi<Reservation[]>(
    () => api.get<Reservation[]>("/api/reservations", { pageSize: 100 }),
    [],
  );
  const [reservationId, setReservationId] = useState<string>("");

  const billable = (reservations ?? []).filter((r) => ["CHECKED_IN", "CHECKED_OUT"].includes(r.status));

  useEffect(() => {
    if (!reservationId && billable.length > 0) setReservationId(billable[0]!.id);
  }, [billable, reservationId]);

  return (
    <div>
      <PageHeader title="Folio & Billing" subtitle="Guest ledgers, charges and payments." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-0 lg:col-span-1">
          <h2 className="border-b border-outline-variant/50 px-4 py-3 text-sm font-semibold text-on-surface">
            Stays
          </h2>
          <DataState loading={loading} empty={billable.length === 0} emptyLabel="No checked-in or departed stays.">
            <ul className="max-h-[70vh] overflow-y-auto">
              {billable.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setReservationId(r.id)}
                    className={`flex w-full items-center justify-between border-b border-outline-variant/30 px-4 py-3 text-left transition hover:bg-[#f4f8f7] ${
                      reservationId === r.id ? "bg-[#f4f8f7]" : ""
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-on-surface">
                        {fullName(r.guest?.firstName, r.guest?.lastName)}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {r.room ? `Room ${r.room.number}` : r.roomType?.name} · {formatDate(r.checkInDate)}
                      </p>
                    </div>
                    <StatusPill tone={r.status === "CHECKED_IN" ? "success" : "neutral"}>
                      {r.status === "CHECKED_IN" ? "In-House" : "Departed"}
                    </StatusPill>
                  </button>
                </li>
              ))}
            </ul>
          </DataState>
        </Card>

        <div className="lg:col-span-2">
          {reservationId ? <FolioPanel reservationId={reservationId} /> : <Card>Select a stay to view its folio.</Card>}
        </div>
      </div>
    </div>
  );
}

function FolioPanel({ reservationId }: { reservationId: string }) {
  const summaries = useApi<FolioSummary[]>(
    () => api.get<FolioSummary[]>("/api/folios", { reservationId }),
    [reservationId],
  );
  const folioId = summaries.data?.[0]?.id ?? null;

  const folio = useApi<Folio | null>(
    () => (folioId ? api.get<Folio>(`/api/folios/${folioId}`) : Promise.resolve({ data: null })),
    [folioId],
  );
  const reloadFolio = folio.reload;

  // Live: refetch the folio whenever a folio/booking change lands (e.g. a treatment
  // completed elsewhere posts a charge, or check-out adds room + tax).
  useEventStream((ev) => {
    if (ev.entity === "folio" || ev.entity === "booking") {
      summaries.reload();
      reloadFolio();
    }
  });

  if (summaries.loading) return <Card>Loading folio…</Card>;
  if (!folioId) {
    return (
      <Card className="text-on-surface-variant">
        No folio yet for this reservation. A folio is opened automatically at check-out (room charges) or when a
        treatment is completed.
      </Card>
    );
  }
  const f = folio.data;

  return (
    <Card className="p-0">
      <div className="flex items-center justify-between border-b border-outline-variant/50 px-5 py-4">
        <h2 className="text-base font-semibold text-on-surface">Folio</h2>
        {f && (
          <StatusPill tone={f.status === "OPEN" ? "info" : "neutral"}>{f.status}</StatusPill>
        )}
      </div>

      <DataState loading={folio.loading} error={folio.error}>
        {f && (
          <>
            <div className="border-b border-outline-variant/50 px-5 py-3">
              <FolioActions folio={f} onChanged={reloadFolio} />
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-outline-variant/50 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {f.lineItems.map((li) => (
                  <tr key={li.id} className="border-b border-outline-variant/30">
                    <td className="px-5 py-3 text-on-surface-variant">{formatDate(li.createdAt)}</td>
                    <td className="px-5 py-3">
                      <span className="font-medium text-on-surface">{li.description}</span>
                      <span className="ml-2 rounded bg-surface-container-high px-1.5 py-0.5 text-[10px] font-semibold uppercase text-on-surface-variant">
                        {li.type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-on-surface">{formatMinor(li.amountMinor)}</td>
                  </tr>
                ))}
                {f.payments.map((p) => (
                  <tr key={p.id} className="border-b border-outline-variant/30">
                    <td className="px-5 py-3 text-on-surface-variant">{formatDate(p.paidAt)}</td>
                    <td className="px-5 py-3 text-success">Payment — {p.method}{p.reference ? ` (${p.reference})` : ""}</td>
                    <td className="px-5 py-3 text-right text-success">−{formatMinor(p.amountMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="space-y-1 border-t border-outline-variant/50 px-5 py-4 text-sm">
              <Row label="Total Charges" value={formatMinor(f.chargesMinor)} />
              <Row label="Total Payments" value={`−${formatMinor(f.paymentsMinor)}`} />
              <div className="mt-2 flex items-center justify-between border-t border-outline-variant/50 pt-2 text-base font-semibold">
                <span>Balance Due</span>
                <span className={f.balanceMinor === 0 ? "text-success" : "text-on-surface"}>
                  {formatMinor(f.balanceMinor)}
                </span>
              </div>
            </div>
          </>
        )}
      </DataState>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-on-surface-variant">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
