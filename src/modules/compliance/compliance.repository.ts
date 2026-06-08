import type { Prisma, ComplianceEvent, ComplianceEventType, Property } from "@prisma/client";
import { prisma } from "@/platform/db";

/** Compliance module repository — owns ComplianceEvent; reads Property identity. */
export const complianceRepository = {
  getProperty(id: string): Promise<Property | null> {
    return prisma.property.findUnique({ where: { id } });
  },

  createEvent(data: {
    propertyId: string;
    type: ComplianceEventType;
    payload: unknown;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }): Promise<ComplianceEvent> {
    return prisma.complianceEvent.create({
      data: {
        propertyId: data.propertyId,
        type: data.type,
        payload: data.payload as Prisma.InputJsonValue,
        status: "LOGGED",
        relatedEntityType: data.relatedEntityType,
        relatedEntityId: data.relatedEntityId,
      },
    });
  },

  listEvents(propertyId: string): Promise<ComplianceEvent[]> {
    return prisma.complianceEvent.findMany({ where: { propertyId }, orderBy: { createdAt: "desc" } });
  },
};
