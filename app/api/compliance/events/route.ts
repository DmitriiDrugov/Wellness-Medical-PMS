import { handle, ok } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { complianceService } from "@/modules/compliance/compliance.service";

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  return ok(await complianceService.listEvents(ctx));
});
