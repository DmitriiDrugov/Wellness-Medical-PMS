import { handle, ok, created, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { createPackageSchema } from "@/modules/packages/packages.schema";
import { packagesService } from "@/modules/packages/packages.service";

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  return ok(await packagesService.list(ctx));
});

export const POST = handle(async (req) => {
  const ctx = requireAuth(req);
  const input = createPackageSchema.parse(await parseJson(req));
  return created(await packagesService.create(ctx, input));
});
