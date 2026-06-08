/**
 * Half-open interval overlap test: [aStart, aEnd) vs [bStart, bEnd).
 * Shared by reservation date-range conflicts and appointment time-slot conflicts.
 *
 * Half-open semantics mean adjacency (aEnd == bStart) is NOT an overlap — e.g. a
 * 10:00–10:50 appointment does not conflict with a 10:50–11:40 one.
 */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}
