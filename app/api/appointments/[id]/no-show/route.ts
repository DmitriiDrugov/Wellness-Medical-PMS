import { handle, ok } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { appointmentsService } from "@/modules/appointments/appointments.service";

type Params = { params: Promise<{ id: string }> };

export const POST = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  return ok(await appointmentsService.noShow(ctx, (await params).id));
});
