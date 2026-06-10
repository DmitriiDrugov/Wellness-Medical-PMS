import { handle, ok, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { updateResourceSchema } from "@/modules/resources/resources.schema";
import { resourcesService } from "@/modules/resources/resources.service";

type Params = { params: Promise<{ id: string }> };

export const GET = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  return ok(await resourcesService.get(ctx, (await params).id));
});

export const PATCH = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  const input = updateResourceSchema.parse(await parseJson(req));
  return ok(await resourcesService.update(ctx, (await params).id, input));
});
