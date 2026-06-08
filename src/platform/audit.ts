import type { Prisma, PrismaClient, AuditAction } from "@prisma/client";
import { prisma as defaultPrisma } from "@/platform/db";

/**
 * APPEND-ONLY audit writer. This is the ONLY way audit rows are created; no update
 * or delete is ever exposed (see ADR 0002). Pass a transaction client to record the
 * audit row in the same transaction as the mutation it describes.
 */
export interface AuditInput {
  actorStaffId?: string | null;
  propertyId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

type Client = PrismaClient | Prisma.TransactionClient;

export async function recordAudit(input: AuditInput, client: Client = defaultPrisma): Promise<void> {
  await client.auditLog.create({
    data: {
      actorStaffId: input.actorStaffId ?? null,
      propertyId: input.propertyId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: (input.before ?? undefined) as Prisma.InputJsonValue | undefined,
      after: (input.after ?? undefined) as Prisma.InputJsonValue | undefined,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
