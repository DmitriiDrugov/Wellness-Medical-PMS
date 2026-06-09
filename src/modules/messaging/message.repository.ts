import type { Prisma, MessageSenderKind } from "@prisma/client";
import { prisma } from "@/platform/db";

export const messageRepository = {
  create(data: {
    conversationId: string; senderKind: MessageSenderKind; senderStaffId?: string;
    body: string; actionType?: string; actionId?: string;
  }) {
    return prisma.message.create({ data });
  },
  listSince(conversationId: string, since: Date | undefined, take: number) {
    const where: Prisma.MessageWhereInput = {
      conversationId,
      ...(since ? { createdAt: { gt: since } } : {}),
    };
    return prisma.message.findMany({ where, orderBy: { createdAt: "asc" }, take });
  },
  recentHistory(conversationId: string, take: number) {
    return prisma.message
      .findMany({ where: { conversationId }, orderBy: { createdAt: "desc" }, take })
      .then((rows) => rows.reverse());
  },
};
