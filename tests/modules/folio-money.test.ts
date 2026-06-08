import { describe, it, expect } from "vitest";
import { sumAmounts, computeBalance, nightsBetween } from "@/modules/folio/money";

describe("sumAmounts", () => {
  it("sums minor-unit amounts exactly", () => {
    expect(sumAmounts([{ amountMinor: 3_500_000 }, { amountMinor: 1_400_000 }])).toBe(4_900_000);
  });
  it("returns 0 for an empty list", () => {
    expect(sumAmounts([])).toBe(0);
  });
});

describe("computeBalance", () => {
  it("computes charges minus payments", () => {
    const items = [{ amountMinor: 3_500_000 }, { amountMinor: 1_400_000 }];
    const payments = [{ amountMinor: 2_000_000 }];
    expect(computeBalance(items, payments)).toBe(2_900_000);
  });

  it("is zero when fully paid", () => {
    expect(computeBalance([{ amountMinor: 5000 }], [{ amountMinor: 5000 }])).toBe(0);
  });

  it("goes negative on overpayment (credit owed to guest)", () => {
    expect(computeBalance([{ amountMinor: 5000 }], [{ amountMinor: 7000 }])).toBe(-2000);
  });
});

describe("nightsBetween", () => {
  it("counts whole nights", () => {
    expect(nightsBetween(new Date("2026-06-01"), new Date("2026-06-04"))).toBe(3);
  });
  it("is 0 for same-day", () => {
    expect(nightsBetween(new Date("2026-06-01"), new Date("2026-06-01"))).toBe(0);
  });
});
