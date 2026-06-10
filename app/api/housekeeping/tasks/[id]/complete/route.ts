import { handle, ok } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { housekeepingService } from "@/modules/housekeeping/housekeeping.service";

type Params = { params: Promise<{ id: string }> };

export const POST = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  return ok(await housekeepingService.transition(ctx, (await params).id, "DONE"));
});
