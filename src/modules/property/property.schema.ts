import { z } from "zod";

export const AREA_KINDS = [
  "COMMON", "POOL", "SPA", "RESTAURANT", "CORRIDOR", "BACK_OFFICE", "OUTDOOR", "OTHER",
] as const;

export const updatePropertySchema = z.object({
  name: z.string().min(1).optional(),
  legalName: z.string().min(1).optional(),
  taxNumber: z.string().min(1).optional(),
  ntakRegNumber: z.string().min(1).optional(),
  addressLine: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  postalCode: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  timezone: z.string().min(1).optional(),
  currency: z.string().min(1).optional(),
  touristTaxPerPersonPerNightMinor: z.number().int().min(0).optional(),
  touristTaxAppliesToChildren: z.boolean().optional(),
});

const placement = {
  floor: z.number().int().optional(),
  posX: z.number().int().min(0).optional(),
  posY: z.number().int().min(0).optional(),
  width: z.number().int().min(1).max(20).optional(),
  height: z.number().int().min(1).max(20).optional(),
};

export const createAreaSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(AREA_KINDS).default("COMMON"),
  notes: z.string().optional(),
  ...placement,
});

export const updateAreaSchema = z.object({
  name: z.string().min(1).optional(),
  kind: z.enum(AREA_KINDS).optional(),
  notes: z.string().nullish(),
  ...placement,
});

export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type CreateAreaInput = z.infer<typeof createAreaSchema>;
export type UpdateAreaInput = z.infer<typeof updateAreaSchema>;
