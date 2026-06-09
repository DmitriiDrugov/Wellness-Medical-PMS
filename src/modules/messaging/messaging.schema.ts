import { z } from "zod";

export const sendMessageSchema = z.object({ body: z.string().min(1).max(4000) });
export const listMessagesQuerySchema = z.object({
  since: z.string().optional(), // ISO timestamp cursor (exclusive)
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const listConversationsQuerySchema = z.object({
  handling: z.enum(["AI", "HUMAN"]).optional(),
  status: z.enum(["OPEN", "CLOSED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;
