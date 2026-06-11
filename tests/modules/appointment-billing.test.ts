import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression guard for the patient-journey billing rule: completing a treatment
 * appointment that is linked to a stay (reservationId) MUST post a treatment charge
 * to that reservation's folio. A regression that drops the postTreatmentCharge call
 * — or calls it for an unlinked appointment — surfaces here.
 *
 * Boundaries (repository, folio service, audit) are stubbed; the real appointments
 * service logic (status guard + billing wiring) runs.
 */

const linkedAppt = {
  id: "appt1",
  propertyId: "p1",
  therapistId: "th1",
  status: "SCHEDULED",
  reservationId: "resv1",
  treatment: { name: "Massage", priceMinor: 1500 },
};
const walkInAppt = { ...linkedAppt, id: "appt2", reservationId: null };

// Hoisted so the (also-hoisted) vi.mock factory can reference the same spy.
const { postTreatmentCharge } = vi.hoisted(() => ({ postTreatmentCharge: vi.fn(async () => {}) }));

vi.mock("@/platform/audit", () => ({ recordAudit: vi.fn(async () => {}) }));
vi.mock("@/platform/events", () => ({ eventBus: { emit: vi.fn() } }));
vi.mock("@/modules/folio/folio.service", () => ({ folioService: { postTreatmentCharge } }));
vi.mock("@/modules/treatments/treatments.service", () => ({ treatmentsService: {} }));
vi.mock("@/modules/resources/resources.service", () => ({ resourcesService: {} }));
vi.mock("@/modules/auth/auth.service", () => ({ authService: {} }));
vi.mock("@/modules/guests/guests.service", () => ({ guestsService: {} }));
vi.mock("@/modules/appointments/appointments.repository", () => ({
  appointmentsRepository: {
    findById: vi.fn(async (id: string) => (id === "appt2" ? walkInAppt : linkedAppt)),
    update: vi.fn(async (id: string, data: object) => ({ id, ...data })),
  },
}));

import { appointmentsService } from "@/modules/appointments/appointments.service";

const ctx = { kind: "staff" as const, staffId: "th1", role: "THERAPIST" as const, propertyId: "p1" };

describe("appointment completion → folio billing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("posts the treatment charge to the linked reservation's folio", async () => {
    await appointmentsService.complete(ctx, "appt1");
    expect(postTreatmentCharge).toHaveBeenCalledTimes(1);
    expect(postTreatmentCharge).toHaveBeenCalledWith(
      ctx,
      expect.objectContaining({
        reservationId: "resv1",
        appointmentId: "appt1",
        description: "Massage",
        priceMinor: 1500,
      }),
    );
  });

  it("does NOT post a charge for an appointment with no linked stay", async () => {
    await appointmentsService.complete(ctx, "appt2");
    expect(postTreatmentCharge).not.toHaveBeenCalled();
  });
});
