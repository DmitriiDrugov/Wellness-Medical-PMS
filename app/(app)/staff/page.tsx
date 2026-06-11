"use client";

import { useMemo, useState } from "react";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import { useMutation } from "@/web/use-mutation";
import { useAuth } from "@/web/auth-context";
import { useEventStream } from "@/web/use-event-stream";
import type { Appointment, HousekeepingTask, StaffMember } from "@/web/types";
import { PageHeader, Card, StatusPill, Icon, DataState } from "@/web/components/ui";
import { ConfirmDialog } from "@/web/components/ConfirmDialog";
import { fullName, initials, formatDate, formatTime } from "@/web/format";
import { StaffFormModal, ROLE_OPTIONS } from "./StaffFormModal";

const ROLE_LABEL: Record<StaffMember["role"], string> = {
  RECEPTION: "Reception",
  RESERVATION_ADMIN: "Reservation Admin",
  THERAPIST: "Therapist",
  HOUSEKEEPING: "Housekeeping",
  MANAGER: "Manager",
  ADMIN: "Administrator",
  AI_AGENT: "AI Agent",
};

const ROLE_TONE: Record<StaffMember["role"], "primary" | "info" | "success" | "warning" | "neutral"> = {
  ADMIN: "primary",
  MANAGER: "primary",
  THERAPIST: "success",
  RECEPTION: "info",
  RESERVATION_ADMIN: "info",
  HOUSEKEEPING: "warning",
  AI_AGENT: "neutral",
};

