import { z } from "zod";

export const dateRangeQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((v) => v.to > v.from, { message: "to must be after from", path: ["to"] });

export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;
