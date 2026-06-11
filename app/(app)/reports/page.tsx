"use client";

import { useState } from "react";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import { PageHeader, Card, StatCard, DataState } from "@/web/components/ui";
import { formatMinor, formatDate } from "@/web/format";

interface Occupancy {
  totalRooms: number;
  capacityRoomNights: number;
  bookedRoomNights: number;
  occupancyRate: number;
}
interface Revenue {
  chargesByTypeMinor: Record<string, number>;
  totalChargesMinor: number;
  totalPaymentsMinor: number;
}
interface Utilization {
  treatments: { treatmentId: string; name: string; appointments: number; totalMinutes: number; revenueMinor: number }[];
}
interface TouristTax {
  currency: string;
  taxableStays: number;
  taxablePersonNights: number;
  totalTaxMinor: number;
  rows: { id: string; guestName: string; personNights: number; taxMinor: number; postedAt: string }[];
}

type Tab = "overview" | "tax";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * The API treats `to` as an exclusive midnight bound, so "to = today" would drop
 * everything posted today. Add a day to make the picker's end date inclusive.
 */
function inclusiveTo(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(y!, m! - 1, d! + 1); // local; the day rolls over correctly
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(daysAgo(0));

  return (
    <div>
      <PageHeader
        title="Manager Reports"
        subtitle="Occupancy, revenue, treatment utilization, and the tourist-tax return."
        actions={
          <div className="flex items-center gap-2 text-sm">
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-on-surface-variant">to</span>
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        }
      />

      {/* Tabs */}
      <div className="mb-5 flex gap-1 border-b border-outline-variant/50">
        {([
          ["overview", "Overview"],
          ["tax", "Tax Report"],
        ] as [Tab, string][]).map(([key, label]) => (
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

      {tab === "overview" ? (
        <OverviewTab from={from} apiTo={inclusiveTo(to)} />
      ) : (
        <TaxTab from={from} to={to} apiTo={inclusiveTo(to)} />
      )}
    </div>
  );
}

function OverviewTab({ from, apiTo }: { from: string; apiTo: string }) {
  const occ = useApi<Occupancy>(() => api.get<Occupancy>("/api/reports/occupancy", { from, to: apiTo }), [from, apiTo]);
  const rev = useApi<Revenue>(() => api.get<Revenue>("/api/reports/revenue", { from, to: apiTo }), [from, apiTo]);
  const util = useApi<Utilization>(
    () => api.get<Utilization>("/api/reports/treatment-utilization", { from, to: apiTo }),
    [from, apiTo],
  );

  const roomRevenue = rev.data?.chargesByTypeMinor?.ROOM ?? 0;
  const revpar = occ.data?.capacityRoomNights ? roomRevenue / occ.data.capacityRoomNights : 0;
  const loading = occ.loading || rev.loading || util.loading;
  const error = occ.error || rev.error || util.error;

  return (
    <DataState loading={loading} error={error}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Revenue" value={formatMinor(rev.data?.totalChargesMinor)} icon="payments" />
        <StatCard
          label="Occupancy"
          value={`${Math.round((occ.data?.occupancyRate ?? 0) * 100)}%`}
          icon="hotel"
          trend={`${occ.data?.bookedRoomNights ?? 0}/${occ.data?.capacityRoomNights ?? 0} room-nights`}
        />
        <StatCard label="RevPAR" value={formatMinor(revpar)} icon="trending_up" trend="Room rev ÷ available nights" />
        <StatCard label="Payments Collected" value={formatMinor(rev.data?.totalPaymentsMinor)} icon="account_balance_wallet" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-base font-semibold text-on-surface">Revenue Breakdown</h2>
          <div className="space-y-3">
            {Object.entries(rev.data?.chargesByTypeMinor ?? {}).length === 0 && (
              <p className="text-sm text-on-surface-variant">No charges in this range.</p>
            )}
            {Object.entries(rev.data?.chargesByTypeMinor ?? {}).map(([type, minor]) => {
              const pct = rev.data?.totalChargesMinor ? (minor / rev.data.totalChargesMinor) * 100 : 0;
              return (
                <div key={type}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium capitalize text-on-surface">{type.toLowerCase().replace("_", " ")}</span>
                    <span className="text-on-surface-variant">{formatMinor(minor)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-0">
          <h2 className="border-b border-outline-variant/50 px-5 py-4 text-base font-semibold text-on-surface">
            Treatment Utilization
          </h2>
          {(util.data?.treatments ?? []).length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-on-surface-variant">No treatments performed in this range.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-outline-variant/50 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  <th className="px-5 py-3">Treatment</th>
                  <th className="px-5 py-3">Sessions</th>
                  <th className="px-5 py-3">Minutes</th>
                  <th className="px-5 py-3">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {(util.data?.treatments ?? []).map((t) => (
                  <tr key={t.treatmentId} className="border-b border-outline-variant/30">
                    <td className="px-5 py-3 font-medium text-on-surface">{t.name}</td>
                    <td className="px-5 py-3 text-on-surface-variant">{t.appointments}</td>
                    <td className="px-5 py-3 text-on-surface-variant">{t.totalMinutes}</td>
                    <td className="px-5 py-3 font-medium text-on-surface">{formatMinor(t.revenueMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </DataState>
  );
}

function TaxTab({ from, to, apiTo }: { from: string; to: string; apiTo: string }) {
  const tax = useApi<TouristTax>(() => api.get<TouristTax>("/api/reports/tourist-tax", { from, to: apiTo }), [from, apiTo]);

  return (
    <DataState loading={tax.loading} error={tax.error}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Tourist Tax Collected" value={formatMinor(tax.data?.totalTaxMinor)} icon="payments" />
        <StatCard label="Taxable Person-Nights" value={String(tax.data?.taxablePersonNights ?? 0)} icon="calendar_month" />
        <StatCard label="Taxable Stays" value={String(tax.data?.taxableStays ?? 0)} icon="hotel" />
      </div>

      <Card className="mt-6 p-0">
        <div className="flex items-center justify-between border-b border-outline-variant/50 px-5 py-4">
          <h2 className="text-base font-semibold text-on-surface">Tourist-Tax Return (IFA)</h2>
          <span className="text-xs text-on-surface-variant">Posted between {formatDate(from)} and {formatDate(to)}</span>
        </div>
        {(tax.data?.rows ?? []).length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-on-surface-variant">
            No tourist tax was posted in this range. Tax accrues to the folio at check-out.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant/50 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                <th className="px-5 py-3">Guest</th>
                <th className="px-5 py-3">Person-nights</th>
                <th className="px-5 py-3">Tax</th>
                <th className="px-5 py-3">Posted</th>
              </tr>
            </thead>
            <tbody>
              {(tax.data?.rows ?? []).map((r) => (
                <tr key={r.id} className="border-b border-outline-variant/30">
                  <td className="px-5 py-3 font-medium text-on-surface">{r.guestName}</td>
                  <td className="px-5 py-3 text-on-surface-variant">{r.personNights}</td>
                  <td className="px-5 py-3 font-medium text-on-surface">{formatMinor(r.taxMinor)}</td>
                  <td className="px-5 py-3 text-on-surface-variant">{formatDate(r.postedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <p className="mt-4 text-xs text-on-surface-variant">
        The Hungarian tourist tax (IFA) is levied per taxable person per night; under-18 guests are exempt unless the
        property opts them in. Configure the nightly rate on the property record.
      </p>
    </DataState>
  );
}
