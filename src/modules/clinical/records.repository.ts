import type { Prisma, TreatmentRecord } from "@prisma/client";
import { prisma } from "@/platform/db";

/** Owns the TreatmentRecord table. */
export const recordsRepository = {
  create(data: Prisma.TreatmentRecordUncheckedCreateInput): Promise<TreatmentRecord> {
    return prisma.treatmentRecord.create({ data });
  },

  findById(id: string): Promise<TreatmentRecord | null> {
    return prisma.treatmentRecord.findUnique({ where: { id } });
  },

  list(params: { propertyId: string; guestId?: string; appointmentId?: string }): Promise<TreatmentRecord[]> {
    return prisma.treatmentRecord.findMany({
      where: {
        propertyId: params.propertyId,
        ...(params.guestId ? { guestId: params.guestId } : {}),
        ...(params.appointmentId ? { treatmentAppointmentId: params.appointmentId } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  },

  update(id: string, data: Prisma.TreatmentRecordUpdateInput): Promise<TreatmentRecord> {
    return prisma.treatmentRecord.update({ where: { id }, data });
  },
};
