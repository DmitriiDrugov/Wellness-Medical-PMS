import type { AppointmentStatus, ResourceType } from "@prisma/client";
import { rangesOverlap } from "@/platform/intervals";

/** Statuses that occupy a therapist/resource slot and participate in conflict checks. */
export const APPOINTMENT_BLOCKING_STATUSES = ["SCHEDULED", "COMPLETED"] as const;

export const APPOINTMENT_BLOCKING = APPOINTMENT_BLOCKING_STATUSES as unknown as AppointmentStatus[];

/** True if [start, end) overlaps any of the given busy intervals. */
export function overlapsAny(
  start: Date,
  end: Date,
  busy: ReadonlyArray<{ startTime: Date; endTime: Date }>,
): boolean {
  return busy.some((b) => rangesOverlap(start, end, b.startTime, b.endTime));
}

/** A resource can host a treatment only if its type matches the requirement. */
export function resourceMatchesTreatment(resourceType: ResourceType, requiredType: ResourceType): boolean {
  return resourceType === requiredType;
}

/** Compute appointment end from start + treatment duration (minutes). */
export function computeEndTime(start: Date, durationMinutes: number): Date {
  return new Date(start.getTime() + durationMinutes * 60_000);
}
