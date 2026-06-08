import { describe, it, expect } from "vitest";
import { buildNtakDailyPayload, buildNavInvoicePayload, type PropertyIdentity } from "@/modules/compliance/payloads";

const property: PropertyIdentity = {
  name: "Thermál Wellness Hotel",
  legalName: "Thermál Wellness Kft.",
  taxNumber: "12345678-2-42",
  ntakRegNumber: "MA19000123",
  addressLine: "Fürdő utca 1.",
  city: "Hévíz",
  postalCode: "8380",
  country: "HU",
};

describe("buildNtakDailyPayload", () => {
  it("includes accommodation identity and occupancy metrics", () => {
    const payload = buildNtakDailyPayload(property, new Date("2026-06-08T00:00:00Z"), {
      totalRooms: 10,
      bookedRoomNights: 15,
      occupancyRate: 0.5,
    });
    expect(payload.reportDate).toBe("2026-06-08");
    expect(payload.accommodation.ntakRegistrationNumber).toBe("MA19000123");
    expect(payload.metrics.bookedRoomNights).toBe(15);
  });
});

describe("buildNavInvoicePayload", () => {
  it("converts minor units to HUF and totals the lines", () => {
    const payload = buildNavInvoicePayload(
      property,
      {
        id: "folio_1",
        chargesMinor: 4_900_000,
        lineItems: [
          { description: "Standard Double — 1 night", quantity: 1, unitPriceMinor: 3_500_000, amountMinor: 3_500_000, type: "ROOM" },
          { description: "Swedish Massage", quantity: 1, unitPriceMinor: 1_400_000, amountMinor: 1_400_000, type: "TREATMENT" },
        ],
      },
      "János Kovács",
    );
    expect(payload.supplier.taxNumber).toBe("12345678-2-42");
    expect(payload.customer.name).toBe("János Kovács");
    expect(payload.lines).toHaveLength(2);
    expect(payload.lines[0]!.unitPriceHuf).toBe(35000);
    expect(payload.totalGrossHuf).toBe(49000);
  });
});
