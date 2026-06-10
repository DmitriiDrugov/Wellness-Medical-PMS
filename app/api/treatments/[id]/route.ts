import { handle, ok, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { updateTreatmentSchema } from "@/modules/treatments/treatments.schema";
import { treatmentsService } from "@/modules/treatments/treatments.service";

type Params = { params: Promise<{ id: string }> };

export const GET = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  return ok(await treatmentsService.get(ctx, (await params).id));
});

export const PATCH = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  const input = updateTreatmentSchema.parse(await parseJson(req));
  return ok(await treatmentsService.update(ctx, (await params).id, input));
});
