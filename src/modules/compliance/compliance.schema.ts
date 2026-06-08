import { z } from "zod";

export const ntakDailyReportSchema = z.object({
  date: z.coerce.date(),
});

export const navInvoiceSchema = z.object({
  folioId: z.string().min(1),
});

export type NtakDailyReportInput = z.infer<typeof ntakDailyReportSchema>;
export type NavInvoiceInput = z.infer<typeof navInvoiceSchema>;
