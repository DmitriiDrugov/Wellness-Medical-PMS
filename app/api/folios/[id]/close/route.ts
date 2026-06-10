import { handle, ok } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { folioService } from "@/modules/folio/folio.service";

type Params = { params: Promise<{ id: string }> };

export const POST = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  return ok(await folioService.close(ctx, (await params).id));
});
