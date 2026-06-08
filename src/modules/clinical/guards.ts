import type { AuthContext } from "@/platform/auth/context";
import { ForbiddenError } from "@/platform/errors";
import { recordAudit } from "@/platform/audit";
import { appointmentsService } from "@/modules/appointments/appointments.service";
import { canTherapistAccess } from "@/modules/clinical/access";

/**
 * Therapist clinical-scope guards (service layer). Non-therapist roles holding the
 * capability are not narrowed. Therapists are limited to guests they have an
 * appointment with (and, for records, anything they authored).
 */
export async function assertGuestClinicalScope(ctx: AuthContext, guestId: string): Promise<void> {
  if (ctx.role !== "THERAPIST") return;
  const hasAppointmentWithGuest = await appointmentsService.hasAppointmentWithGuest(ctx.staffId, guestId);
  if (!canTherapistAccess({ role: ctx.role, staffId: ctx.staffId, hasAppointmentWithGuest })) {
    throw new ForbiddenError("Guest is outside your clinical scope");
  }
}

export async function assertRecordScope(
  ctx: AuthContext,
  record: { guestId: string; providerId: string },
): Promise<void> {
  if (ctx.role !== "THERAPIST") return;
  const hasAppointmentWithGuest =
    record.providerId === ctx.staffId
      ? true
      : await appointmentsService.hasAppointmentWithGuest(ctx.staffId, record.guestId);
  if (
    !canTherapistAccess({
      role: ctx.role,
      staffId: ctx.staffId,
      providerId: record.providerId,
      hasAppointmentWithGuest,
    })
  ) {
    throw new ForbiddenError("Record is outside your clinical scope");
  }
}

/** Audit a clinical-data READ access (spec: every read/write of clinical data is logged). */
export function auditClinicalRead(
  ctx: AuthContext,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  return recordAudit({
    actorStaffId: ctx.staffId,
    propertyId: ctx.propertyId,
    action: "READ",
    entityType,
    entityId,
    metadata,
  });
}
