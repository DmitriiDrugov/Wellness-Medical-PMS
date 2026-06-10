import { handle, ok } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { housekeepingService } from "@/modules/housekeeping/housekeeping.service";

/**
 * Mobile endpoint for housekeeping staff: the authenticated member's own active
 * (not-done) tasks, newest-priority first. Same staff JWT — no separate mobile auth.
 */
export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  return ok(await housekeepingService.myTasks(ctx));
});
