import { handle, ok } from "@/platform/http";
import { requireStaff } from "@/platform/auth/context";
import { messagingService } from "@/modules/messaging/messaging.service";

type Params = { params: { id: string } };

export const POST = handle(async (req, { params }: Params) => {
  const ctx = requireStaff(req);
  return ok(await messagingService.release(ctx, params.id));
});
