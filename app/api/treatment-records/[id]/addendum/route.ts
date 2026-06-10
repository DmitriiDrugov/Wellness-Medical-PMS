import { handle, created, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { addendumSchema } from "@/modules/clinical/clinical.schema";
import { recordsService } from "@/modules/clinical/records.service";

type Params = { params: Promise<{ id: string }> };

export const POST = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  const input = addendumSchema.parse(await parseJson(req));
  return created(await recordsService.addendum(ctx, (await params).id, input));
});
