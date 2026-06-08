import type { Prisma } from "@prisma/client";
import { prisma } from "@/platform/db";

type ItemInput = { treatmentId: string; quantity: number };

/** Packages module repository — owns ServicePackage and PackageItem tables. */
export const packagesRepository = {
  create(propertyId: string, data: { name: string; description?: string; priceMinor: number; active: boolean; items: ItemInput[] }) {
    return prisma.servicePackage.create({
      data: {
        propertyId,
        name: data.name,
        description: data.description,
        priceMinor: data.priceMinor,
        active: data.active,
        items: { create: data.items.map((i) => ({ treatmentId: i.treatmentId, quantity: i.quantity })) },
      },
      include: { items: true },
    });
  },

  findById(id: string) {
    return prisma.servicePackage.findUnique({ where: { id }, include: { items: true } });
  },

  list(propertyId: string) {
    return prisma.servicePackage.findMany({
      where: { propertyId },
      orderBy: { name: "asc" },
      include: { items: true },
    });
  },

  updateScalars(id: string, data: Prisma.ServicePackageUpdateInput) {
    return prisma.servicePackage.update({ where: { id }, data, include: { items: true } });
  },

  /** Replace a package's items atomically (scalars + items in one transaction). */
  updateWithItems(id: string, scalars: Prisma.ServicePackageUpdateInput, items: ItemInput[]) {
    return prisma.$transaction(async (tx) => {
      await tx.packageItem.deleteMany({ where: { packageId: id } });
      return tx.servicePackage.update({
        where: { id },
        data: {
          ...scalars,
          items: { create: items.map((i) => ({ treatmentId: i.treatmentId, quantity: i.quantity })) },
        },
        include: { items: true },
      });
    });
  },
};
