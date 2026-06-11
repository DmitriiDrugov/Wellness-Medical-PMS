/**
 * Hungarian tourist tax (IFA) computation. A fixed amount in minor units is levied
 * per taxable person per night; under-18 guests (the `children` count) are exempt
 * unless the property opts them in. Pure + integer-only, like the rest of money.ts.
 */
export interface TouristTaxConfig {
  perPersonPerNightMinor: number;
  appliesToChildren: boolean;
}

export interface TaxableStay {
  adults: number;
  children: number;
  nights: number;
}

/** Persons subject to the tax for one stay. */
export function taxablePersons(stay: Pick<TaxableStay, "adults" | "children">, cfg: TouristTaxConfig): number {
  return stay.adults + (cfg.appliesToChildren ? stay.children : 0);
}

/** Total person-nights subject to the tax. */
export function taxablePersonNights(stay: TaxableStay, cfg: TouristTaxConfig): number {
  return taxablePersons(stay, cfg) * Math.max(0, stay.nights);
}

/** Total tourist tax for one stay, in minor units. */
export function computeTouristTax(stay: TaxableStay, cfg: TouristTaxConfig): number {
  return taxablePersonNights(stay, cfg) * Math.max(0, cfg.perPersonPerNightMinor);
}
