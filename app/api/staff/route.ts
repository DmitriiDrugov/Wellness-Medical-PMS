import { handle, ok } from "@/platform/http";
import { requireAuth } from "@/platform/auth/context";
import { authService } from "@/modules/auth/auth.service";
import type { StaffRole } from "@prisma/client";

const ROLES: StaffRole[] = [
  "RECEPTION", "RESERVATION_ADMIN", "THERAPIST", "HOUSEKEEPING", "MANAGER", "ADMIN", "AI_AGENT",
];

export const GET = handle(async (req) => {
  const ctx = requireAuth(req);
  const param = new URL(req.url).searchParams.get("role");
  const role = ROLES.find((r) => r === param);
  return ok(await authService.listStaff(ctx, role));
});
