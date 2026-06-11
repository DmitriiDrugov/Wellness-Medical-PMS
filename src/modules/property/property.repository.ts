import type { Prisma, Property, PropertyArea } from "@prisma/client";
import { prisma } from "@/platform/db";

/** Property module repository — owns the Property and PropertyArea tables. */
export const propertyRepository = {
  get(id: string): Promise<Property | null> {
    return prisma.property.findUnique({ where: { id } });
  },

  update(id: string, data: Prisma.PropertyUpdateInput): Promise<Property> {
    return prisma.property.update({ where: { id }, data });
  },

  listAreas(propertyId: string): Promise<PropertyArea[]> {
    return prisma.propertyArea.findMany({
      where: { propertyId },
      orderBy: [{ floor: "asc" }, { name: "asc" }],
    });
  },

  findAreaById(id: string): Promise<PropertyArea | null> {
    return prisma.propertyArea.findUnique({ where: { id } });
  },

  createArea(data: Prisma.PropertyAreaUncheckedCreateInput): Promise<PropertyArea> {
    return prisma.propertyArea.create({ data });
  },

  updateArea(id: string, data: Prisma.PropertyAreaUpdateInput): Promise<PropertyArea> {
    return prisma.propertyArea.update({ where: { id }, data });
  },

  deleteArea(id: string): Promise<PropertyArea> {
    return prisma.propertyArea.delete({ where: { id } });
  },
};
