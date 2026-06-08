import { handle, created, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { ntakDailyReportSchema } from "@/modules/compliance/compliance.schema";
import { complianceService } from "@/modules/compliance/compliance.service";

export const POST = handle(async (req) => {
  const ctx = requireAuth(req);
  const input = ntakDailyReportSchema.parse(await parseJson(req));
  return created(await complianceService.generateNtakDailyReport(ctx, input));
});
