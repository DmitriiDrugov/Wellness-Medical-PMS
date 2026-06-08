import { handle, ok, created, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { createRecordSchema, listRecordsQuerySchema } from "@/modules/clinical/clinical.schema";
import { recordsService } from "@/modules/clinical/records.service";

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  const query = listRecordsQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await recordsService.list(ctx, query));
});

export const POST = handle(async (req) => {
  const ctx = requireAuth(req);
  const input = createRecordSchema.parse(await parseJson(req));
  return created(await recordsService.create(ctx, input));
});
