import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression guard for the appointment → stay linkage rule: an appointment may only
 * be linked to a reservation after requireActiveStay validates that the stay exists,
 * is in this property, belongs to the SAME guest, and is still active. Completion
 * bills the treatment to the linked folio, so skipping this check would let a charge
 * land on another guest's bill.
 */

const treatment = {
  id: "t1",
  name: "Massage",
  durationMinutes: 50,
  requiredResourceType: "TREATMENT_ROOM",
  priceMinor: 1000,
};

const { requireActiveStay, create } = vi.hoisted(() => ({
  requireActiveStay: vi.fn(async () => ({ id: "resv1" })),
  create: vi.fn(async (data: unknown) => ({ id: "appt1", ...(data as object) })),
}));

vi.mock("@/platform/audit", () => ({ recordAudit: vi.fn(async () => {}) }));
vi.mock("@/platform/events", () => ({ eventBus: { emit: vi.fn() } }));
vi.mock("@/modules/folio/folio.service", () => ({ folioService: {} }));
vi.mock("@/modules/guests/guests.service", () => ({
  guestsService: { requireExists: vi.fn(async () => ({ id: "g1" })) },
}));
vi.mock("@/modules/treatments/treatments.service", () => ({
  treatmentsService: { requireActive: vi.fn(async () => treatment) },
}));
vi.mock("@/modules/resources/resources.service", () => ({
  resourcesService: { requireActive: vi.fn(async () => ({ id: "res1", type: "TREATMENT_ROOM" })) },
}));
vi.mock("@/modules/auth/auth.service", () => ({
  authService: { getProfile: vi.fn(async () => ({ id: "th1", role: "THERAPIST", propertyId: "p1", isActive: true })) },
}));
vi.mock("@/modules/reservations/reservations.service", () => ({
  reservationsService: { requireActiveStay },
}));
vi.mock("@/modules/appointments/appointments.repository", () => ({
  appointmentsRepository: {
    findTherapistConflicts: vi.fn(async () => []),
    findResourceConflicts: vi.fn(async () => []),
    create,
  },
}));

import { appointmentsService } from "@/modules/appointments/appointments.service";
import { ValidationError } from "@/platform/errors";

const ctx = { kind: "staff" as const, staffId: "s1", role: "RECEPTION" as const, propertyId: "p1" };

const input = {
  guestId: "g1",
  treatmentId: "t1",
  therapistId: "th1",
  resourceId: "res1",
  startTime: new Date("2026-07-01T10:00:00Z"),
};

beforeEach(() => vi.clearAllMocks());

describe("appointment ↔ reservation linkage", () => {
  it("validates a linked stay against property + guest before booking", async () => {
    await appointmentsService.create(ctx, { ...input, reservationId: "resv1" });
    expect(requireActiveStay).toHaveBeenCalledWith("p1", "resv1", "g1");
    expect(create).toHaveBeenCalledOnce();
  });

  it("does not call the stay check for a walk-in appointment", async () => {
    await appointmentsService.create(ctx, input);
    expect(requireActiveStay).not.toHaveBeenCalled();
  });

  it("refuses to book when the stay belongs to a different guest", async () => {
    requireActiveStay.mockRejectedValueOnce(new ValidationError("Reservation belongs to a different guest"));
    await expect(
      appointmentsService.create(ctx, { ...input, reservationId: "resv-other" }),
    ).rejects.toMatchObject({ status: 422 });
    expect(create).not.toHaveBeenCalled();
  });
});
