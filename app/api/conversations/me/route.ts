import { handle, ok } from "@/platform/http";
import { requireGuest } from "@/platform/auth/context";
import { messagingService } from "@/modules/messaging/messaging.service";

export const GET = handle(async (req) => {
  const ctx = requireGuest(req);
  return ok(await messagingService.getOrCreateForGuest(ctx));
});
