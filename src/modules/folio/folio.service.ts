import type { Folio } from "@prisma/client";
import type { AuthContext } from "@/platform/auth/context";
import { requireCapability } from "@/platform/rbac";
import { recordAudit } from "@/platform/audit";
import { eventBus } from "@/platform/events";
import { ConflictError, NotFoundError } from "@/platform/errors";
import { packagesService } from "@/modules/packages/packages.service";
import { folioRepository } from "@/modules/folio/folio.repository";
import { sumAmounts } from "@/modules/folio/money";
import { computeTouristTax, taxablePersonNights } from "@/modules/folio/tax";
import type { AddChargeInput, ChargePackageInput, AddPaymentInput, ListFoliosQuery } from "@/modules/folio/folio.schema";

/** Actor identity passed to internal posting methods (no capability check there). */
type Actor = Pick<AuthContext, "staffId" | "propertyId">;

async function loadFolioOrThrow(id: string, propertyId: string) {
  const folio = await folioRepository.findById(id);
  if (!folio || folio.propertyId !== propertyId) throw new NotFoundError("Folio not found");
  return folio;
}

function withTotals<T extends { lineItems: { amountMinor: number }[]; payments: { amountMinor: number }[] }>(folio: T) {
  const chargesMinor = sumAmounts(folio.lineItems);
  const paymentsMinor = sumAmounts(folio.payments);
  return { ...folio, chargesMinor, paymentsMinor, balanceMinor: chargesMinor - paymentsMinor };
}

