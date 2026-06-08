import type { Prisma, Guest } from "@prisma/client";
import { prisma } from "@/platform/db";

/** Guests module repository — the ONLY place that queries the Guest table. */
export const guestsRepository = {
  create(data: Prisma.GuestCreateInput): Promise<Guest> {
    return prisma.guest.create({ data });
  },

  findById(id: string): Promise<Guest | null> {
    return prisma.guest.findFirst({ where: { id, deletedAt: null } });
  },

  async list(params: { skip: number; take: number; search?: string }): Promise<{ items: Guest[]; total: number }> {
    const where: Prisma.GuestWhereInput = {
      deletedAt: null,
      ...(params.search
        ? {
            OR: [
              { firstName: { contains: params.search, mode: "insensitive" } },
              { lastName: { contains: params.search, mode: "insensitive" } },
              { email: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.guest.findMany({ where, skip: params.skip, take: params.take, orderBy: { lastName: "asc" } }),
      prisma.guest.count({ where }),
    ]);
    return { items, total };
  },

  update(id: string, data: Prisma.GuestUpdateInput): Promise<Guest> {
    return prisma.guest.update({ where: { id }, data });
  },

  softDelete(id: string): Promise<Guest> {
    return prisma.guest.update({ where: { id }, data: { deletedAt: new Date() } });
  },
};
