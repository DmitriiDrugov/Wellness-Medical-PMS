import { handle, ok, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { updateAppointmentSchema } from "@/modules/appointments/appointments.schema";
import { appointmentsService } from "@/modules/appointments/appointments.service";

type Params = { params: Promise<{ id: string }> };

export const GET = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  return ok(await appointmentsService.get(ctx, (await params).id));
});

export const PATCH = handle(async (req, { params }: Params) => {
  const ctx = requireAuth(req);
  const input = updateAppointmentSchema.parse(await parseJson(req));
  return ok(await appointmentsService.update(ctx, (await params).id, input));
});
