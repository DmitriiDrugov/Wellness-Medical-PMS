import { handle, ok, created, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { grantConsentSchema } from "@/modules/clinical/clinical.schema";
import { consentService } from "@/modules/clinical/consent.service";

// (await params).id is the guestId (segment shares the existing guests/[id] dynamic name).
type Params = { params: Promise<{ id: string }> };

export const GET = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  return ok(await consentService.listFull(ctx, (await params).id));
});

export const POST = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  const input = grantConsentSchema.parse(await parseJson(req));
  return created(await consentService.grant(ctx, (await params).id, input));
});
