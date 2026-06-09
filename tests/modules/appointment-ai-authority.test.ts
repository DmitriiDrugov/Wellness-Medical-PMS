import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression guard for ADR 0006: the least-privilege AI_AGENT principal may create
 * treatment appointments. The booking path must NOT require `guest:read` (which the
 * AI is deliberately not granted) — it only needs a guest *existence* check.
 *
 * This exercises the REAL guests service (its capability check included) and stubs
 * only the database/peer-service boundaries, so a regression to a guest:read-gated
 * call would surface here as a ForbiddenError.
 */

const guestRow = { id: "g1", firstName: "Sam", lastName: "Lee", deletedAt: null };
const treatment = {
  id: "t1",
  name: "Massage",
  durationMinutes: 50,
  requiredResourceType: "TREATMENT_ROOM",
  priceMinor: 1000,
};
const resource = { id: "res1", type: "TREATMENT_ROOM" };
const therapist = { id: "th1", role: "THERAPIST", propertyId: "p1", isActive: true };

vi.mock("@/modules/guests/guests.repository", () => ({
  guestsRepository: { findById: vi.fn(async () => guestRow) },
}));
vi.mock("@/modules/treatments/treatments.service", () => ({
  treatmentsService: { requireActive: vi.fn(async () => treatment) },
}));
vi.mock("@/modules/resources/resources.service", () => ({
  resourcesService: { requireActive: vi.fn(async () => resource) },
}));
vi.mock("@/modules/auth/auth.service", () => ({
  authService: { getProfile: vi.fn(async () => therapist) },
}));
vi.mock("@/platform/audit", () => ({ recordAudit: vi.fn(async () => {}) }));
vi.mock("@/modules/appointments/appointments.repository", () => ({
  appointmentsRepository: {
    findTherapistConflicts: vi.fn(async () => []),
    findResourceConflicts: vi.fn(async () => []),
    create: vi.fn(async (data: unknown) => ({ id: "appt1", ...(data as object) })),
  },
}));

import { appointmentsService } from "@/modules/appointments/appointments.service";

const aiCtx = { kind: "staff" as const, staffId: "ai1", role: "AI_AGENT" as const, propertyId: "p1" };

describe("AI_AGENT appointment authority (ADR 0006)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("books a treatment appointment without requiring guest:read", async () => {
    const appt = await appointmentsService.create(aiCtx, {
      guestId: "g1",
      treatmentId: "t1",
      therapistId: "th1",
      resourceId: "res1",
      startTime: new Date("2026-07-01T10:00:00Z"),
    });
    expect(appt.id).toBe("appt1");
  });
});
