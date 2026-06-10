import { nightsBetween } from "@/platform/intervals";

/** A reservation reduced to what the grid utilization math needs. */
export interface GridStay {
  roomId: string | null;
  checkInDate: Date;
  checkOutDate: Date;
}

export interface Utilization {
  occupiedRoomNights: number;
  availableRoomNights: number;
  /** Occupancy 0–100, rounded to a whole percent (0 when no inventory). */
  ratePct: number;
}

/** Nights a stay overlaps the half-open window [from, to). */
export function overlapNights(stay: { checkInDate: Date; checkOutDate: Date }, from: Date, to: Date): number {
  const start = stay.checkInDate > from ? stay.checkInDate : from;
  const end = stay.checkOutDate < to ? stay.checkOutDate : to;
  return nightsBetween(start, end);
}

/**
 * Booking-grid occupancy: occupied room-nights (assigned stays only, clipped to
 * the window) divided by available room-nights (rooms × nights in the window).
 */
export function computeUtilization(stays: GridStay[], roomCount: number, from: Date, to: Date): Utilization {
  const windowNights = nightsBetween(from, to);
  const availableRoomNights = roomCount * windowNights;
  const occupiedRoomNights = stays
    .filter((s) => s.roomId !== null)
    .reduce((sum, s) => sum + overlapNights(s, from, to), 0);
  const ratePct =
    availableRoomNights > 0 ? Math.round((occupiedRoomNights / availableRoomNights) * 100) : 0;
  return { occupiedRoomNights, availableRoomNights, ratePct };
}
