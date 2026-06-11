import { handle, ok, created, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { createAreaSchema } from "@/modules/property/property.schema";
import { propertyService } from "@/modules/property/property.service";

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  return ok(await propertyService.listAreas(ctx));
});

export const POST = handle(async (req) => {
  const ctx = requireAuth(req);
  const input = createAreaSchema.parse(await parseJson(req));
  return created(await propertyService.createArea(ctx, input));
});
