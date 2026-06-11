import { handle, ok } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { authService } from "@/modules/auth/auth.service";

/** Full staff directory (incl. deactivated accounts) for the Staff page. */
export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  return ok(await authService.listDirectory(ctx));
});
