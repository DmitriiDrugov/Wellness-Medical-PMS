import { handle, ok, parseJson } from "@/platform/http";
import { requireGuest } from "@/platform/auth/context";
import { listMessagesQuerySchema, sendMessageSchema } from "@/modules/messaging/messaging.schema";
import { messagingService } from "@/modules/messaging/messaging.service";

export const GET = handle(async (req) => {
  const ctx = requireGuest(req);
  const q = listMessagesQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await messagingService.listMessagesForGuest(ctx, q));
});

export const POST = handle(async (req) => {
  const ctx = requireGuest(req);
  const input = sendMessageSchema.parse(await parseJson(req));
  return ok(await messagingService.guestSend(ctx, input.body));
});
