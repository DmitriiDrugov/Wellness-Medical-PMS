import { handle, ok, noContent, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { updateGuestSchema } from "@/modules/guests/guests.schema";
import { guestsService } from "@/modules/guests/guests.service";

type Params = { params: { id: string } };

export const GET = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  return ok(await guestsService.get(ctx, params.id));
});

export const PATCH = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  const input = updateGuestSchema.parse(await parseJson(req));
  return ok(await guestsService.update(ctx, params.id, input));
});

export const DELETE = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  await guestsService.remove(ctx, params.id);
  return noContent();
});
