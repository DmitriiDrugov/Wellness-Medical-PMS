import { handle, ok, created, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { createTreatmentSchema } from "@/modules/treatments/treatments.schema";
import { treatmentsService } from "@/modules/treatments/treatments.service";

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  return ok(await treatmentsService.list(ctx));
});

export const POST = handle(async (req) => {
  const ctx = requireAuth(req);
  const input = createTreatmentSchema.parse(await parseJson(req));
  return created(await treatmentsService.create(ctx, input));
});
