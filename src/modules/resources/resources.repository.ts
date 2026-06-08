import type { Prisma, Resource } from "@prisma/client";
import { prisma } from "@/platform/db";

/** Resources module repository — the ONLY place that queries the Resource table. */
export const resourcesRepository = {
  create(data: Prisma.ResourceCreateInput): Promise<Resource> {
    return prisma.resource.create({ data });
  },

  findById(id: string): Promise<Resource | null> {
    return prisma.resource.findUnique({ where: { id } });
  },

  list(propertyId: string): Promise<Resource[]> {
    return prisma.resource.findMany({ where: { propertyId }, orderBy: { name: "asc" } });
  },

  update(id: string, data: Prisma.ResourceUpdateInput): Promise<Resource> {
    return prisma.resource.update({ where: { id }, data });
  },
};
