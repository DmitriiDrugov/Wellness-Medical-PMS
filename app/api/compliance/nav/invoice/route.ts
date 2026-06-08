import { handle, created, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { navInvoiceSchema } from "@/modules/compliance/compliance.schema";
import { complianceService } from "@/modules/compliance/compliance.service";

export const POST = handle(async (req) => {
  const ctx = requireAuth(req);
  const input = navInvoiceSchema.parse(await parseJson(req));
  return created(await complianceService.generateNavInvoice(ctx, input));
});
