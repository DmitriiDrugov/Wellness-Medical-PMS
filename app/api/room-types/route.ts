import { handle, ok, created, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { createRoomTypeSchema } from "@/modules/reservations/reservations.schema";
import { reservationsService } from "@/modules/reservations/reservations.service";

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  return ok(await reservationsService.listRoomTypes(ctx));
});

export const POST = handle(async (req) => {
  const ctx = requireAuth(req);
  const input = createRoomTypeSchema.parse(await parseJson(req));
  return created(await reservationsService.createRoomType(ctx, input));
});
