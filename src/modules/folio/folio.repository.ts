import type { Prisma, Folio, FolioLineItem, Payment } from "@prisma/client";
import { prisma } from "@/platform/db";

/** Folio module repository — owns Folio, FolioLineItem and Payment tables. */
export const folioRepository = {
  create(data: { propertyId: string; guestId: string; reservationId?: string }): Promise<Folio> {
    return prisma.folio.create({
      data: {
        propertyId: data.propertyId,
        guestId: data.guestId,
        ...(data.reservationId ? { reservationId: data.reservationId } : {}),
      },
    });
  },

  findById(id: string) {
    return prisma.folio.findUnique({
      where: { id },
      include: { lineItems: { orderBy: { createdAt: "asc" } }, payments: { orderBy: { paidAt: "asc" } } },
    });
  },

  findByReservationId(reservationId: string): Promise<Folio | null> {
    return prisma.folio.findUnique({ where: { reservationId } });
  },

  /** Folio summaries (with line items + payments for totals) by reservation or guest. */
  listSummaries(params: { propertyId: string; reservationId?: string; guestId?: string }) {
    return prisma.folio.findMany({
      where: {
        propertyId: params.propertyId,
        ...(params.reservationId ? { reservationId: params.reservationId } : {}),
        ...(params.guestId ? { guestId: params.guestId } : {}),
      },
      orderBy: { openedAt: "desc" },
      include: { lineItems: { select: { amountMinor: true } }, payments: { select: { amountMinor: true } } },
    });
  },

  addLineItem(data: Prisma.FolioLineItemUncheckedCreateInput): Promise<FolioLineItem> {
    return prisma.folioLineItem.create({ data });
  },

  /** Remove line items of a type that originated from a given source (idempotent recompute). */
  deleteLineItemsBySource(folioId: string, type: Prisma.FolioLineItemWhereInput["type"], sourceType: string, sourceId: string) {
    return prisma.folioLineItem.deleteMany({ where: { folioId, type, sourceType, sourceId } });
  },

  /** Property tourist-tax configuration. */
  taxConfig(propertyId: string) {
    return prisma.property.findUnique({
      where: { id: propertyId },
      select: { touristTaxPerPersonPerNightMinor: true, touristTaxAppliesToChildren: true },
    });
  },

  addPayment(data: Prisma.PaymentUncheckedCreateInput): Promise<Payment> {
    return prisma.payment.create({ data });
  },

  close(id: string): Promise<Folio> {
    return prisma.folio.update({ where: { id }, data: { status: "CLOSED", closedAt: new Date() } });
  },
};
