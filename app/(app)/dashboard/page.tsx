"use client";

import Link from "next/link";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import { useAuth } from "@/web/auth-context";
import type { Reservation } from "@/web/types";
import { PageHeader, Card, StatCard, StatusPill, Icon, DataState } from "@/web/components/ui";
import { fullName, formatDate } from "@/web/format";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, loading, error } = useApi<Reservation[]>(
    () => api.get<Reservation[]>("/api/reservations", { pageSize: 100 }),
    [],
  );

  const reservations = data ?? [];
  const inHouse = reservations.filter((r) => r.status === "CHECKED_IN");
  const today = new Date().toISOString().slice(0, 10);
  const toCheckOut = inHouse.filter((r) => r.checkOutDate.slice(0, 10) <= today);
  const arriving = reservations.filter(
    (r) => ["PENDING", "CONFIRMED"].includes(r.status) && r.checkInDate.slice(0, 10) === today,
  );

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.firstName ?? ""}`}
        subtitle="Today’s front-desk overview."
      />

      <DataState loading={loading} error={error}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="In-House Guests" value={String(inHouse.length)} icon="bed" trend="Currently checked in" />
          <StatCard label="To Check Out" value={String(toCheckOut.length)} icon="logout" trend="Due today" />
          <StatCard label="Arrivals Today" value={String(arriving.length)} icon="login" trend="Expected check-ins" />
          <StatCard label="Total Reservations" value={String(reservations.length)} icon="calendar_month" />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-on-surface">Arrivals & In-House</h2>
              <Link href="/booking" className="text-sm font-medium text-primary hover:underline">
                Open booking grid
              </Link>
            </div>
            {reservations.length === 0 ? (
              <p className="py-8 text-center text-sm text-on-surface-variant">No reservations yet.</p>
            ) : (
              <div className="divide-y divide-outline-variant/50">
                {reservations.slice(0, 6).map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
                        <Icon name="person" className="text-[18px]" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-on-surface">
                          {fullName(r.guest?.firstName, r.guest?.lastName)}
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          {r.room ? `Room ${r.room.number}` : r.roomType?.name ?? "Unassigned"} ·{" "}
                          {formatDate(r.checkInDate)} → {formatDate(r.checkOutDate)}
                        </p>
                      </div>
                    </div>
                    <ReservationStatusPill status={r.status} />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="space-y-6">
            <Card>
              <h2 className="mb-3 text-base font-semibold text-on-surface">Quick Actions</h2>
              <div className="grid grid-cols-1 gap-2">
                <Link href="/booking" className="btn-secondary justify-start">
                  <Icon name="add_circle" className="text-[20px]" /> New booking
                </Link>
                <Link href="/guests" className="btn-secondary justify-start">
                  <Icon name="person_add" className="text-[20px]" /> Add guest
                </Link>
                <Link href="/schedule" className="btn-secondary justify-start">
                  <Icon name="spa" className="text-[20px]" /> Book treatment
                </Link>
              </div>
            </Card>

            <Card className="border border-warning/30">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-base font-semibold text-on-surface">Online & AI</h2>
                <span className="pill pill-warning">soon</span>
              </div>
              <p className="text-sm text-on-surface-variant">
                Pending online bookings (Phase 7) and WhatsApp conversation handover (Phase 10) appear here
                once those backend phases are built.
              </p>
            </Card>
          </div>
        </div>
      </DataState>
    </div>
  );
}

function ReservationStatusPill({ status }: { status: Reservation["status"] }) {
  const map: Record<Reservation["status"], { tone: "success" | "info" | "warning" | "neutral"; label: string }> = {
    CHECKED_IN: { tone: "success", label: "In-House" },
    CONFIRMED: { tone: "info", label: "Confirmed" },
    PENDING: { tone: "warning", label: "Pending" },
    CHECKED_OUT: { tone: "neutral", label: "Departed" },
    CANCELLED: { tone: "neutral", label: "Cancelled" },
    NO_SHOW: { tone: "neutral", label: "No-show" },
  };
  const { tone, label } = map[status];
  return <StatusPill tone={tone}>{label}</StatusPill>;
}
