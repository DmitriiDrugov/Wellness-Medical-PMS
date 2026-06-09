import type { Prisma, TreatmentAppointment, AppointmentStatus } from "@prisma/client";
import { prisma } from "@/platform/db";
import { APPOINTMENT_BLOCKING } from "@/modules/appointments/conflicts";

/** Appointments module repository — the ONLY place that queries TreatmentAppointment. */
export const appointmentsRepository = {
  create(data: Prisma.TreatmentAppointmentCreateInput): Promise<TreatmentAppointment> {
    return prisma.treatmentAppointment.create({ data });
  },

  findById(id: string) {
    return prisma.treatmentAppointment.findUnique({
      where: { id },
      include: { treatment: true, therapist: true, resource: true, guest: true },
    });
  },

  async list(params: {
    propertyId: string;
    skip: number;
    take: number;
    therapistId?: string;
    guestId?: string;
    resourceId?: string;
    status?: AppointmentStatus;
    from?: Date;
    to?: Date;
  }) {
    const where: Prisma.TreatmentAppointmentWhereInput = {
      propertyId: params.propertyId,
      ...(params.therapistId ? { therapistId: params.therapistId } : {}),
      ...(params.guestId ? { guestId: params.guestId } : {}),
      ...(params.resourceId ? { resourceId: params.resourceId } : {}),
      ...(params.status ? { status: params.status } : {}),
      // Half-open overlap with the requested [from, to) window.
      ...(params.from && params.to
        ? { startTime: { lt: params.to }, endTime: { gt: params.from } }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.treatmentAppointment.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { startTime: "asc" },
        include: { treatment: true, therapist: true, resource: true, guest: true },
      }),
      prisma.treatmentAppointment.count({ where }),
    ]);
    return { items, total };
  },

  update(id: string, data: Prisma.TreatmentAppointmentUpdateInput): Promise<TreatmentAppointment> {
    return prisma.treatmentAppointment.update({ where: { id }, data });
  },

  /** Blocking appointments for a therapist overlapping [start, end), excluding one id. */
  findTherapistConflicts(therapistId: string, start: Date, end: Date, excludeId?: string) {
    return prisma.treatmentAppointment.findMany({
      where: {
        therapistId,
        status: { in: APPOINTMENT_BLOCKING },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        startTime: { lt: end },
        endTime: { gt: start },
      },
    });
  },

  /** Blocking appointments for a resource overlapping [start, end), excluding one id. */
  findResourceConflicts(resourceId: string, start: Date, end: Date, excludeId?: string) {
    return prisma.treatmentAppointment.findMany({
      where: {
        resourceId,
        status: { in: APPOINTMENT_BLOCKING },
        ...(excludeId ? { id: { not: excludeId } } : {}),
        startTime: { lt: end },
        endTime: { gt: start },
      },
    });
  },

  /** Whether a therapist has any appointment (any status) with a guest. */
  async existsForTherapistAndGuest(therapistId: string, guestId: string): Promise<boolean> {
    const count = await prisma.treatmentAppointment.count({ where: { therapistId, guestId } });
    return count > 0;
  },

  async guestIdsForTherapist(therapistId: string): Promise<string[]> {
    const rows = await prisma.treatmentAppointment.findMany({
      where: { therapistId },
      select: { guestId: true },
      distinct: ["guestId"],
    });
    return rows.map((r) => r.guestId);
  },

  /** Busy intervals for a therapist and/or resource within [from, to). */
  findBusy(params: { propertyId: string; therapistId?: string; resourceId?: string; from: Date; to: Date }) {
    const or: Prisma.TreatmentAppointmentWhereInput[] = [];
    if (params.therapistId) or.push({ therapistId: params.therapistId });
    if (params.resourceId) or.push({ resourceId: params.resourceId });
    return prisma.treatmentAppointment.findMany({
      where: {
        propertyId: params.propertyId,
        status: { in: APPOINTMENT_BLOCKING },
        OR: or,
        startTime: { lt: params.to },
        endTime: { gt: params.from },
      },
      orderBy: { startTime: "asc" },
      select: { id: true, startTime: true, endTime: true, therapistId: true, resourceId: true },
    });
  },
};
