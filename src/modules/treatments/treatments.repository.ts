import type { Prisma, Treatment } from "@prisma/client";
import { prisma } from "@/platform/db";

/** Treatments module repository — the ONLY place that queries the Treatment table. */
export const treatmentsRepository = {
  create(data: Prisma.TreatmentCreateInput): Promise<Treatment> {
    return prisma.treatment.create({ data });
  },

  findById(id: string): Promise<Treatment | null> {
    return prisma.treatment.findUnique({ where: { id } });
  },

  findManyByIds(ids: string[]): Promise<Treatment[]> {
    return prisma.treatment.findMany({ where: { id: { in: ids } } });
  },

  list(propertyId: string): Promise<Treatment[]> {
    return prisma.treatment.findMany({ where: { propertyId }, orderBy: { name: "asc" } });
  },

  update(id: string, data: Prisma.TreatmentUpdateInput): Promise<Treatment> {
    return prisma.treatment.update({ where: { id }, data });
  },
};
