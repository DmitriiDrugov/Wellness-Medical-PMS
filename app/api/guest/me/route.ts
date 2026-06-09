import { handle, ok } from "@/platform/http";
import { requireGuest } from "@/platform/auth/context";
import { guestAuthService } from "@/modules/guest-auth/guest-auth.service";

export const GET = handle(async (req) => {
  const ctx = requireGuest(req);
  return ok(await guestAuthService.getProfile(ctx.guestAccountId));
});
