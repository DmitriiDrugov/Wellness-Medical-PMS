import type { LineItemType } from "@prisma/client";
import { nightsBetween } from "@/platform/intervals";

/**
 * Pure reporting aggregation helpers. Kept separate from DB access so the metric
 * logic is unit-testable without a database.
 */

/** Nights of a stay that fall inside the [from, to) reporting window. */
export function nightsInWindow(checkIn: Date, checkOut: Date, from: Date, to: Date): number {
  const start = checkIn > from ? checkIn : from;
  const end = checkOut < to ? checkOut : to;
  return end > start ? nightsBetween(start, end) : 0;
}

/** Occupancy rate in [0, 1]: booked room-nights / (rooms × nights). */
export function occupancyRate(bookedRoomNights: number, totalRooms: number, nights: number): number {
  const capacity = totalRooms * nights;
  if (capacity <= 0) return 0;
  return bookedRoomNights / capacity;
}

/** Sum minor-unit amounts (kept local so reporting stays decoupled from folio). */
export function sumAmounts(rows: ReadonlyArray<{ amountMinor: number }>): number {
  return rows.reduce((total, r) => total + r.amountMinor, 0);
}

/** Sum charge amounts grouped by line-item type (minor units). */
export function groupChargesByType(
  items: ReadonlyArray<{ type: LineItemType; amountMinor: number }>,
): Record<LineItemType, number> {
  const totals: Record<LineItemType, number> = { ROOM: 0, PACKAGE: 0, TREATMENT: 0, ADJUSTMENT: 0 };
  for (const item of items) totals[item.type] += item.amountMinor;
  return totals;
}
