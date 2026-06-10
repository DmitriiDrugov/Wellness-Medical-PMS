/** Helpers for the treatment schedule's weekly (7-day) view. Pure + unit-tested. */

export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** The 7 day-dates of the week starting at `weekStart`. */
export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** Local-day index (0=Mon … 6=Sun) of a timestamp relative to `weekStart`. */
export function dayIndex(iso: string, weekStart: Date): number {
  const d = new Date(iso);
  const base = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((day.getTime() - base.getTime()) / 86_400_000);
}

/**
 * Bucket items into 7 day-columns by their start time, each sorted chronologically.
 * Items outside the week are dropped. Generic over anything with a `startTime`.
 */
export function bucketByDay<T extends { startTime: string }>(items: T[], weekStart: Date): T[][] {
  const buckets: T[][] = Array.from({ length: 7 }, () => []);
  for (const item of items) {
    const i = dayIndex(item.startTime, weekStart);
    if (i >= 0 && i < 7) buckets[i]!.push(item);
  }
  for (const b of buckets) b.sort((a, z) => new Date(a.startTime).getTime() - new Date(z.startTime).getTime());
  return buckets;
}
