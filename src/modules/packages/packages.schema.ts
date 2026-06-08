import { z } from "zod";

const packageItem = z.object({
  treatmentId: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
});

export const createPackageSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  priceMinor: z.number().int().min(0),
  active: z.boolean().default(true),
  items: z.array(packageItem).min(1),
});

export const updatePackageSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  priceMinor: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  items: z.array(packageItem).min(1).optional(),
});

export type CreatePackageInput = z.infer<typeof createPackageSchema>;
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>;
