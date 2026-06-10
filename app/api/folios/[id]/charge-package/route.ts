import { handle, created, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { chargePackageSchema } from "@/modules/folio/folio.schema";
import { folioService } from "@/modules/folio/folio.service";

type Params = { params: Promise<{ id: string }> };

export const POST = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  const input = chargePackageSchema.parse(await parseJson(req));
  return created(await folioService.chargePackage(ctx, (await params).id, input));
});
