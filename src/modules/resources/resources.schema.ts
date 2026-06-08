import { z } from "zod";

export const createResourceSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["TREATMENT_ROOM", "EQUIPMENT"]),
  capacity: z.number().int().min(1).default(1),
  active: z.boolean().default(true),
});

export const updateResourceSchema = createResourceSchema.partial();

export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;
