import { handle, ok, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { updateRoomTypeSchema } from "@/modules/reservations/reservations.schema";
import { reservationsService } from "@/modules/reservations/reservations.service";

type Params = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  const input = updateRoomTypeSchema.parse(await parseJson(req));
  return ok(await reservationsService.updateRoomType(ctx, (await params).id, input));
});
