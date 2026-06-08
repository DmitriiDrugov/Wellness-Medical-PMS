import type { Prisma, FormTemplate, IntakeFormSubmission, SubmissionStatus } from "@prisma/client";
import { prisma } from "@/platform/db";

/** Owns FormTemplate and IntakeFormSubmission tables. */
export const formsRepository = {
  createTemplate(data: Prisma.FormTemplateCreateInput): Promise<FormTemplate> {
    return prisma.formTemplate.create({ data });
  },

  findTemplateById(id: string): Promise<FormTemplate | null> {
    return prisma.formTemplate.findUnique({ where: { id } });
  },

  listTemplates(propertyId: string): Promise<FormTemplate[]> {
    return prisma.formTemplate.findMany({ where: { propertyId }, orderBy: { name: "asc" } });
  },

  updateTemplate(id: string, data: Prisma.FormTemplateUpdateInput): Promise<FormTemplate> {
    return prisma.formTemplate.update({ where: { id }, data });
  },

  createSubmission(data: Prisma.IntakeFormSubmissionUncheckedCreateInput): Promise<IntakeFormSubmission> {
    return prisma.intakeFormSubmission.create({ data });
  },

  findSubmissionById(id: string): Promise<IntakeFormSubmission | null> {
    return prisma.intakeFormSubmission.findUnique({ where: { id } });
  },

  listSubmissions(params: { propertyId: string; guestId?: string; status?: SubmissionStatus }) {
    return prisma.intakeFormSubmission.findMany({
      where: {
        propertyId: params.propertyId,
        ...(params.guestId ? { guestId: params.guestId } : {}),
        ...(params.status ? { status: params.status } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  },

  updateSubmission(id: string, data: Prisma.IntakeFormSubmissionUpdateInput): Promise<IntakeFormSubmission> {
    return prisma.intakeFormSubmission.update({ where: { id }, data });
  },
};
