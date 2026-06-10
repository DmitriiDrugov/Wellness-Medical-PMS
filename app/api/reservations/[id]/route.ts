import { handle, ok, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { updateReservationSchema } from "@/modules/reservations/reservations.schema";
import { reservationsService } from "@/modules/reservations/reservations.service";

type Params = { params: Promise<{ id: string }> };

export const GET = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  return ok(await reservationsService.get(ctx, (await params).id));
});

export const PATCH = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  const input = updateReservationSchema.parse(await parseJson(req));
  return ok(await reservationsService.update(ctx, (await params).id, input));
});
