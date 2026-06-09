"use client";

import { useState } from "react";
import { api } from "@/web/api-client";
import { useApi } from "@/web/use-api";
import type { AuditLog } from "@/web/types";
import { PageHeader, Card, StatusPill, Icon, DataState } from "@/web/components/ui";
import { fullName, formatDateTime } from "@/web/format";

const ACTIONS = ["", "CREATE", "UPDATE", "STATE_CHANGE", "DELETE", "LOGIN", "LOGOUT", "READ"] as const;

const ACTION_TONE: Record<string, "success" | "info" | "warning" | "neutral" | "primary"> = {
  CREATE: "success",
  UPDATE: "info",
  STATE_CHANGE: "primary",
  DELETE: "warning",
  LOGIN: "neutral",
  LOGOUT: "neutral",
  READ: "neutral",
};

export default function AuditPage() {
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");

  const { data, meta, loading, error } = useApi<AuditLog[]>(
    () =>
      api.get<AuditLog[]>("/api/audit-logs", {
        pageSize: 50,
        action: action || undefined,
        entityType: entityType || undefined,
      }),
    [action, entityType],
  );
  const logs = data ?? [];

  return (
    <div>
      <PageHeader
        title="System Audit Log"
        subtitle="Append-only, chronological record of every state change. Restricted to managers and admins."
        actions={
          <button className="btn-secondary" disabled>
            <Icon name="download" className="text-[20px]" /> Export CSV
          </button>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <label className="flex items-center gap-2 text-sm text-on-surface-variant">
          <Icon name="filter_list" className="text-[20px]" /> Event
          <select className="input w-44" value={action} onChange={(e) => setAction(e.target.value)}>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a || "All events"}
              </option>
            ))}
          </select>
        </label>
        <input
          className="input w-56"
          placeholder="Entity type (e.g. Reservation)"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
        />
        {meta && <span className="ml-auto text-sm text-on-surface-variant">{meta.total} events</span>}
      </Card>

      <Card className="p-0">
        <DataState loading={loading} error={error} empty={logs.length === 0} emptyLabel="No audit events match these filters.">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant/50 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-outline-variant/30">
                  <td className="px-4 py-3 text-on-surface-variant">{formatDateTime(log.createdAt)}</td>
                  <td className="px-4 py-3 text-on-surface">
                    {log.actor ? (
                      <span>
                        {fullName(log.actor.firstName, log.actor.lastName)}{" "}
                        <span className="text-xs text-on-surface-variant">({log.actor.role})</span>
                      </span>
                    ) : (
                      <span className="text-on-surface-variant">System</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={ACTION_TONE[log.action] ?? "neutral"}>{log.action}</StatusPill>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-on-surface">{log.entityType}</span>
                    <span className="ml-1 text-xs text-on-surface-variant">{log.entityId.slice(0, 8)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </Card>
    </div>
  );
}
