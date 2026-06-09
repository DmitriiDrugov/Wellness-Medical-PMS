import type { Prisma, ConversationHandling, ConversationStatus } from "@prisma/client";
import { prisma } from "@/platform/db";

export const conversationRepository = {
  findById(id: string) {
    return prisma.conversation.findUnique({ where: { id }, include: { guest: true } });
  },
  findByGuestId(guestId: string) {
    return prisma.conversation.findUnique({ where: { guestId }, include: { guest: true } });
  },
  create(data: { propertyId: string; guestId: string }) {
    return prisma.conversation.create({
      data: { propertyId: data.propertyId, guestId: data.guestId },
      include: { guest: true },
    });
  },
  update(id: string, data: Prisma.ConversationUpdateInput) {
    return prisma.conversation.update({ where: { id }, data, include: { guest: true } });
  },
  async list(params: {
    propertyId: string; skip: number; take: number;
    handling?: ConversationHandling; status?: ConversationStatus; guestIds?: string[];
  }) {
    const where: Prisma.ConversationWhereInput = {
      propertyId: params.propertyId,
      ...(params.handling ? { handling: params.handling } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.guestIds ? { guestId: { in: params.guestIds } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.conversation.findMany({
        where, skip: params.skip, take: params.take,
        orderBy: { lastMessageAt: "desc" }, include: { guest: true },
      }),
      prisma.conversation.count({ where }),
    ]);
    return { items, total };
  },
};
