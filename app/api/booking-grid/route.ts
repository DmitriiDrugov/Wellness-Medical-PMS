import { handle, ok } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { bookingGridQuerySchema } from "@/modules/reservations/reservations.schema";
import { reservationsService } from "@/modules/reservations/reservations.service";

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  const query = bookingGridQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await reservationsService.grid(ctx, query));
});
