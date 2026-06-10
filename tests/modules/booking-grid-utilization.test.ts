import { describe, it, expect } from "vitest";
import { computeUtilization, overlapNights } from "@/modules/reservations/grid";

const d = (iso: string) => new Date(iso);
const from = d("2026-06-01");
const to = d("2026-06-08"); // 7-night window

describe("overlapNights (clip stay to window)", () => {
  it("counts full nights inside the window", () => {
    expect(overlapNights({ checkInDate: d("2026-06-02"), checkOutDate: d("2026-06-05") }, from, to)).toBe(3);
  });

  it("clips a stay that starts before the window", () => {
    expect(overlapNights({ checkInDate: d("2026-05-30"), checkOutDate: d("2026-06-03") }, from, to)).toBe(2);
  });

  it("clips a stay that ends after the window", () => {
    expect(overlapNights({ checkInDate: d("2026-06-06"), checkOutDate: d("2026-06-12") }, from, to)).toBe(2);
  });

  it("returns 0 for a stay entirely outside the window", () => {
    expect(overlapNights({ checkInDate: d("2026-06-10"), checkOutDate: d("2026-06-12") }, from, to)).toBe(0);
  });
});

describe("computeUtilization", () => {
  it("is 0% with no inventory", () => {
    expect(computeUtilization([], 0, from, to)).toEqual({
      occupiedRoomNights: 0,
      availableRoomNights: 0,
      ratePct: 0,
    });
  });

  it("ignores unassigned (roomId null) stays", () => {
    const u = computeUtilization(
      [{ roomId: null, checkInDate: d("2026-06-01"), checkOutDate: d("2026-06-08") }],
      2,
      from,
      to,
    );
    expect(u.occupiedRoomNights).toBe(0);
    expect(u.ratePct).toBe(0);
  });

  it("computes occupancy from assigned, clipped stays", () => {
    // 2 rooms × 7 nights = 14 available. One stay occupies 7 nights => 50%.
    const u = computeUtilization(
      [{ roomId: "r1", checkInDate: d("2026-06-01"), checkOutDate: d("2026-06-08") }],
      2,
      from,
      to,
    );
    expect(u.availableRoomNights).toBe(14);
    expect(u.occupiedRoomNights).toBe(7);
    expect(u.ratePct).toBe(50);
  });

  it("rounds to a whole percent", () => {
    // 1 room × 7 nights = 7 available; 2 occupied => 28.57% -> 29%.
    const u = computeUtilization(
      [{ roomId: "r1", checkInDate: d("2026-06-01"), checkOutDate: d("2026-06-03") }],
      1,
      from,
      to,
    );
    expect(u.ratePct).toBe(29);
  });
});
