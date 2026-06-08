import { handle, ok, created, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { createFormTemplateSchema } from "@/modules/clinical/clinical.schema";
import { formsService } from "@/modules/clinical/forms.service";

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  return ok(await formsService.listTemplates(ctx));
});

export const POST = handle(async (req) => {
  const ctx = requireAuth(req);
  const input = createFormTemplateSchema.parse(await parseJson(req));
  return created(await formsService.createTemplate(ctx, input));
});
