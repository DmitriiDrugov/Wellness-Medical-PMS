import { handle, ok } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { appointmentAvailabilityQuerySchema } from "@/modules/appointments/appointments.schema";
import { appointmentsService } from "@/modules/appointments/appointments.service";

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  const query = appointmentAvailabilityQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  return ok(await appointmentsService.availability(ctx, query));
});
