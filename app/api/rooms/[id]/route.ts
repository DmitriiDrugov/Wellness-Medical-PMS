import { handle, ok, noContent, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { updateRoomSchema } from "@/modules/reservations/reservations.schema";
import { reservationsService } from "@/modules/reservations/reservations.service";

type Params = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  const input = updateRoomSchema.parse(await parseJson(req));
  return ok(await reservationsService.updateRoom(ctx, (await params).id, input));
});

export const DELETE = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  await reservationsService.deleteRoom(ctx, (await params).id);
  return noContent();
});
