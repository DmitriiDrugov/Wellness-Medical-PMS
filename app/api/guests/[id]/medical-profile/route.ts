import { handle, ok, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { upsertMedicalProfileSchema } from "@/modules/guests/guests.schema";
import { guestsService } from "@/modules/guests/guests.service";

type Params = { params: Promise<{ id: string }> };

export const GET = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  return ok(await guestsService.getMedicalProfile(ctx, (await params).id));
});

export const PUT = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  const input = upsertMedicalProfileSchema.parse(await parseJson(req));
  return ok(await guestsService.upsertMedicalProfile(ctx, (await params).id, input));
});
