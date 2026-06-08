import { handle, ok } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { reservationsService } from "@/modules/reservations/reservations.service";

type Params = { params: { id: string } };

export const POST = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  return ok(await reservationsService.checkIn(ctx, params.id));
});
