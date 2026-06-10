import { handle, ok } from "@/platform/http";
import { requireStaff } from "@/platform/auth/context";
import { messagingService } from "@/modules/messaging/messaging.service";

type Params = { params: Promise<{ id: string }> };

export const GET = handle(async (req, { params }: Params) => {
  const ctx = requireStaff(req);
  return ok(await messagingService.getForStaff(ctx, (await params).id));
});
