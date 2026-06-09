"use client";

import { useState } from "react";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import { PageHeader, Card, StatCard, Icon, DataState } from "@/web/components/ui";
import { formatMinor } from "@/web/format";

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

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(daysAgo(0));

  const occ = useApi<Occupancy>(() => api.get<Occupancy>("/api/reports/occupancy", { from, to }), [from, to]);
  const rev = useApi<Revenue>(() => api.get<Revenue>("/api/reports/revenue", { from, to }), [from, to]);
  const util = useApi<Utilization>(
    () => api.get<Utilization>("/api/reports/treatment-utilization", { from, to }),
    [from, to],
  );

  const roomRevenue = rev.data?.chargesByTypeMinor?.ROOM ?? 0;
  const revpar = occ.data?.capacityRoomNights ? roomRevenue / occ.data.capacityRoomNights : 0;
  const loading = occ.loading || rev.loading || util.loading;
  const error = occ.error || rev.error || util.error;

  return (
    <div>
      <PageHeader
        title="Manager Reports"
        subtitle="Occupancy, revenue, and treatment utilization."
        actions={
          <div className="flex items-center gap-2 text-sm">
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-on-surface-variant">to</span>
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        }
      />

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
                      <span className="font-medium capitalize text-on-surface">{type.toLowerCase()}</span>
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

        <p className="mt-4 text-xs text-on-surface-variant">
          Note: the mockup’s “F&amp;B / Retail” split and per-therapist star ratings are not backed by the current
          API — Revenue Breakdown shows the real charge types (Room / Treatment / Package / Adjustment).
        </p>
      </DataState>
    </div>
  );
}
