import { handle, ok } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { listFoliosQuerySchema } from "@/modules/folio/folio.schema";
import { folioService } from "@/modules/folio/folio.service";

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  const query = listFoliosQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await folioService.list(ctx, query));
});
