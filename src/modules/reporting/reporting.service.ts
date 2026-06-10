import type { AuthContext } from "@/platform/auth/context";
import { requireCapability } from "@/platform/rbac";
import { nightsBetween } from "@/platform/intervals";
import { reportingRepository } from "@/modules/reporting/reporting.repository";
import { nightsInWindow, occupancyRate, groupChargesByType, sumAmounts, summarizeTouristTax } from "@/modules/reporting/aggregate";
import type { DateRangeQuery } from "@/modules/reporting/reporting.schema";

export const reportingService = {
  async occupancy(ctx: AuthContext, q: DateRangeQuery) {
    requireCapability(ctx.role, "report:read");
    const [totalRooms, reservations] = await Promise.all([
      reportingRepository.countRooms(ctx.propertyId),
      reportingRepository.overlappingReservations(ctx.propertyId, q.from, q.to),
    ]);
    const nights = nightsBetween(q.from, q.to);
    const bookedRoomNights = reservations.reduce(
      (sum, r) => sum + nightsInWindow(r.checkInDate, r.checkOutDate, q.from, q.to),
      0,
    );
    return {
      from: q.from,
      to: q.to,
      nights,
      totalRooms,
      capacityRoomNights: totalRooms * nights,
      bookedRoomNights,
      occupancyRate: Number(occupancyRate(bookedRoomNights, totalRooms, nights).toFixed(4)),
    };
  },

  async revenue(ctx: AuthContext, q: DateRangeQuery) {
    requireCapability(ctx.role, "report:read");
    const [items, payments] = await Promise.all([
      reportingRepository.lineItemsInRange(ctx.propertyId, q.from, q.to),
      reportingRepository.paymentsInRange(ctx.propertyId, q.from, q.to),
    ]);
    const chargesByTypeMinor = groupChargesByType(items);
    return {
      from: q.from,
      to: q.to,
      currency: "HUF",
      chargesByTypeMinor,
      totalChargesMinor: sumAmounts(items),
      totalPaymentsMinor: sumAmounts(payments),
    };
  },

  /** Tourist-tax (IFA) return: per-stay rows + totals for the municipal/NTAK report. */
  async touristTax(ctx: AuthContext, q: DateRangeQuery) {
    requireCapability(ctx.role, "report:read");
    const rows = await reportingRepository.touristTaxInRange(ctx.propertyId, q.from, q.to);
    return {
      from: q.from,
      to: q.to,
      currency: "HUF",
      ...summarizeTouristTax(rows),
      rows: rows.map((r) => ({
        id: r.id,
        guestName: `${r.folio.guest.firstName} ${r.folio.guest.lastName}`.trim(),
        personNights: r.quantity,
        taxMinor: r.amountMinor,
        postedAt: r.createdAt,
      })),
    };
  },

  async treatmentUtilization(ctx: AuthContext, q: DateRangeQuery) {
    requireCapability(ctx.role, "report:read");
    const appts = await reportingRepository.appointmentsInRange(ctx.propertyId, q.from, q.to);
    const byTreatment = new Map<
      string,
      { treatmentId: string; name: string; appointments: number; totalMinutes: number; revenueMinor: number }
    >();
    for (const a of appts) {
      const row = byTreatment.get(a.treatmentId) ?? {
        treatmentId: a.treatmentId,
        name: a.treatment.name,
        appointments: 0,
        totalMinutes: 0,
        revenueMinor: 0,
      };
      row.appointments += 1;
      row.totalMinutes += a.treatment.durationMinutes;
      row.revenueMinor += a.treatment.priceMinor;
      byTreatment.set(a.treatmentId, row);
    }
    return {
      from: q.from,
      to: q.to,
      treatments: [...byTreatment.values()].sort((a, b) => b.appointments - a.appointments),
    };
  },
};
