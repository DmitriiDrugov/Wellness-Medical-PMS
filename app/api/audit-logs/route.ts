import { handle, ok } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { listAuditLogsQuerySchema } from "@/modules/audit/audit.schema";
import { auditService } from "@/modules/audit/audit.service";

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  const query = listAuditLogsQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const result = await auditService.list(ctx, query);
  return ok(result.items, { page: result.page, pageSize: result.pageSize, total: result.total });
});
