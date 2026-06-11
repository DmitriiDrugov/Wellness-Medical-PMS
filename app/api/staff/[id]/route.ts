import { handle, ok, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { updateStaffSchema } from "@/modules/auth/auth.schema";
import { authService } from "@/modules/auth/auth.service";

type Params = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  const input = updateStaffSchema.parse(await parseJson(req));
  return ok(await authService.updateStaff(ctx, (await params).id, input));
});
