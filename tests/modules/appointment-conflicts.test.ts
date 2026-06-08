import { describe, it, expect } from "vitest";
import { overlapsAny, resourceMatchesTreatment, computeEndTime } from "@/modules/appointments/conflicts";

const t = (h: number, m = 0) => new Date(2026, 5, 8, h, m);

describe("overlapsAny", () => {
  const busy = [
    { startTime: t(10, 0), endTime: t(10, 50) },
    { startTime: t(13, 0), endTime: t(14, 0) },
  ];

  it("detects an overlap with an existing slot", () => {
    expect(overlapsAny(t(10, 30), t(11, 20), busy)).toBe(true);
  });

  it("allows a back-to-back slot (adjacency is not a conflict)", () => {
    expect(overlapsAny(t(10, 50), t(11, 40), busy)).toBe(false);
  });

  it("allows a slot in a free gap", () => {
    expect(overlapsAny(t(11, 0), t(12, 0), busy)).toBe(false);
  });

  it("returns false against an empty busy list", () => {
    expect(overlapsAny(t(9, 0), t(9, 50), [])).toBe(false);
  });
});

describe("resourceMatchesTreatment", () => {
  it("matches identical types", () => {
    expect(resourceMatchesTreatment("TREATMENT_ROOM", "TREATMENT_ROOM")).toBe(true);
  });
  it("rejects mismatched types", () => {
    expect(resourceMatchesTreatment("EQUIPMENT", "TREATMENT_ROOM")).toBe(false);
  });
});

describe("computeEndTime", () => {
  it("adds duration in minutes", () => {
    expect(computeEndTime(t(10, 0), 50).getTime()).toBe(t(10, 50).getTime());
  });
});
