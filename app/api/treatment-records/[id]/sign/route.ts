import { handle, ok } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { recordsService } from "@/modules/clinical/records.service";

type Params = { params: Promise<{ id: string }> };

export const POST = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  return ok(await recordsService.sign(ctx, (await params).id));
});
