import type { Consent, ConsentType } from "@prisma/client";
import { prisma } from "@/platform/db";

/** Owns the Consent table (history-preserving; no hard deletes). */
export const consentRepository = {
  create(data: {
    propertyId: string;
    guestId: string;
    type: ConsentType;
    version: string;
    text?: string;
    docRef?: string;
  }): Promise<Consent> {
    return prisma.consent.create({ data });
  },

  findById(id: string): Promise<Consent | null> {
    return prisma.consent.findUnique({ where: { id } });
  },

  findByGuest(guestId: string): Promise<Consent[]> {
    return prisma.consent.findMany({ where: { guestId }, orderBy: { grantedAt: "desc" } });
  },

  /** Currently-active (non-revoked) consents for a guest. */
  findActiveByGuest(guestId: string): Promise<Consent[]> {
    return prisma.consent.findMany({ where: { guestId, revokedAt: null } });
  },

  revoke(id: string): Promise<Consent> {
    return prisma.consent.update({ where: { id }, data: { revokedAt: new Date() } });
  },
};
