import { handle, ok } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { consentService } from "@/modules/clinical/consent.service";

type Params = { params: Promise<{ id: string }> };

export const GET = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  return ok(await consentService.status(ctx, (await params).id));
});
