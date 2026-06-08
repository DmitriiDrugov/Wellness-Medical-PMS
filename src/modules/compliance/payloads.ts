/**
 * Pure builders for the compliance payloads the system WOULD transmit. They are
 * deliberately simplified for the MVP (real NTAK/NAV schemas are far larger) and are
 * never sent — only logged and persisted. Kept pure so they are unit-testable.
 */

const minorToHuf = (minor: number): number => minor / 100;

export interface PropertyIdentity {
  name: string;
  legalName: string;
  taxNumber: string;
  ntakRegNumber: string;
  addressLine: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface OccupancyMetrics {
  totalRooms: number;
  bookedRoomNights: number;
  occupancyRate: number;
}

export interface FolioForInvoice {
  id: string;
  lineItems: ReadonlyArray<{
    description: string;
    quantity: number;
    unitPriceMinor: number;
    amountMinor: number;
    type: string;
  }>;
  chargesMinor: number;
}

/** Simplified NTAK daily occupancy report payload. */
export function buildNtakDailyPayload(property: PropertyIdentity, reportDate: Date, occupancy: OccupancyMetrics) {
  return {
    reportType: "DAILY_OCCUPANCY",
    reportDate: reportDate.toISOString().slice(0, 10),
    accommodation: {
      name: property.name,
      ntakRegistrationNumber: property.ntakRegNumber,
    },
    metrics: {
      totalRooms: occupancy.totalRooms,
      bookedRoomNights: occupancy.bookedRoomNights,
      occupancyRate: occupancy.occupancyRate,
    },
    note: "MVP: simplified NTAK daily payload; not transmitted.",
  };
}

/** Simplified NAV online-invoice payload built from a folio. */
export function buildNavInvoicePayload(property: PropertyIdentity, folio: FolioForInvoice, customerName: string) {
  return {
    invoiceNumber: `INV-${folio.id}`,
    issueDate: new Date().toISOString().slice(0, 10),
    currency: "HUF",
    supplier: {
      name: property.legalName,
      taxNumber: property.taxNumber,
      address: `${property.postalCode} ${property.city}, ${property.addressLine}, ${property.country}`,
    },
    customer: { name: customerName },
    lines: folio.lineItems.map((li, i) => ({
      lineNumber: i + 1,
      description: li.description,
      lineItemType: li.type,
      quantity: li.quantity,
      unitPriceHuf: minorToHuf(li.unitPriceMinor),
      lineAmountHuf: minorToHuf(li.amountMinor),
    })),
    totalGrossHuf: minorToHuf(folio.chargesMinor),
    note: "MVP: VAT breakdown stubbed; not transmitted to NAV.",
  };
}