export default function StaffPage() {
  const { user } = useAuth();
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, loading, error, reload } = useApi<StaffMember[]>(() => api.get<StaffMember[]>("/api/staff/directory"));
  useEventStream((ev) => {
    if (ev.entity === "staff") reload();
  });

  const members = useMemo(
    () => (data ?? []).filter((m) => roleFilter === "all" || m.role === roleFilter),
    [data, roleFilter],
  );
  const selected = (data ?? []).find((m) => m.id === selectedId) ?? null;

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [deactivating, setDeactivating] = useState<StaffMember | null>(null);
  const activation = useMutation();

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(m: StaffMember) {
    setEditing(m);
    setFormOpen(true);
  }
  async function setActive(m: StaffMember, isActive: boolean) {
    const ok = await activation.submit(() => api.patch(`/api/staff/${m.id}`, { isActive }));
    if (ok !== undefined) {
      setDeactivating(null);
      reload();
    }
  }

  const activeCount = (data ?? []).filter((m) => m.isActive).length;

  return (
    <div>
      <PageHeader
        title="Staff Management"
        subtitle={data ? `${activeCount} active of ${data.length} accounts` : "Accounts, roles and access"}
        actions={
          <button className="btn-primary" onClick={openCreate}>
            <Icon name="person_add" className="text-[20px]" /> New Staff
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-0">
          <div className="flex items-center gap-2 border-b border-outline-variant/50 p-4">
            <Icon name="filter_list" className="text-[18px] text-on-surface-variant" />
            <select className="input max-w-56 py-1.5 text-sm" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="all">All roles</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
              <option value="AI_AGENT">AI Agent</option>
            </select>
          </div>

          <DataState loading={loading} error={error} empty={members.length === 0} emptyLabel="No staff match this filter.">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-outline-variant/50 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    className={`cursor-pointer border-b border-outline-variant/30 transition hover:bg-[#f4f8f7] ${
                      selectedId === m.id ? "bg-[#f4f8f7]" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`grid h-9 w-9 place-items-center rounded-full text-xs font-semibold ${
                            m.isActive ? "bg-primary/15 text-primary" : "bg-surface-container text-on-surface-variant"
                          }`}
                        >
                          {m.role === "AI_AGENT" ? <Icon name="smart_toy" className="text-[18px]" /> : initials(m.firstName, m.lastName)}
                        </span>
                        <div>
                          <p className={`font-medium ${m.isActive ? "text-on-surface" : "text-on-surface-variant line-through"}`}>
                            {fullName(m.firstName, m.lastName)}
                            {m.id === user?.id && <span className="ml-1.5 text-xs font-normal text-on-surface-variant">(you)</span>}
                          </p>
                          <p className="text-xs text-on-surface-variant">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={ROLE_TONE[m.role]}>{ROLE_LABEL[m.role]}</StatusPill>
                    </td>
                    <td className="px-4 py-3">
                      {m.isActive ? <StatusPill tone="success">Active</StatusPill> : <StatusPill tone="neutral">Deactivated</StatusPill>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataState>
        </Card>

        <StaffDetail
          member={selected}
          selfId={user?.id ?? ""}
          onEdit={openEdit}
          onDeactivate={setDeactivating}
          onReactivate={(m) => setActive(m, true)}
          reactivating={activation.submitting}
        />
      </div>

      <StaffFormModal
        open={formOpen}
        member={editing}
        selfId={user?.id ?? ""}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          reload();
        }}
      />
      <ConfirmDialog
        open={deactivating !== null}
        title="Deactivate account"
        message={`Deactivate ${fullName(deactivating?.firstName, deactivating?.lastName)}? They are signed out everywhere immediately and can no longer log in. Their history is kept.`}
        confirmLabel="Deactivate"
        danger
        busy={activation.submitting}
        error={activation.error}
        onConfirm={() => deactivating && setActive(deactivating, false)}
        onClose={() => setDeactivating(null)}
      />
    </div>
  );
}

// ---- Detail panel: profile, access, current assignments ----

function StaffDetail({
  member,
  selfId,
  onEdit,
  onDeactivate,
  onReactivate,
  reactivating,
}: {
  member: StaffMember | null;
  selfId: string;
  onEdit: (m: StaffMember) => void;
  onDeactivate: (m: StaffMember) => void;
  onReactivate: (m: StaffMember) => void;
  reactivating: boolean;
}) {
  const { data: matrix } = useApi<Record<string, string[]>>(() => api.get("/api/staff/capabilities"));

  // Live workload: a therapist's upcoming week, anyone's open housekeeping tasks.
  const weekAhead = useMemo(() => {
    const from = new Date();
    const to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);
  const { data: appts } = useApi<{ items: Appointment[] }>(
    () =>
      member?.role === "THERAPIST"
        ? api.get("/api/appointments", { therapistId: member.id, status: "SCHEDULED", from: weekAhead.from, to: weekAhead.to, pageSize: 5 })
        : Promise.resolve({ data: { items: [] } }),
    [member?.id],
  );
  const { data: tasks } = useApi<HousekeepingTask[]>(
    () =>
      member && member.role !== "AI_AGENT"
        ? api.get("/api/housekeeping/tasks", { assignedToStaffId: member.id })
        : Promise.resolve({ data: [] }),
    [member?.id],
  );

  if (!member) {
    return (
      <Card className="grid place-items-center text-center text-on-surface-variant">
        <div>
          <Icon name="group" className="text-[40px] text-outline-variant" />
          <p className="mt-2 text-sm">Select a staff member to view access and assignments.</p>
        </div>
      </Card>
    );
  }

  const capabilities = matrix?.[member.role] ?? [];
  const isSystem = member.role === "AI_AGENT";
  const openTasks = (tasks ?? []).filter((t) => t.status !== "DONE");
  const upcoming = appts?.items ?? [];

  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-base font-semibold text-primary">
          {isSystem ? <Icon name="smart_toy" className="text-[22px]" /> : initials(member.firstName, member.lastName)}
        </span>
        <div>
          <h2 className="text-lg font-semibold text-on-surface">{fullName(member.firstName, member.lastName)}</h2>
          <p className="text-xs text-on-surface-variant">{member.email}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <StatusPill tone={ROLE_TONE[member.role]}>{ROLE_LABEL[member.role]}</StatusPill>
        {member.isActive ? <StatusPill tone="success">Active</StatusPill> : <StatusPill tone="neutral">Deactivated</StatusPill>}
        {isSystem && <StatusPill tone="neutral">System principal</StatusPill>}
      </div>

      {!isSystem && (
        <div className="mt-3 flex gap-2">
          <button className="btn-secondary flex-1" onClick={() => onEdit(member)}>
            <Icon name="edit" className="text-[18px]" /> Edit
          </button>
          {member.isActive ? (
            member.id !== selfId && (
              <button className="btn-ghost text-error" onClick={() => onDeactivate(member)}>
                <Icon name="person_off" className="text-[18px]" /> Deactivate
              </button>
            )
          ) : (
            <button className="btn-secondary" disabled={reactivating} onClick={() => onReactivate(member)}>
              <Icon name="check_circle" className="text-[18px]" /> Reactivate
            </button>
          )}
        </div>
      )}

      {member.role === "THERAPIST" && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Next 7 days</p>
          {upcoming.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No upcoming appointments.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {upcoming.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-lg bg-surface-container-low px-3 py-2">
                  <span className="truncate text-on-surface">{a.treatment?.name ?? "Treatment"}</span>
                  <span className="ml-2 flex-shrink-0 text-xs text-on-surface-variant">
                    {formatDate(a.startTime)} {formatTime(a.startTime)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!isSystem && openTasks.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Open housekeeping tasks</p>
          <ul className="space-y-2 text-sm">
            {openTasks.slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-center justify-between rounded-lg bg-surface-container-low px-3 py-2">
                <span className="truncate text-on-surface">{t.title}</span>
                <span className="ml-2 flex-shrink-0 text-xs text-on-surface-variant">
                  {t.room ? `Room ${t.room.number}` : t.area?.name ?? "Property"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          Access — {capabilities.length} capabilities
        </p>
        <div className="flex flex-wrap gap-1.5">
          {capabilities.map((c) => (
            <span key={c} className="rounded-full bg-surface-container px-2 py-0.5 text-xs text-on-surface-variant">
              {c}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
