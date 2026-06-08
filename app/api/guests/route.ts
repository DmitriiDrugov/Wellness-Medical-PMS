import { handle, ok, created, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { createGuestSchema, listGuestsQuerySchema } from "@/modules/guests/guests.schema";
import { guestsService } from "@/modules/guests/guests.service";

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  const query = listGuestsQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const result = await guestsService.list(ctx, query);
  return ok(result.items, { page: result.page, pageSize: result.pageSize, total: result.total });
});

export const POST = handle(async (req) => {
  const ctx = requireAuth(req);
  const input = createGuestSchema.parse(await parseJson(req));
  const guest = await guestsService.create(ctx, input);
  return created(guest);
});
