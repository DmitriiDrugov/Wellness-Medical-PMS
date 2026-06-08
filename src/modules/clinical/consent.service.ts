import type { Consent, ConsentType } from "@prisma/client";
import type { AuthContext } from "@/platform/auth/context";
import { requireCapability } from "@/platform/rbac";
import { recordAudit } from "@/platform/audit";
import { NotFoundError } from "@/platform/errors";
import { consentRepository } from "@/modules/clinical/consent.repository";
import { currentConsentStatus, computeMissingConsents } from "@/modules/clinical/access";
import { assertGuestClinicalScope, auditClinicalRead } from "@/modules/clinical/guards";
import type { GrantConsentInput } from "@/modules/clinical/clinical.schema";

const ALL_CONSENT_TYPES: ConsentType[] = ["TREATMENT", "GDPR_DATA_PROCESSING", "PHOTO", "MARKETING"];

export const consentService = {
  async grant(ctx: AuthContext, guestId: string, input: GrantConsentInput): Promise<Consent> {
    requireCapability(ctx.role, "consent:write");
    const consent = await consentRepository.create({
      propertyId: ctx.propertyId,
      guestId,
      type: input.type,
      version: input.version,
      text: input.text,
      docRef: input.docRef,
    });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "CREATE",
      entityType: "Consent",
      entityId: consent.id,
      after: { type: consent.type, version: consent.version, guestId },
    });
    return consent;
  },

  async revoke(ctx: AuthContext, id: string): Promise<Consent> {
    requireCapability(ctx.role, "consent:write");
    const before = await consentRepository.findById(id);
    if (!before || before.propertyId !== ctx.propertyId) throw new NotFoundError("Consent not found");
    if (before.revokedAt) return before; // idempotent
    const after = await consentRepository.revoke(id);
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "STATE_CHANGE",
      entityType: "Consent",
      entityId: id,
      before: { revokedAt: null },
      after: { revokedAt: after.revokedAt },
    });
    return after;
  },

  /** Full consent records — clinical content, therapist-scoped, audit-logged. */
  async listFull(ctx: AuthContext, guestId: string): Promise<Consent[]> {
    requireCapability(ctx.role, "consent:read");
    await assertGuestClinicalScope(ctx, guestId);
    const consents = await consentRepository.findByGuest(guestId);
    await auditClinicalRead(ctx, "Consent", guestId, { scope: "full" });
    return consents;
  },

  /** Consent STATUS only (granted/revoked/none per type) — reception may use this. */
  async status(ctx: AuthContext, guestId: string) {
    requireCapability(ctx.role, "consent:status:read");
    const consents = await consentRepository.findByGuest(guestId);
    const statuses = ALL_CONSENT_TYPES.map((type) => ({
      type,
      status: currentConsentStatus(consents.filter((c) => c.type === type)),
    }));
    await auditClinicalRead(ctx, "Consent", guestId, { scope: "status" });
    return statuses;
  },

  /** Internal (no RBAC): required consent types not currently granted for a guest. */
  async getMissingRequiredConsents(guestId: string, required: ConsentType[]): Promise<ConsentType[]> {
    const active = await consentRepository.findActiveByGuest(guestId);
    return computeMissingConsents(active, required);
  },
};
