import { describe, it, expect } from "vitest";
import { startOfWeek, weekDays, dayIndex, bucketByDay } from "@/web/schedule-week";

describe("startOfWeek", () => {
  it("returns the Monday of the week", () => {
    // 2026-06-10 is a Wednesday → Monday is 2026-06-08.
    const mon = startOfWeek(new Date("2026-06-10T15:00:00"));
    expect(mon.getFullYear()).toBe(2026);
    expect(mon.getMonth()).toBe(5);
    expect(mon.getDate()).toBe(8);
    expect(mon.getHours()).toBe(0);
  });

  it("keeps Monday as Monday", () => {
    const mon = startOfWeek(new Date("2026-06-08T09:00:00"));
    expect(mon.getDate()).toBe(8);
  });
});

describe("weekDays", () => {
  it("returns 7 consecutive days from the week start", () => {
    const days = weekDays(startOfWeek(new Date("2026-06-10T00:00:00")));
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.getDate())).toEqual([8, 9, 10, 11, 12, 13, 14]);
  });
});

describe("dayIndex + bucketByDay", () => {
  const weekStart = startOfWeek(new Date("2026-06-10T00:00:00")); // Mon 2026-06-08

  it("maps a timestamp to its 0-based day index", () => {
    expect(dayIndex("2026-06-08T10:00:00", weekStart)).toBe(0);
    expect(dayIndex("2026-06-10T10:00:00", weekStart)).toBe(2);
    expect(dayIndex("2026-06-14T23:00:00", weekStart)).toBe(6);
  });

  it("buckets appointments into the right day column, sorted by time", () => {
    const appts = [
      { id: "a", startTime: "2026-06-10T14:00:00" },
      { id: "b", startTime: "2026-06-10T09:00:00" },
      { id: "c", startTime: "2026-06-08T11:00:00" },
    ];
    const buckets = bucketByDay(appts, weekStart);
    expect(buckets[0]!.map((x) => x.id)).toEqual(["c"]);
    expect(buckets[2]!.map((x) => x.id)).toEqual(["b", "a"]); // 09:00 before 14:00
    expect(buckets[6]).toEqual([]);
  });

  it("drops appointments outside the week", () => {
    const buckets = bucketByDay([{ id: "x", startTime: "2026-07-01T10:00:00" }], weekStart);
    expect(buckets.flat()).toEqual([]);
  });
});
