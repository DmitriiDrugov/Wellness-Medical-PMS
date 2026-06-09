import type { Prisma, AuditAction } from "@prisma/client";
import { prisma } from "@/platform/db";

/**
 * Audit module read-repository. Deliberately exposes NO create/update/delete —
 * audit rows are written only through `src/platform/audit.ts` (append-only).
 */
export const auditRepository = {
  async list(params: {
    propertyId: string;
    skip: number;
    take: number;
    actorStaffId?: string;
    action?: AuditAction;
    entityType?: string;
    from?: Date;
    to?: Date;
  }) {
    const createdAt =
      params.from || params.to
        ? { ...(params.from ? { gte: params.from } : {}), ...(params.to ? { lt: params.to } : {}) }
        : undefined;
    const where: Prisma.AuditLogWhereInput = {
      propertyId: params.propertyId,
      ...(params.actorStaffId ? { actorStaffId: params.actorStaffId } : {}),
      ...(params.action ? { action: params.action } : {}),
      ...(params.entityType ? { entityType: params.entityType } : {}),
      ...(createdAt ? { createdAt } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { id: true, firstName: true, lastName: true, role: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);
    return { items, total };
  },
};
