import type { ConsentType, StaffRole, TreatmentRecordStatus } from "@prisma/client";

/**
 * Pure clinical-access helpers. Kept free of DB access so the sensitive
 * authorization and consent-gate logic is unit-testable in isolation.
 */

/** Required consent types that are NOT currently granted (active = non-revoked). */
export function computeMissingConsents(
  activeConsents: ReadonlyArray<{ type: ConsentType }>,
  required: ReadonlyArray<ConsentType>,
): ConsentType[] {
  const granted = new Set(activeConsents.map((c) => c.type));
  return required.filter((t) => !granted.has(t));
}

export type ConsentStatus = "GRANTED" | "REVOKED" | "NONE";

/** Current status of a consent type from its (history-preserving) rows. */
export function currentConsentStatus(
  consentsOfType: ReadonlyArray<{ grantedAt: Date; revokedAt: Date | null }>,
): ConsentStatus {
  if (consentsOfType.length === 0) return "NONE";
  const latest = [...consentsOfType].sort((a, b) => b.grantedAt.getTime() - a.grantedAt.getTime())[0]!;
  return latest.revokedAt ? "REVOKED" : "GRANTED";
}

/**
 * Therapist clinical read scope: a therapist may access only records they authored
 * OR records for a guest they have/had an appointment with. Non-therapist roles that
 * hold the capability (manager/admin) are not narrowed here.
 */
export function canTherapistAccess(opts: {
  role: StaffRole;
  staffId: string;
  providerId?: string | null;
  hasAppointmentWithGuest: boolean;
}): boolean {
  if (opts.role !== "THERAPIST") return true;
  if (opts.providerId && opts.providerId === opts.staffId) return true;
  return opts.hasAppointmentWithGuest;
}

/** A TreatmentRecord may be edited only while it is a DRAFT (immutable once signed). */
export function isRecordEditable(status: TreatmentRecordStatus): boolean {
  return status === "DRAFT";
}

/** Consents required before any TreatmentRecord may be created (spec §Phase 6). */
export const REQUIRED_RECORD_CONSENTS: ConsentType[] = ["TREATMENT", "GDPR_DATA_PROCESSING"];
