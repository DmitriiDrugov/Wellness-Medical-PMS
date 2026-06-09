import { handle, ok } from "@/platform/http";
import { requireStaff } from "@/platform/auth/context";
import { listConversationsQuerySchema } from "@/modules/messaging/messaging.schema";
import { messagingService } from "@/modules/messaging/messaging.service";

export const GET = handle(async (req) => {
  const ctx = requireStaff(req);
  const q = listConversationsQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const r = await messagingService.listForStaff(ctx, q);
  return ok(r.items, { page: r.page, pageSize: r.pageSize, total: r.total });
});