export const folioService = {
  async get(ctx: AuthContext, id: string) {
    requireCapability(ctx.role, "folio:read");
    return withTotals(await loadFolioOrThrow(id, ctx.propertyId));
  },

  /** Resolve folio summaries (id + totals) by reservation or guest, so the UI can
   *  navigate to a folio without already knowing its id. */
  async list(ctx: AuthContext, query: ListFoliosQuery) {
    requireCapability(ctx.role, "folio:read");
    const folios = await folioRepository.listSummaries({
      propertyId: ctx.propertyId,
      reservationId: query.reservationId,
      guestId: query.guestId,
    });
    return folios.map(({ lineItems, payments, ...rest }) => {
      const chargesMinor = sumAmounts(lineItems);
      const paymentsMinor = sumAmounts(payments);
      return { ...rest, chargesMinor, paymentsMinor, balanceMinor: chargesMinor - paymentsMinor };
    });
  },

  async addCharge(ctx: AuthContext, id: string, input: AddChargeInput) {
    requireCapability(ctx.role, "folio:write");
    const folio = await loadFolioOrThrow(id, ctx.propertyId);
    if (folio.status !== "OPEN") throw new ConflictError("Cannot charge a closed folio");
    const amountMinor = input.quantity * input.unitPriceMinor;
    const item = await folioRepository.addLineItem({
      folioId: id,
      type: "ADJUSTMENT",
      description: input.description,
      quantity: input.quantity,
      unitPriceMinor: input.unitPriceMinor,
      amountMinor,
      createdByStaffId: ctx.staffId,
    });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "CREATE",
      entityType: "FolioLineItem",
      entityId: item.id,
      after: item,
      metadata: { folioId: id },
    });
    eventBus.emit({ type: "folio.charged", entity: "folio", entityId: id, propertyId: ctx.propertyId });
    return this.get(ctx, id);
  },

  async chargePackage(ctx: AuthContext, id: string, input: ChargePackageInput) {
    requireCapability(ctx.role, "folio:write");
    const folio = await loadFolioOrThrow(id, ctx.propertyId);
    if (folio.status !== "OPEN") throw new ConflictError("Cannot charge a closed folio");
    const pkg = await packagesService.get(ctx, input.packageId); // cross-module validation
    const item = await folioRepository.addLineItem({
      folioId: id,
      type: "PACKAGE",
      description: pkg.name,
      quantity: 1,
      unitPriceMinor: pkg.priceMinor,
      amountMinor: pkg.priceMinor,
      sourceType: "ServicePackage",
      sourceId: pkg.id,
      createdByStaffId: ctx.staffId,
    });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "CREATE",
      entityType: "FolioLineItem",
      entityId: item.id,
      after: item,
      metadata: { folioId: id, packageId: pkg.id },
    });
    eventBus.emit({ type: "folio.charged", entity: "folio", entityId: id, propertyId: ctx.propertyId });
    return this.get(ctx, id);
  },

  async addPayment(ctx: AuthContext, id: string, input: AddPaymentInput) {
    requireCapability(ctx.role, "folio:write");
    const folio = await loadFolioOrThrow(id, ctx.propertyId);
    if (folio.status !== "OPEN") throw new ConflictError("Cannot record a payment on a closed folio");
    const payment = await folioRepository.addPayment({
      folioId: id,
      amountMinor: input.amountMinor,
      method: input.method,
      reference: input.reference,
      recordedByStaffId: ctx.staffId,
    });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "CREATE",
      entityType: "Payment",
      entityId: payment.id,
      after: payment,
      metadata: { folioId: id },
    });
    eventBus.emit({ type: "folio.payment", entity: "folio", entityId: id, propertyId: ctx.propertyId });
    return this.get(ctx, id);
  },

  async close(ctx: AuthContext, id: string) {
    requireCapability(ctx.role, "folio:close");
    const dto = await this.get(ctx, id);
    if (dto.status === "CLOSED") throw new ConflictError("Folio is already closed");
    if (dto.balanceMinor !== 0) {
      throw new ConflictError("Cannot close a folio with an outstanding balance", {
        balanceMinor: dto.balanceMinor,
      });
    }
    await folioRepository.close(id);
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "STATE_CHANGE",
      entityType: "Folio",
      entityId: id,
      before: { status: "OPEN" },
      after: { status: "CLOSED" },
    });
    eventBus.emit({ type: "folio.closed", entity: "folio", entityId: id, propertyId: ctx.propertyId });
    return this.get(ctx, id);
  },

  // ---- Internal cross-module posting (no RBAC; caller already authorized) ----

  /** The folio linked to a reservation, if any (used by check-out preconditions). */
  async findForReservation(reservationId: string): Promise<Folio | null> {
    return folioRepository.findByReservationId(reservationId);
  },

  /** Find the folio for a reservation, creating an open one if none exists. */
  async ensureForReservation(input: { propertyId: string; reservationId: string; guestId: string }): Promise<Folio> {
    const existing = await folioRepository.findByReservationId(input.reservationId);
    return existing ?? folioRepository.create(input);
  },

  /** Called by reservations on check-out: post room-night charges to the folio. */
  async postRoomCharges(
    actor: Actor,
    input: { reservationId: string; guestId: string; nights: number; ratePerNightMinor: number; description: string },
  ): Promise<void> {
    const amountMinor = input.nights * input.ratePerNightMinor;
    if (amountMinor <= 0) return;
    const folio = await this.ensureForReservation({
      propertyId: actor.propertyId,
      reservationId: input.reservationId,
      guestId: input.guestId,
    });
    if (folio.status !== "OPEN") return;
    const item = await folioRepository.addLineItem({
      folioId: folio.id,
      type: "ROOM",
      description: input.description,
      quantity: input.nights,
      unitPriceMinor: input.ratePerNightMinor,
      amountMinor,
      sourceType: "Reservation",
      sourceId: input.reservationId,
      createdByStaffId: actor.staffId,
    });
    await recordAudit({
      actorStaffId: actor.staffId,
      propertyId: actor.propertyId,
      action: "CREATE",
      entityType: "FolioLineItem",
      entityId: item.id,
      after: item,
      metadata: { folioId: folio.id, auto: "room-charge" },
    });
  },

  /** Called by appointments on completion: post a treatment charge to the linked folio. */
  async postTreatmentCharge(
    actor: Actor,
    input: { reservationId: string; appointmentId: string; description: string; priceMinor: number },
  ): Promise<void> {
    const folio = await folioRepository.findByReservationId(input.reservationId);
    if (!folio || folio.status !== "OPEN") return;
    const item = await folioRepository.addLineItem({
      folioId: folio.id,
      type: "TREATMENT",
      description: input.description,
      quantity: 1,
      unitPriceMinor: input.priceMinor,
      amountMinor: input.priceMinor,
      sourceType: "TreatmentAppointment",
      sourceId: input.appointmentId,
      createdByStaffId: actor.staffId,
    });
    await recordAudit({
      actorStaffId: actor.staffId,
      propertyId: actor.propertyId,
      action: "CREATE",
      entityType: "FolioLineItem",
      entityId: item.id,
      after: item,
      metadata: { folioId: folio.id, auto: "treatment-charge" },
    });
    eventBus.emit({ type: "folio.treatment-charged", entity: "folio", entityId: folio.id, propertyId: actor.propertyId });
  },

  /**
   * Recompute and post the stay's tourist tax as a single idempotent TOURIST_TAX
   * line item. Safe to call repeatedly (e.g. on check-out, or after the stay's
   * dates/occupancy change): the prior tax line for the reservation is removed first.
   */
  async postTouristTax(
    actor: Actor,
    input: { reservationId: string; guestId: string; adults: number; children: number; nights: number },
  ): Promise<void> {
    const cfg = await folioRepository.taxConfig(actor.propertyId);
    if (!cfg) return;
    const config = {
      perPersonPerNightMinor: cfg.touristTaxPerPersonPerNightMinor,
      appliesToChildren: cfg.touristTaxAppliesToChildren,
    };
    const stay = { adults: input.adults, children: input.children, nights: input.nights };
    const amountMinor = computeTouristTax(stay, config);

    const folio = await this.ensureForReservation({
      propertyId: actor.propertyId,
      reservationId: input.reservationId,
      guestId: input.guestId,
    });
    if (folio.status !== "OPEN") return;

    // Idempotent recompute: drop any prior tax line for this reservation.
    await folioRepository.deleteLineItemsBySource(folio.id, "TOURIST_TAX", "Reservation", input.reservationId);
    if (amountMinor <= 0) return;

    const personNights = taxablePersonNights(stay, config);
    const item = await folioRepository.addLineItem({
      folioId: folio.id,
      type: "TOURIST_TAX",
      description: `Tourist tax — ${personNights} person-night(s)`,
      quantity: personNights,
      unitPriceMinor: config.perPersonPerNightMinor,
      amountMinor,
      sourceType: "Reservation",
      sourceId: input.reservationId,
      createdByStaffId: actor.staffId,
    });
    await recordAudit({
      actorStaffId: actor.staffId,
      propertyId: actor.propertyId,
      action: "CREATE",
      entityType: "FolioLineItem",
      entityId: item.id,
      after: item,
      metadata: { folioId: folio.id, auto: "tourist-tax" },
    });
    eventBus.emit({ type: "folio.tax-posted", entity: "folio", entityId: folio.id, propertyId: actor.propertyId });
  },
};
