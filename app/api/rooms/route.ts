import { handle, ok } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { reservationsService } from "@/modules/reservations/reservations.service";

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  return ok(await reservationsService.listRooms(ctx));
});
