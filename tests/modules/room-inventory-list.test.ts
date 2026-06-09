import { describe, it, expect, vi, beforeEach } from "vitest";

const roomTypes = [{ id: "rt1", name: "Deluxe", basePriceMinor: 5000000, propertyId: "p1" }];
const rooms = [{ id: "r1", number: "101", roomTypeId: "rt1", status: "AVAILABLE", propertyId: "p1" }];

vi.mock("@/modules/reservations/reservations.repository", () => ({
  reservationsRepository: {
    listRoomTypes: vi.fn(async () => roomTypes),
    roomsByType: vi.fn(async () => rooms),
  },
}));

import { reservationsService } from "@/modules/reservations/reservations.service";

const ctx = { kind: "staff" as const, staffId: "s1", role: "RECEPTION" as const, propertyId: "p1" };

describe("reservations inventory listings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists room types for a capable role", async () => {
    const out = await reservationsService.listRoomTypes(ctx);
    expect(out).toEqual(roomTypes);
  });

  it("lists rooms for a capable role", async () => {
    const out = await reservationsService.listRooms(ctx);
    expect(out).toEqual(rooms);
  });

  it("rejects a role lacking reservation:read", async () => {
    const hk = { ...ctx, role: "HOUSEKEEPING" as const };
    await expect(reservationsService.listRoomTypes(hk)).rejects.toThrow();
  });
});
