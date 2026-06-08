/**
 * Half-open interval overlap test for date ranges: [aStart, aEnd) vs [bStart, bEnd).
 *
 * Half-open semantics are deliberate for hotel stays: a guest checking out on day D
 * frees the room for another guest checking in on day D. So adjacency (aEnd == bStart)
 * is NOT a conflict.
 */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Statuses that occupy a room and therefore participate in conflict detection. */
export const BLOCKING_RESERVATION_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
] as const;
