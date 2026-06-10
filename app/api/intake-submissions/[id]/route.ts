import { handle, ok, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { updateSubmissionSchema } from "@/modules/clinical/clinical.schema";
import { formsService } from "@/modules/clinical/forms.service";

type Params = { params: Promise<{ id: string }> };

export const GET = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  return ok(await formsService.getSubmission(ctx, (await params).id));
});

export const PATCH = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  const input = updateSubmissionSchema.parse(await parseJson(req));
  return ok(await formsService.updateSubmission(ctx, (await params).id, input));
});
