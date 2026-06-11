import { handle, ok, created, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { createRoomSchema } from "@/modules/reservations/reservations.schema";
import { reservationsService } from "@/modules/reservations/reservations.service";

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  return ok(await reservationsService.listRooms(ctx));
});

export const POST = handle(async (req) => {
  const ctx = requireAuth(req);
  const input = createRoomSchema.parse(await parseJson(req));
  return created(await reservationsService.createRoom(ctx, input));
});
