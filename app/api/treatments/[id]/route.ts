import { handle, ok, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { updateTreatmentSchema } from "@/modules/treatments/treatments.schema";
import { treatmentsService } from "@/modules/treatments/treatments.service";

type Params = { params: { id: string } };

export const GET = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  return ok(await treatmentsService.get(ctx, params.id));
});

export const PATCH = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  const input = updateTreatmentSchema.parse(await parseJson(req));
  return ok(await treatmentsService.update(ctx, params.id, input));
});
