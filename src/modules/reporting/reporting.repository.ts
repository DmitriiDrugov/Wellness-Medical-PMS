import type { ReservationStatus, AppointmentStatus } from "@prisma/client";
import { prisma } from "@/platform/db";

// Reporting is a deliberate read-only projection (a read model) that aggregates across
// the operational and financial planes. It performs SELECTs only — never mutations —
// so reading across module tables here does not violate the write-side boundary rule.

const BLOCKING_RESERVATIONS: ReservationStatus[] = ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT"];
const BLOCKING_APPOINTMENTS: AppointmentStatus[] = ["SCHEDULED", "COMPLETED"];

export const reportingRepository = {
  countRooms(propertyId: string): Promise<number> {
    return prisma.room.count({ where: { propertyId } });
  },

  /** Reservations with a room that overlap [from, to). */
  overlappingReservations(propertyId: string, from: Date, to: Date) {
    return prisma.reservation.findMany({
      where: {
        propertyId,
        roomId: { not: null },
        status: { in: BLOCKING_RESERVATIONS },
        checkInDate: { lt: to },
        checkOutDate: { gt: from },
      },
      select: { checkInDate: true, checkOutDate: true },
    });
  },

  /** Folio line items created within [from, to), scoped to the property via the folio. */
  lineItemsInRange(propertyId: string, from: Date, to: Date) {
    return prisma.folioLineItem.findMany({
      where: { folio: { propertyId }, createdAt: { gte: from, lt: to } },
      select: { type: true, amountMinor: true },
    });
  },

  paymentsInRange(propertyId: string, from: Date, to: Date) {
    return prisma.payment.findMany({
      where: { folio: { propertyId }, paidAt: { gte: from, lt: to } },
      select: { amountMinor: true },
    });
  },

  /** Blocking appointments overlapping [from, to), with treatment details. */
  appointmentsInRange(propertyId: string, from: Date, to: Date) {
    return prisma.treatmentAppointment.findMany({
      where: {
        propertyId,
        status: { in: BLOCKING_APPOINTMENTS },
        startTime: { lt: to },
        endTime: { gt: from },
      },
      select: {
        treatmentId: true,
        treatment: { select: { name: true, durationMinutes: true, priceMinor: true } },
      },
    });
  },
};
