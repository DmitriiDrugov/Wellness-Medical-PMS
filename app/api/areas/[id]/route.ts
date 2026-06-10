import { handle, ok, noContent, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { updateAreaSchema } from "@/modules/property/property.schema";
import { propertyService } from "@/modules/property/property.service";

type Params = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  const input = updateAreaSchema.parse(await parseJson(req));
  return ok(await propertyService.updateArea(ctx, (await params).id, input));
});

export const DELETE = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  await propertyService.deleteArea(ctx, (await params).id);
  return noContent();
});
