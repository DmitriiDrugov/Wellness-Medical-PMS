import { handle, ok, created, parseJson } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { authService } from "@/modules/auth/auth.service";
import { createStaffSchema } from "@/modules/auth/auth.schema";
import type { StaffRole } from "@prisma/client";

const ROLES: StaffRole[] = [
  "RECEPTION", "RESERVATION_ADMIN", "THERAPIST", "HOUSEKEEPING", "MANAGER", "ADMIN", "AI_AGENT",
];

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  const param = new URL(req.url).searchParams.get("role");
  const role = ROLES.find((r) => r === param);
  const staff = await authService.listStaff(ctx, role);
  // Slim to the picker shape (StaffRef): no email/isActive exposure to every
  // appointment:read holder. passwordHash is already stripped by toProfile.
  return ok(staff.map((s) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, role: s.role })));
});

export const POST = handle(async (req) => {
  const ctx = requireAuth(req);
  const input = createStaffSchema.parse(await parseJson(req));
  return created(await authService.createStaff(ctx, input));
});
