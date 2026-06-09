/** Display helpers. Money is stored as integer minor units (HUF × 100). */

const moneyFmt = new Intl.NumberFormat("hu-HU", {
  style: "currency",
  currency: "HUF",
  maximumFractionDigits: 0,
});

export function formatMinor(minor: number | null | undefined): string {
  if (minor == null) return "—";
  return moneyFmt.format(Math.round(minor) / 100);
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return dateFmt.format(new Date(d));
}
export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return dateTimeFmt.format(new Date(d));
}
export function formatTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return timeFmt.format(new Date(d));
}

export function initials(first?: string, last?: string): string {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
}

export function fullName(first?: string, last?: string): string {
  return [first, last].filter(Boolean).join(" ") || "—";
}
