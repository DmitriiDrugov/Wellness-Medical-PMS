import { handle, ok } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { dateRangeQuerySchema } from "@/modules/reporting/reporting.schema";
import { reportingService } from "@/modules/reporting/reporting.service";

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  const query = dateRangeQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await reportingService.revenue(ctx, query));
});
