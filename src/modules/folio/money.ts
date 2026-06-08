/**
 * Folio money helpers. All amounts are integer minor units (HUF x 100); arithmetic
 * is therefore exact with no floating-point rounding. See ADR 0004.
 */
export function sumAmounts(rows: ReadonlyArray<{ amountMinor: number }>): number {
  return rows.reduce((total, r) => total + r.amountMinor, 0);
}

/** Folio balance = total charges − total payments (positive = guest owes money). */
export function computeBalance(
  lineItems: ReadonlyArray<{ amountMinor: number }>,
  payments: ReadonlyArray<{ amountMinor: number }>,
): number {
  return sumAmounts(lineItems) - sumAmounts(payments);
}

// nightsBetween lives in the platform layer (shared with reservations); re-exported
// here so folio callers and tests have it close at hand.
export { nightsBetween } from "@/platform/intervals";
