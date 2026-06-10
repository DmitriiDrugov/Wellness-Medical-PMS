import { handle, ok, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { updateRecordSchema } from "@/modules/clinical/clinical.schema";
import { recordsService } from "@/modules/clinical/records.service";

type Params = { params: Promise<{ id: string }> };

export const GET = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  return ok(await recordsService.get(ctx, (await params).id));
});

export const PATCH = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  const input = updateRecordSchema.parse(await parseJson(req));
  return ok(await recordsService.update(ctx, (await params).id, input));
});
