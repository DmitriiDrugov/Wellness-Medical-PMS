import { handle, ok, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { updatePackageSchema } from "@/modules/packages/packages.schema";
import { packagesService } from "@/modules/packages/packages.service";

type Params = { params: Promise<{ id: string }> };

export const GET = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  return ok(await packagesService.get(ctx, (await params).id));
});

export const PATCH = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  const input = updatePackageSchema.parse(await parseJson(req));
  return ok(await packagesService.update(ctx, (await params).id, input));
});
