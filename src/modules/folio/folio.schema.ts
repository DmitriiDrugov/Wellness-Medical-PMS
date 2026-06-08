import { z } from "zod";

export const addChargeSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
  unitPriceMinor: z.number().int(), // may be negative for a credit/discount adjustment
});

export const chargePackageSchema = z.object({
  packageId: z.string().min(1),
});

export const addPaymentSchema = z.object({
  amountMinor: z.number().int().min(1),
  method: z.enum(["CASH", "CARD", "TRANSFER"]),
  reference: z.string().optional(),
});

export type AddChargeInput = z.infer<typeof addChargeSchema>;
export type ChargePackageInput = z.infer<typeof chargePackageSchema>;
export type AddPaymentInput = z.infer<typeof addPaymentSchema>;
