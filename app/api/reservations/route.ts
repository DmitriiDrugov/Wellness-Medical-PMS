import { handle, ok, created, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import {
  createReservationSchema,
  listReservationsQuerySchema,
} from "@/modules/reservations/reservations.schema";
import { reservationsService } from "@/modules/reservations/reservations.service";

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  const query = listReservationsQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const result = await reservationsService.list(ctx, query);
  return ok(result.items, { page: result.page, pageSize: result.pageSize, total: result.total });
});

export const POST = handle(async (req) => {
  const ctx = requireAuth(req);
  const input = createReservationSchema.parse(await parseJson(req));
  return created(await reservationsService.create(ctx, input));
});
