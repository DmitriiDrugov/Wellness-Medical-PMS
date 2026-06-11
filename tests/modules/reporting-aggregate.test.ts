import { describe, it, expect } from "vitest";
import { nightsInWindow, occupancyRate, groupChargesByType } from "@/modules/reporting/aggregate";

const d = (iso: string) => new Date(iso);

describe("nightsInWindow", () => {
  it("counts a stay fully inside the window", () => {
    expect(nightsInWindow(d("2026-06-02"), d("2026-06-05"), d("2026-06-01"), d("2026-06-10"))).toBe(3);
  });
  it("clips a stay that starts before the window", () => {
    expect(nightsInWindow(d("2026-05-30"), d("2026-06-03"), d("2026-06-01"), d("2026-06-10"))).toBe(2);
  });
  it("clips a stay that ends after the window", () => {
    expect(nightsInWindow(d("2026-06-08"), d("2026-06-15"), d("2026-06-01"), d("2026-06-10"))).toBe(2);
  });
  it("returns 0 for a stay outside the window", () => {
    expect(nightsInWindow(d("2026-07-01"), d("2026-07-05"), d("2026-06-01"), d("2026-06-10"))).toBe(0);
  });
});

describe("occupancyRate", () => {
  it("computes booked / capacity", () => {
    expect(occupancyRate(15, 10, 3)).toBeCloseTo(0.5);
  });
  it("is 0 when there is no capacity", () => {
    expect(occupancyRate(5, 0, 3)).toBe(0);
  });
});

describe("groupChargesByType", () => {
  it("sums amounts per type and zero-fills missing types", () => {
    const totals = groupChargesByType([
      { type: "ROOM", amountMinor: 3_500_000 },
      { type: "ROOM", amountMinor: 3_500_000 },
      { type: "TREATMENT", amountMinor: 1_400_000 },
    ]);
    expect(totals).toEqual({ ROOM: 7_000_000, PACKAGE: 0, TREATMENT: 1_400_000, TOURIST_TAX: 0, ADJUSTMENT: 0 });
  });
});
