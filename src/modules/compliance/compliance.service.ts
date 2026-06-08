import type { AuthContext } from "@/platform/auth/context";
import { requireCapability } from "@/platform/rbac";
import { recordAudit } from "@/platform/audit";
import { NotFoundError } from "@/platform/errors";
import { complianceGateway } from "@/platform/compliance/gateway";
import { reportingService } from "@/modules/reporting/reporting.service";
import { folioService } from "@/modules/folio/folio.service";
import { guestsService } from "@/modules/guests/guests.service";
import { complianceRepository } from "@/modules/compliance/compliance.repository";
import { buildNtakDailyPayload, buildNavInvoicePayload, type PropertyIdentity } from "@/modules/compliance/payloads";
import type { NtakDailyReportInput, NavInvoiceInput } from "@/modules/compliance/compliance.schema";

async function loadPropertyIdentity(propertyId: string): Promise<PropertyIdentity> {
  const p = await complianceRepository.getProperty(propertyId);
  if (!p) throw new NotFoundError("Property not found");
  return {
    name: p.name,
    legalName: p.legalName,
    taxNumber: p.taxNumber,
    ntakRegNumber: p.ntakRegNumber,
    addressLine: p.addressLine,
    city: p.city,
    postalCode: p.postalCode,
    country: p.country,
  };
}

export const complianceService = {
  async generateNtakDailyReport(ctx: AuthContext, input: NtakDailyReportInput) {
    requireCapability(ctx.role, "compliance:manage");
    const property = await loadPropertyIdentity(ctx.propertyId);
    const dayStart = new Date(input.date);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const occupancy = await reportingService.occupancy(ctx, { from: dayStart, to: dayEnd });

    const payload = buildNtakDailyPayload(property, dayStart, {
      totalRooms: occupancy.totalRooms,
      bookedRoomNights: occupancy.bookedRoomNights,
      occupancyRate: occupancy.occupancyRate,
    });
    return this.dispatch(ctx, "NTAK_DAILY_REPORT", payload);
  },

  async generateNavInvoice(ctx: AuthContext, input: NavInvoiceInput) {
    requireCapability(ctx.role, "compliance:manage");
    const property = await loadPropertyIdentity(ctx.propertyId);
    const folio = await folioService.get(ctx, input.folioId); // includes line items + totals
    const guest = await guestsService.get(ctx, folio.guestId);

    const payload = buildNavInvoicePayload(
      property,
      { id: folio.id, chargesMinor: folio.chargesMinor, lineItems: folio.lineItems },
      `${guest.firstName} ${guest.lastName}`,
    );
    return this.dispatch(ctx, "NAV_INVOICE", payload, { relatedEntityType: "Folio", relatedEntityId: folio.id });
  },

  async listEvents(ctx: AuthContext) {
    requireCapability(ctx.role, "compliance:manage");
    return complianceRepository.listEvents(ctx.propertyId);
  },

  /** Send via the (stubbed) gateway, persist a ComplianceEvent, and audit. */
  async dispatch(
    ctx: AuthContext,
    type: "NTAK_DAILY_REPORT" | "NAV_INVOICE",
    payload: Record<string, unknown>,
    related?: { relatedEntityType: string; relatedEntityId: string },
  ) {
    const result = await complianceGateway.send(type, payload);
    const event = await complianceRepository.createEvent({
      propertyId: ctx.propertyId,
      type,
      payload,
      relatedEntityType: related?.relatedEntityType,
      relatedEntityId: related?.relatedEntityId,
    });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "CREATE",
      entityType: "ComplianceEvent",
      entityId: event.id,
      after: { type, status: event.status, reference: result.reference },
    });
    return { event, payload, gatewayReference: result.reference };
  },
};
