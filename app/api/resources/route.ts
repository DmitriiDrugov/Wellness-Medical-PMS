import { handle, ok, created, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { createResourceSchema } from "@/modules/resources/resources.schema";
import { resourcesService } from "@/modules/resources/resources.service";

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  return ok(await resourcesService.list(ctx));
});

export const POST = handle(async (req) => {
  const ctx = requireAuth(req);
  const input = createResourceSchema.parse(await parseJson(req));
  return created(await resourcesService.create(ctx, input));
});
