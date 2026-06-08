import { describe, it, expect } from "vitest";
import {
  computeMissingConsents,
  currentConsentStatus,
  canTherapistAccess,
  isRecordEditable,
  REQUIRED_RECORD_CONSENTS,
} from "@/modules/clinical/access";

describe("computeMissingConsents", () => {
  it("returns nothing when all required consents are active", () => {
    const active = [{ type: "TREATMENT" as const }, { type: "GDPR_DATA_PROCESSING" as const }];
    expect(computeMissingConsents(active, REQUIRED_RECORD_CONSENTS)).toEqual([]);
  });
  it("lists the missing required consents", () => {
    const active = [{ type: "TREATMENT" as const }];
    expect(computeMissingConsents(active, REQUIRED_RECORD_CONSENTS)).toEqual(["GDPR_DATA_PROCESSING"]);
  });
  it("reports all missing when none are active", () => {
    expect(computeMissingConsents([], REQUIRED_RECORD_CONSENTS)).toEqual(["TREATMENT", "GDPR_DATA_PROCESSING"]);
  });
});

describe("currentConsentStatus", () => {
  it("is NONE with no rows", () => {
    expect(currentConsentStatus([])).toBe("NONE");
  });
  it("is GRANTED when the latest row is not revoked", () => {
    expect(
      currentConsentStatus([
        { grantedAt: new Date("2026-01-01"), revokedAt: new Date("2026-02-01") },
        { grantedAt: new Date("2026-03-01"), revokedAt: null },
      ]),
    ).toBe("GRANTED");
  });
  it("is REVOKED when the latest row is revoked", () => {
    expect(
      currentConsentStatus([
        { grantedAt: new Date("2026-03-01"), revokedAt: new Date("2026-04-01") },
        { grantedAt: new Date("2026-01-01"), revokedAt: null },
      ]),
    ).toBe("REVOKED");
  });
});

describe("canTherapistAccess", () => {
  const base = { role: "THERAPIST" as const, staffId: "t1" };
  it("allows the authoring therapist", () => {
    expect(canTherapistAccess({ ...base, providerId: "t1", hasAppointmentWithGuest: false })).toBe(true);
  });
  it("allows a therapist with an appointment for the guest", () => {
    expect(canTherapistAccess({ ...base, providerId: "t2", hasAppointmentWithGuest: true })).toBe(true);
  });
  it("denies a therapist who is neither author nor on the care team", () => {
    expect(canTherapistAccess({ ...base, providerId: "t2", hasAppointmentWithGuest: false })).toBe(false);
  });
  it("does not narrow non-therapist roles", () => {
    expect(canTherapistAccess({ role: "MANAGER", staffId: "m1", providerId: "t2", hasAppointmentWithGuest: false })).toBe(true);
  });
});

describe("isRecordEditable", () => {
  it("allows editing a draft", () => {
    expect(isRecordEditable("DRAFT")).toBe(true);
  });
  it("blocks editing a signed record", () => {
    expect(isRecordEditable("SIGNED")).toBe(false);
  });
});
