import { handle, ok, created, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { addDocumentSchema } from "@/modules/guests/guests.schema";
import { guestsService } from "@/modules/guests/guests.service";

type Params = { params: Promise<{ id: string }> };

export const GET = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  return ok(await guestsService.listDocuments(ctx, (await params).id));
});

export const POST = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  const input = addDocumentSchema.parse(await parseJson(req));
  return created(await guestsService.addDocument(ctx, (await params).id, input));
});
