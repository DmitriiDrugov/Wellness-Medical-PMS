import { describe, it, expect } from "vitest";
import { computeTouristTax, taxablePersons, taxablePersonNights } from "@/modules/folio/tax";
import { summarizeTouristTax } from "@/modules/reporting/aggregate";

const RATE = 50_000; // 500 HUF per person-night in minor units

describe("taxablePersons (under-18 exemption)", () => {
  it("excludes children by default", () => {
    expect(taxablePersons({ adults: 2, children: 3 }, { perPersonPerNightMinor: RATE, appliesToChildren: false })).toBe(2);
  });
  it("includes children when the property opts in", () => {
    expect(taxablePersons({ adults: 2, children: 3 }, { perPersonPerNightMinor: RATE, appliesToChildren: true })).toBe(5);
  });
});

describe("computeTouristTax", () => {
  const cfg = { perPersonPerNightMinor: RATE, appliesToChildren: false };

  it("is adults × nights × rate when children are exempt", () => {
    // 2 adults × 3 nights × 500 HUF = 3000 HUF
    expect(computeTouristTax({ adults: 2, children: 1, nights: 3 }, cfg)).toBe(2 * 3 * RATE);
  });

  it("counts children when opted in", () => {
    expect(computeTouristTax({ adults: 2, children: 1, nights: 3 }, { ...cfg, appliesToChildren: true })).toBe(3 * 3 * RATE);
  });

  it("is zero when the rate is zero", () => {
    expect(computeTouristTax({ adults: 2, children: 0, nights: 3 }, { ...cfg, perPersonPerNightMinor: 0 })).toBe(0);
  });

  it("is zero for a zero-night stay", () => {
    expect(computeTouristTax({ adults: 2, children: 0, nights: 0 }, cfg)).toBe(0);
  });

  it("never goes negative on bad input", () => {
    expect(computeTouristTax({ adults: 1, children: 0, nights: -5 }, cfg)).toBe(0);
  });

  it("person-nights matches the line-item quantity", () => {
    expect(taxablePersonNights({ adults: 2, children: 4, nights: 3 }, cfg)).toBe(6);
  });
});

describe("summarizeTouristTax (return totals)", () => {
  it("sums person-nights and tax across posted line items", () => {
    const rows = [
      { quantity: 6, amountMinor: 6 * RATE },
      { quantity: 2, amountMinor: 2 * RATE },
    ];
    expect(summarizeTouristTax(rows)).toEqual({
      taxableStays: 2,
      taxablePersonNights: 8,
      totalTaxMinor: 8 * RATE,
    });
  });

  it("is empty-safe", () => {
    expect(summarizeTouristTax([])).toEqual({ taxableStays: 0, taxablePersonNights: 0, totalTaxMinor: 0 });
  });
});
