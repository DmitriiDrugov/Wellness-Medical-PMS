import { handle, ok } from "@/platform/http";
import { requireGuest } from "@/platform/auth/context";
import { guestPortalService } from "@/modules/guest-portal/guest-portal.service";

export const GET = handle(async (req) => {
  const ctx = requireGuest(req);
  return ok(await guestPortalService.appointments(ctx));
});
