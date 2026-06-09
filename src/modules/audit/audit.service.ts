import type { AuthContext } from "@/platform/auth/context";
import { requireCapability } from "@/platform/rbac";
import { auditRepository } from "@/modules/audit/audit.repository";
import type { ListAuditLogsQuery } from "@/modules/audit/audit.schema";

/**
 * Read-only access to the append-only audit trail. Restricted to `audit:read`
 * (MANAGER, ADMIN). Reads here are not themselves audited — viewing the trail is
 * a meta-operation and self-logging would only add noise.
 */
export const auditService = {
  async list(ctx: AuthContext, query: ListAuditLogsQuery) {
    requireCapability(ctx.role, "audit:read");
    const { items, total } = await auditRepository.list({
      propertyId: ctx.propertyId,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      actorStaffId: query.actorStaffId,
      action: query.action,
      entityType: query.entityType,
      from: query.from,
      to: query.to,
    });
    return { items, total, page: query.page, pageSize: query.pageSize };
  },
};
