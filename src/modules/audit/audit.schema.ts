import { z } from "zod";

/**
 * Query for the read-only audit-log viewer. The AuditLog table itself is
 * append-only (ADR 0002); this module only ever READS it.
 */
export const listAuditLogsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    actorStaffId: z.string().min(1).optional(),
    action: z.enum(["CREATE", "UPDATE", "DELETE", "STATE_CHANGE", "LOGIN", "LOGOUT", "READ"]).optional(),
    entityType: z.string().min(1).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((v) => !(v.from && v.to) || v.to > v.from, {
    message: "to must be after from",
    path: ["to"],
  });

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
