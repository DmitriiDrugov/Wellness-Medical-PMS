// Re-export the shared interval predicate. Hotel stays use half-open semantics: a
// guest checking out on day D frees the room for another guest checking in on day D.
export { rangesOverlap } from "@/platform/intervals";

/** Statuses that occupy a room and therefore participate in conflict detection. */
export const BLOCKING_RESERVATION_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
] as const;
