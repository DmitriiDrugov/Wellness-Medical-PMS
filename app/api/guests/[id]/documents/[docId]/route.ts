import { handle, noContent } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { guestsService } from "@/modules/guests/guests.service";

type Params = { params: Promise<{ id: string; docId: string }> };

export const DELETE = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  const { id, docId } = await params;
  await guestsService.removeDocument(ctx, id, docId);
  return noContent();
});
