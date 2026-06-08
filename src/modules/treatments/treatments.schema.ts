import { z } from "zod";

export const createTreatmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  durationMinutes: z.number().int().min(5),
  priceMinor: z.number().int().min(0),
  requiredResourceType: z.enum(["TREATMENT_ROOM", "EQUIPMENT"]),
  active: z.boolean().default(true),
});

export const updateTreatmentSchema = createTreatmentSchema.partial();

export type CreateTreatmentInput = z.infer<typeof createTreatmentSchema>;
export type UpdateTreatmentInput = z.infer<typeof updateTreatmentSchema>;
