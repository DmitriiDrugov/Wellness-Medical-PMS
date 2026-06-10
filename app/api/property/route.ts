import { handle, ok, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { updatePropertySchema } from "@/modules/property/property.schema";
import { propertyService } from "@/modules/property/property.service";

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  return ok(await propertyService.get(ctx));
});

export const PATCH = handle(async (req) => {
  const ctx = requireAuth(req);
  const input = updatePropertySchema.parse(await parseJson(req));
  return ok(await propertyService.update(ctx, input));
});
