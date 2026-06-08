import { handle, created, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { chargePackageSchema } from "@/modules/folio/folio.schema";
import { folioService } from "@/modules/folio/folio.service";

type Params = { params: { id: string } };

export const POST = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  const input = chargePackageSchema.parse(await parseJson(req));
  return created(await folioService.chargePackage(ctx, params.id, input));
});
