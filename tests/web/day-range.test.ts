// tests/web/day-range.test.ts
import { describe, it, expect } from "vitest";
import { localDayRange } from "@/web/format";

describe("localDayRange", () => {
  it("returns full ISO instants bounding the local calendar day", () => {
    const day = new Date(2026, 5, 10, 0, 0, 0, 0); // local 2026-06-10 midnight
    const { from, to } = localDayRange(day);
    expect(from).toBe(new Date(2026, 5, 10, 0, 0, 0, 0).toISOString());
    expect(to).toBe(new Date(2026, 5, 11, 0, 0, 0, 0).toISOString());
  });

  it("covers an appointment created at any local hour of that day (no UTC off-by-one)", () => {
    const day = new Date(2026, 5, 10, 0, 0, 0, 0);
    const { from, to } = localDayRange(day);
    for (const hour of [0, 8, 10, 18, 23]) {
      const appt = new Date(2026, 5, 10, hour, 0, 0, 0).toISOString();
      expect(appt >= from && appt < to, `hour ${hour} should be in window`).toBe(true);
    }
  });

  it("excludes the previous day and the next day", () => {
    const day = new Date(2026, 5, 10, 0, 0, 0, 0);
    const { from, to } = localDayRange(day);
    const prevDay2359 = new Date(2026, 5, 9, 23, 59, 0, 0).toISOString();
    const nextDay0000 = new Date(2026, 5, 11, 0, 0, 0, 0).toISOString();
    expect(prevDay2359 < from).toBe(true);
    expect(nextDay0000 < to).toBe(false);
  });

  it("normalizes a non-midnight input to its local day", () => {
    const day = new Date(2026, 5, 10, 14, 30, 0, 0);
    const { from, to } = localDayRange(day);
    expect(from).toBe(new Date(2026, 5, 10, 0, 0, 0, 0).toISOString());
    expect(to).toBe(new Date(2026, 5, 11, 0, 0, 0, 0).toISOString());
  });
});
