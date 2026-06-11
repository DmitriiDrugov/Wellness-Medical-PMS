import type { GuestAuthContext } from "@/platform/auth/context";
import { folioRepository } from "@/modules/folio/folio.repository";
import { appointmentsRepository } from "@/modules/appointments/appointments.repository";
import { guestsRepository } from "@/modules/guests/guests.repository";
import { sumAmounts } from "@/modules/folio/money";

/**
 * Read-only API for the (future) guest/patient client app. Every method is scoped
 * to the authenticated guest by `ctx.guestId` and returns a deliberately whitelisted
 * shape — no staff ids, internal notes, or clinical fields leak to the client.
 *
 * Authorization is by ownership (the guest token), not the staff RBAC matrix.
 */
export const guestPortalService = {
  /** The guest's live bill(s): line items, payments and computed balance. */
  async folios(ctx: GuestAuthContext) {
    const folios = await folioRepository.listForGuestPortal(ctx.propertyId, ctx.guestId);
    return folios.map((f) => {
      const chargesMinor = sumAmounts(f.lineItems);
      const paymentsMinor = sumAmounts(f.payments);
      return {
        id: f.id,
        status: f.status,
        openedAt: f.openedAt,
        closedAt: f.closedAt,
        currency: "HUF",
        lineItems: f.lineItems,
        payments: f.payments,
        chargesMinor,
        paymentsMinor,
        balanceMinor: chargesMinor - paymentsMinor,
      };
    });
  },

  /** The guest's treatment schedule (upcoming + past), whitelisted. */
  async appointments(ctx: GuestAuthContext) {
    const { items } = await appointmentsRepository.list({
      propertyId: ctx.propertyId,
      guestId: ctx.guestId,
      skip: 0,
      take: 100,
    });
    return items.map((a) => ({
      id: a.id,
      treatment: a.treatment.name,
      startTime: a.startTime,
      endTime: a.endTime,
      status: a.status,
      therapist: `${a.therapist.firstName} ${a.therapist.lastName}`.trim(),
      room: a.resource.name,
    }));
  },

  /** The guest's own document references (metadata only — no storage keys). */
  async documents(ctx: GuestAuthContext) {
    const docs = await guestsRepository.listDocuments(ctx.guestId);
    return docs.map((d) => ({ id: d.id, kind: d.kind, label: d.label, createdAt: d.createdAt }));
  },
};
