import { handle, ok, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { assignRoomSchema } from "@/modules/reservations/reservations.schema";
import { reservationsService } from "@/modules/reservations/reservations.service";

type Params = { params: Promise<{ id: string }> };

export const POST = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  const { roomId } = assignRoomSchema.parse(await parseJson(req));
  return ok(await reservationsService.assignRoom(ctx, (await params).id, roomId));
});
