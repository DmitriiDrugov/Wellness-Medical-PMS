import { handle, ok } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { authService } from "@/modules/auth/auth.service";

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  const profile = await authService.getProfile(ctx.staffId);
  return ok(profile);
});
