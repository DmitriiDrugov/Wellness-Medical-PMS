import { handle, ok, created, parseJson } from "@/platform/http";
import { requireStaff } from "@/platform/auth/context";
import { listMessagesQuerySchema, sendMessageSchema } from "@/modules/messaging/messaging.schema";
import { messagingService } from "@/modules/messaging/messaging.service";

type Params = { params: Promise<{ id: string }> };

export const GET = handle(async (req, { params }: Params) => {
  const ctx = requireStaff(req);
  const q = listMessagesQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await messagingService.listMessagesForStaff(ctx, (await params).id, q));
});

export const POST = handle(async (req, { params }: Params) => {
  const ctx = requireStaff(req);
  const input = sendMessageSchema.parse(await parseJson(req));
  return created(await messagingService.staffSend(ctx, (await params).id, input.body));
});
