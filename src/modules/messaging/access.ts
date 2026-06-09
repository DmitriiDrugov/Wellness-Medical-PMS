import type { StaffRole } from "@prisma/client";
import { ForbiddenError } from "@/platform/errors";

const ALL_ACCESS: StaffRole[] = ["RECEPTION", "RESERVATION_ADMIN", "MANAGER", "ADMIN"];

/**
 * Whether a staff member may read/write a conversation.
 * `therapistHasGuest` is supplied by the service (appointmentsService.hasAppointmentWithGuest).
 */
export function canStaffAccessConversation(
  role: StaffRole,
  _staffId: string,
  _conv: { guestId: string },
  therapistHasGuest: boolean,
): boolean {
  if (ALL_ACCESS.includes(role)) return true;
  if (role === "THERAPIST") return therapistHasGuest;
  return false; // HOUSEKEEPING, AI_AGENT handled separately
}

export function assertGuestOwnsConversation(guestId: string, conv: { guestId: string }): void {
  if (conv.guestId !== guestId) throw new ForbiddenError("Not your conversation");
}
