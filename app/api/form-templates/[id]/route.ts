import { handle, ok, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { updateFormTemplateSchema } from "@/modules/clinical/clinical.schema";
import { formsService } from "@/modules/clinical/forms.service";

type Params = { params: Promise<{ id: string }> };

export const GET = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  return ok(await formsService.getTemplate(ctx, (await params).id));
});

export const PATCH = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  const input = updateFormTemplateSchema.parse(await parseJson(req));
  return ok(await formsService.updateTemplate(ctx, (await params).id, input));
});
