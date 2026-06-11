import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression guards for the reservation lifecycle business rules:
 *  - check-out refuses to proceed against a CLOSED folio (charges would silently no-op);
 *  - check-out flags the vacated room DIRTY and opens a checkout-cleaning work order;
 *  - check-in refuses an OUT_OF_ORDER room;
 *  - a finished reservation (CHECKED_OUT / CANCELLED / NO_SHOW) is immutable;
 *  - no-show is only reachable from PENDING / CONFIRMED;
 *  - requireActiveStay rejects cross-guest / cross-property / finished stays.
 *
 * Boundaries (repositories, folio, guests, housekeeping, audit, events) are stubbed;
 * the real reservations service logic runs.
 */

const baseReservation = {
  id: "r1",
  propertyId: "p1",
  guestId: "g1",
  roomTypeId: "rt1",
  roomId: "room1",
  room: { id: "room1", number: "101" },
  roomType: { id: "rt1", name: "Suite" },
  guest: { id: "g1", firstName: "Sam", lastName: "Lee" },
  checkInDate: new Date("2026-06-01"),
  checkOutDate: new Date("2026-06-04"),
  status: "CHECKED_IN",
  adults: 2,
  children: 1,
  ratePerNightMinor: 10_000,
};

const { repo, folio, housekeeping } = vi.hoisted(() => ({
  repo: {
    findById: vi.fn(),
    update: vi.fn(async (id: string, data: object) => ({ ...baseReservation, id, ...data })),
    updateRoom: vi.fn(async () => ({})),
    roomById: vi.fn(
      async (): Promise<{ id: string; propertyId: string; roomTypeId?: string; housekeepingStatus: string }> => ({
        id: "room1", propertyId: "p1", roomTypeId: "rt1", housekeepingStatus: "CLEAN",
      }),
    ),
    roomTypeById: vi.fn(async () => ({ id: "rt1", propertyId: "p1", basePriceMinor: 10_000 })),
    findConflicting: vi.fn(async () => []),
  },
  folio: {
    findForReservation: vi.fn(async (): Promise<{ id: string; status: string } | null> => null),
    postRoomCharges: vi.fn(async () => {}),
    postTouristTax: vi.fn(async () => {}),
  },
  housekeeping: {
    openCheckoutCleaning: vi.fn(async () => ({ id: "task1" })),
  },
}));

vi.mock("@/platform/audit", () => ({ recordAudit: vi.fn(async () => {}) }));
vi.mock("@/platform/events", () => ({ eventBus: { emit: vi.fn() } }));
vi.mock("@/modules/folio/folio.service", () => ({ folioService: folio }));
vi.mock("@/modules/guests/guests.service", () => ({
  guestsService: { requireExists: vi.fn(async () => ({ id: "g1" })) },
}));
vi.mock("@/modules/housekeeping/housekeeping.service", () => ({ housekeepingService: housekeeping }));
vi.mock("@/modules/reservations/reservations.repository", () => ({ reservationsRepository: repo }));

import { reservationsService } from "@/modules/reservations/reservations.service";

const ctx = { kind: "staff" as const, staffId: "s1", role: "RECEPTION" as const, propertyId: "p1" };

beforeEach(() => {
  vi.clearAllMocks();
  repo.findById.mockResolvedValue({ ...baseReservation });
});

describe("check-out", () => {
  it("posts charges, marks the room dirty and opens a checkout cleaning task", async () => {
    await reservationsService.checkOut(ctx, "r1");
    expect(folio.postRoomCharges).toHaveBeenCalledOnce();
    expect(folio.postTouristTax).toHaveBeenCalledOnce();
    expect(repo.updateRoom).toHaveBeenCalledWith("room1", { housekeepingStatus: "DIRTY" });
    expect(housekeeping.openCheckoutCleaning).toHaveBeenCalledWith(ctx, { id: "room1", number: "101" });
  });

  it("refuses to check out when the reservation's folio is already closed", async () => {
    folio.findForReservation.mockResolvedValueOnce({ id: "f1", status: "CLOSED" });
    await expect(reservationsService.checkOut(ctx, "r1")).rejects.toMatchObject({ status: 409 });
    expect(folio.postRoomCharges).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });
});

describe("check-in", () => {
  it("refuses an OUT_OF_ORDER room", async () => {
    repo.findById.mockResolvedValue({ ...baseReservation, status: "CONFIRMED" });
    repo.roomById.mockResolvedValueOnce({ id: "room1", propertyId: "p1", housekeepingStatus: "OUT_OF_ORDER" });
    await expect(reservationsService.checkIn(ctx, "r1")).rejects.toMatchObject({ status: 409 });
  });
});

describe("terminal-status immutability", () => {
  it.each(["CHECKED_OUT", "CANCELLED", "NO_SHOW"])("rejects updating a %s reservation", async (status) => {
    repo.findById.mockResolvedValue({ ...baseReservation, status });
    await expect(reservationsService.update(ctx, "r1", { adults: 3 })).rejects.toMatchObject({ status: 409 });
  });

  it("rejects assigning a room to a checked-out reservation", async () => {
    repo.findById.mockResolvedValue({ ...baseReservation, status: "CHECKED_OUT" });
    await expect(reservationsService.assignRoom(ctx, "r1", "room2")).rejects.toMatchObject({ status: 409 });
  });
});

describe("no-show", () => {
  it("marks a CONFIRMED reservation as NO_SHOW", async () => {
    repo.findById.mockResolvedValue({ ...baseReservation, status: "CONFIRMED" });
    const after = await reservationsService.noShow(ctx, "r1");
    expect(after.status).toBe("NO_SHOW");
  });

  it("rejects a no-show for a checked-in guest", async () => {
    await expect(reservationsService.noShow(ctx, "r1")).rejects.toMatchObject({ status: 409 });
  });
});

describe("property scoping", () => {
  it("hides another property's reservation (404, not data leak)", async () => {
    repo.findById.mockResolvedValue({ ...baseReservation, propertyId: "p2" });
    await expect(reservationsService.get(ctx, "r1")).rejects.toMatchObject({ status: 404 });
  });
});

describe("requireActiveStay (appointment → stay linkage)", () => {
  it("accepts the guest's own active stay", async () => {
    await expect(reservationsService.requireActiveStay("p1", "r1", "g1")).resolves.toMatchObject({ id: "r1" });
  });

  it("rejects a stay that belongs to a different guest", async () => {
    await expect(reservationsService.requireActiveStay("p1", "r1", "g-other")).rejects.toMatchObject({ status: 422 });
  });

  it("rejects a stay in another property", async () => {
    await expect(reservationsService.requireActiveStay("p2", "r1", "g1")).rejects.toMatchObject({ status: 404 });
  });

  it("rejects a finished stay", async () => {
    repo.findById.mockResolvedValue({ ...baseReservation, status: "CHECKED_OUT" });
    await expect(reservationsService.requireActiveStay("p1", "r1", "g1")).rejects.toMatchObject({ status: 409 });
  });
});
