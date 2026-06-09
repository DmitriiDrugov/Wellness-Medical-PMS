import type { TreatmentAppointment } from "@prisma/client";
import type { AuthContext } from "@/platform/auth/context";
import { requireCapability } from "@/platform/rbac";
import { recordAudit } from "@/platform/audit";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/platform/errors";
import { authService } from "@/modules/auth/auth.service";
import { guestsService } from "@/modules/guests/guests.service";
import { treatmentsService } from "@/modules/treatments/treatments.service";
import { resourcesService } from "@/modules/resources/resources.service";
import { folioService } from "@/modules/folio/folio.service";
import { appointmentsRepository } from "@/modules/appointments/appointments.repository";
import { computeEndTime, resourceMatchesTreatment } from "@/modules/appointments/conflicts";
import type {
  CreateAppointmentInput,
  UpdateAppointmentInput,
  ListAppointmentsQuery,
  AppointmentAvailabilityQuery,
} from "@/modules/appointments/appointments.schema";

async function getOrThrow(id: string) {
  const appt = await appointmentsRepository.findById(id);
  if (!appt) throw new NotFoundError("Appointment not found");
  return appt;
}

/** A therapist may only act on their own appointments. */
function assertOwnership(ctx: AuthContext, therapistId: string): void {
  if (ctx.role === "THERAPIST" && therapistId !== ctx.staffId) {
    throw new ForbiddenError("Therapists can only manage their own appointments");
  }
}

async function assertValidTherapist(propertyId: string, therapistId: string): Promise<void> {
  const therapist = await authService.getProfile(therapistId);
  if (therapist.role !== "THERAPIST" || therapist.propertyId !== propertyId || !therapist.isActive) {
    throw new ValidationError("therapistId must reference an active therapist in this property");
  }
}

/** Throw ConflictError if therapist or resource is double-booked for [start, end). */
async function assertNoDoubleBooking(
  therapistId: string,
  resourceId: string,
  start: Date,
  end: Date,
  excludeId?: string,
): Promise<void> {
  const [therapistConflicts, resourceConflicts] = await Promise.all([
    appointmentsRepository.findTherapistConflicts(therapistId, start, end, excludeId),
    appointmentsRepository.findResourceConflicts(resourceId, start, end, excludeId),
  ]);
  if (therapistConflicts.length > 0) {
    throw new ConflictError("Therapist is already booked for this time slot", {
      conflictingAppointmentIds: therapistConflicts.map((c) => c.id),
    });
  }
  if (resourceConflicts.length > 0) {
    throw new ConflictError("Resource is already booked for this time slot", {
      conflictingAppointmentIds: resourceConflicts.map((c) => c.id),
    });
  }
}

