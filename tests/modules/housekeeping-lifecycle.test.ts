import { describe, it, expect } from "vitest";
import { canTransition } from "@/modules/housekeeping/lifecycle";
import { autoPlace } from "@/modules/property/layout";

describe("housekeeping task lifecycle", () => {
  it("allows the normal flow OPEN → IN_PROGRESS → DONE", () => {
    expect(canTransition("OPEN", "IN_PROGRESS")).toBe(true);
    expect(canTransition("IN_PROGRESS", "DONE")).toBe(true);
  });

  it("allows blocking and unblocking", () => {
    expect(canTransition("IN_PROGRESS", "BLOCKED")).toBe(true);
    expect(canTransition("BLOCKED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("BLOCKED", "OPEN")).toBe(true);
  });

  it("treats DONE as terminal", () => {
    expect(canTransition("DONE", "OPEN")).toBe(false);
    expect(canTransition("DONE", "IN_PROGRESS")).toBe(false);
  });

  it("rejects a no-op transition", () => {
    expect(canTransition("OPEN", "OPEN")).toBe(false);
  });

  it("cannot block a task that is already done", () => {
    expect(canTransition("DONE", "BLOCKED")).toBe(false);
  });
});

describe("autoPlace (floor-plan fallback packing)", () => {
  const tile = (posX: number | null, posY: number | null, width = 2, height = 2) => ({ posX, posY, width, height });

  it("keeps tiles that already have coordinates", () => {
    const placed = autoPlace([tile(4, 6)], 10);
    expect(placed[0]).toMatchObject({ posX: 4, posY: 6 });
  });

  it("packs unplaced tiles left-to-right then wraps by width", () => {
    const placed = autoPlace([tile(null, null), tile(null, null), tile(null, null)], 4); // each width 2, cols 4
    expect(placed.map((p) => [p.posX, p.posY])).toEqual([
      [0, 0],
      [2, 0],
      [0, 2], // third wraps to the next row
    ]);
  });

  it("places unplaced tiles below already-placed ones", () => {
    const placed = autoPlace([tile(0, 0), tile(null, null)], 10);
    expect(placed[1]!.posY).toBeGreaterThanOrEqual(2);
  });
});
