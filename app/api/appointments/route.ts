import { handle, ok, created, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import {
  createAppointmentSchema,
  listAppointmentsQuerySchema,
} from "@/modules/appointments/appointments.schema";
import { appointmentsService } from "@/modules/appointments/appointments.service";

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  const query = listAppointmentsQuerySchema.parse(Object.fromEntries(new URL(req.url).searchParams));
  const result = await appointmentsService.list(ctx, query);
  return ok(result.items, { page: result.page, pageSize: result.pageSize, total: result.total });
});

export const POST = handle(async (req) => {
  const ctx = requireAuth(req);
  const input = createAppointmentSchema.parse(await parseJson(req));
  return created(await appointmentsService.create(ctx, input));
});
