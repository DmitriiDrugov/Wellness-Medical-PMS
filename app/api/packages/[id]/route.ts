import { handle, ok, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { updatePackageSchema } from "@/modules/packages/packages.schema";
import { packagesService } from "@/modules/packages/packages.service";

type Params = { params: { id: string } };

export const GET = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  return ok(await packagesService.get(ctx, params.id));
});

export const PATCH = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  const input = updatePackageSchema.parse(await parseJson(req));
  return ok(await packagesService.update(ctx, params.id, input));
});