export const appointmentsService = {
  async list(ctx: AuthContext, query: ListAppointmentsQuery) {
    requireCapability(ctx.role, "appointment:read");
    // Therapists see only their own schedule.
    const therapistId = ctx.role === "THERAPIST" ? ctx.staffId : query.therapistId;
    const { items, total } = await appointmentsRepository.list({
      propertyId: ctx.propertyId,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      therapistId,
      guestId: query.guestId,
      resourceId: query.resourceId,
      status: query.status,
      from: query.from,
      to: query.to,
    });
    return { items, total, page: query.page, pageSize: query.pageSize };
  },

  async get(ctx: AuthContext, id: string) {
    requireCapability(ctx.role, "appointment:read");
    const appt = await getOrThrow(id);
    assertOwnership(ctx, appt.therapistId);
    return appt;
  },

  async create(ctx: AuthContext, input: CreateAppointmentInput): Promise<TreatmentAppointment> {
    requireCapability(ctx.role, "appointment:write");
    assertOwnership(ctx, input.therapistId);

    const treatment = await treatmentsService.requireActive(ctx.propertyId, input.treatmentId);
    const resource = await resourcesService.requireActive(ctx.propertyId, input.resourceId);
    if (!resourceMatchesTreatment(resource.type, treatment.requiredResourceType)) {
      throw new ValidationError(`Treatment requires a ${treatment.requiredResourceType} resource`);
    }
    await assertValidTherapist(ctx.propertyId, input.therapistId);
    await guestsService.get(ctx, input.guestId); // validates the guest exists/visible

    const start = input.startTime;
    const end = computeEndTime(start, treatment.durationMinutes);
    await assertNoDoubleBooking(input.therapistId, input.resourceId, start, end);

    const appt = await appointmentsRepository.create({
      property: { connect: { id: ctx.propertyId } },
      guest: { connect: { id: input.guestId } },
      treatment: { connect: { id: input.treatmentId } },
      therapist: { connect: { id: input.therapistId } },
      resource: { connect: { id: input.resourceId } },
      startTime: start,
      endTime: end,
      ...(input.reservationId ? { reservation: { connect: { id: input.reservationId } } } : {}),
      notes: input.notes,
      status: "SCHEDULED",
    });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "CREATE",
      entityType: "TreatmentAppointment",
      entityId: appt.id,
      after: appt,
    });
    return appt;
  },

  /** Reschedule and/or reassign. Only SCHEDULED appointments may be modified. */
  async update(ctx: AuthContext, id: string, input: UpdateAppointmentInput): Promise<TreatmentAppointment> {
    requireCapability(ctx.role, "appointment:write");
    const before = await getOrThrow(id);
    assertOwnership(ctx, before.therapistId);
    if (before.status !== "SCHEDULED") {
      throw new ConflictError(`Cannot modify an appointment with status ${before.status}`);
    }

    const therapistId = input.therapistId ?? before.therapistId;
    const resourceId = input.resourceId ?? before.resourceId;
    const start = input.startTime ?? before.startTime;
    assertOwnership(ctx, therapistId);

    const treatment = await treatmentsService.requireActive(ctx.propertyId, before.treatmentId);
    const end = computeEndTime(start, treatment.durationMinutes);

    if (input.resourceId) {
      const resource = await resourcesService.requireActive(ctx.propertyId, resourceId);
      if (!resourceMatchesTreatment(resource.type, treatment.requiredResourceType)) {
        throw new ValidationError(`Treatment requires a ${treatment.requiredResourceType} resource`);
      }
    }
    if (input.therapistId) {
      await assertValidTherapist(ctx.propertyId, therapistId);
    }
    if (input.startTime || input.therapistId || input.resourceId) {
      await assertNoDoubleBooking(therapistId, resourceId, start, end, id);
    }

    const after = await appointmentsRepository.update(id, {
      ...(input.therapistId ? { therapist: { connect: { id: therapistId } } } : {}),
      ...(input.resourceId ? { resource: { connect: { id: resourceId } } } : {}),
      ...(input.startTime ? { startTime: start, endTime: end } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "UPDATE",
      entityType: "TreatmentAppointment",
      entityId: id,
      before,
      after,
    });
    return after;
  },

  async complete(ctx: AuthContext, id: string): Promise<TreatmentAppointment> {
    requireCapability(ctx.role, "appointment:complete");
    const before = await getOrThrow(id);
    assertOwnership(ctx, before.therapistId);
    if (before.status !== "SCHEDULED") {
      throw new ConflictError(`Cannot complete an appointment with status ${before.status}`);
    }
    const after = await this.applyStatus(ctx, id, "COMPLETED", before);
    // A completed treatment linked to a stay is billable: post it to that folio.
    if (before.reservationId) {
      await folioService.postTreatmentCharge(ctx, {
        reservationId: before.reservationId,
        appointmentId: before.id,
        description: before.treatment.name,
        priceMinor: before.treatment.priceMinor,
      });
    }
    return after;
  },

  async cancel(ctx: AuthContext, id: string): Promise<TreatmentAppointment> {
    requireCapability(ctx.role, "appointment:write");
    const before = await getOrThrow(id);
    assertOwnership(ctx, before.therapistId);
    if (["COMPLETED", "CANCELLED"].includes(before.status)) {
      throw new ConflictError(`Cannot cancel an appointment with status ${before.status}`);
    }
    return this.applyStatus(ctx, id, "CANCELLED", before);
  },

  async applyStatus(
    ctx: AuthContext,
    id: string,
    next: "COMPLETED" | "CANCELLED",
    before: TreatmentAppointment,
  ): Promise<TreatmentAppointment> {
    const after = await appointmentsRepository.update(id, { status: next });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "STATE_CHANGE",
      entityType: "TreatmentAppointment",
      entityId: id,
      before,
      after,
      metadata: { from: before.status, to: next },
    });
    return after;
  },

  /** Cross-module interface (no RBAC): used by the clinical module for read-scoping. */
  async hasAppointmentWithGuest(therapistId: string, guestId: string): Promise<boolean> {
    return appointmentsRepository.existsForTherapistAndGuest(therapistId, guestId);
  },

  async availability(ctx: AuthContext, query: AppointmentAvailabilityQuery) {
    requireCapability(ctx.role, "appointment:read");
    const busy = await appointmentsRepository.findBusy({
      propertyId: ctx.propertyId,
      therapistId: query.therapistId,
      resourceId: query.resourceId,
      from: query.from,
      to: query.to,
    });
    return { from: query.from, to: query.to, busy };
  },
};
