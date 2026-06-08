import { describe, it, expect } from "vitest";
import { rangesOverlap } from "@/modules/reservations/overlap";

const d = (iso: string) => new Date(iso);

describe("rangesOverlap (half-open [start, end))", () => {
  it("detects a clear overlap", () => {
    expect(rangesOverlap(d("2026-06-01"), d("2026-06-05"), d("2026-06-03"), d("2026-06-07"))).toBe(true);
  });

  it("treats same-day checkout/checkin adjacency as NO conflict", () => {
    // A: Jun 1 -> Jun 4 (checkout), B: Jun 4 -> Jun 6 (checkin same day)
    expect(rangesOverlap(d("2026-06-01"), d("2026-06-04"), d("2026-06-04"), d("2026-06-06"))).toBe(false);
  });

  it("detects containment (one range inside another)", () => {
    expect(rangesOverlap(d("2026-06-01"), d("2026-06-10"), d("2026-06-03"), d("2026-06-05"))).toBe(true);
  });

  it("returns false for fully separate ranges", () => {
    expect(rangesOverlap(d("2026-06-01"), d("2026-06-03"), d("2026-06-10"), d("2026-06-12"))).toBe(false);
  });

  it("detects a one-day overlap at the boundary", () => {
    // A ends Jun 5, B starts Jun 4 -> they share Jun 4.
    expect(rangesOverlap(d("2026-06-01"), d("2026-06-05"), d("2026-06-04"), d("2026-06-08"))).toBe(true);
  });

  it("is symmetric", () => {
    const a1 = d("2026-06-01"), a2 = d("2026-06-05");
    const b1 = d("2026-06-03"), b2 = d("2026-06-07");
    expect(rangesOverlap(a1, a2, b1, b2)).toBe(rangesOverlap(b1, b2, a1, a2));
  });
});
