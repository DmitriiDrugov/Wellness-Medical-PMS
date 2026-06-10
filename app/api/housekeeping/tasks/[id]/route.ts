import { handle, ok, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { updateTaskSchema } from "@/modules/housekeeping/housekeeping.schema";
import { housekeepingService } from "@/modules/housekeeping/housekeeping.service";

type Params = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  const input = updateTaskSchema.parse(await parseJson(req));
  return ok(await housekeepingService.updateTask(ctx, (await params).id, input));
});
