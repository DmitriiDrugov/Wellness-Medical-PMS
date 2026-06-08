import { handle, ok, created, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { createSubmissionSchema, listSubmissionsQuerySchema } from "@/modules/clinical/clinical.schema";
import { formsService } from "@/modules/clinical/forms.service";

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  const query = listSubmissionsQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await formsService.listSubmissions(ctx, query));
});

export const POST = handle(async (req) => {
  const ctx = requireAuth(req);
  const input = createSubmissionSchema.parse(await parseJson(req));
  return created(await formsService.createSubmission(ctx, input));
});
