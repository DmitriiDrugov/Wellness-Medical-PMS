import { z } from "zod";

// --- Form templates ---
export const createFormTemplateSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["INTAKE", "MEDICAL_HISTORY", "CUSTOM"]),
  schema: z.record(z.unknown()), // question definitions (shape is form-specific)
  active: z.boolean().default(true),
});

export const updateFormTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["INTAKE", "MEDICAL_HISTORY", "CUSTOM"]).optional(),
  schema: z.record(z.unknown()).optional(),
  active: z.boolean().optional(),
});

// --- Submissions ---
export const createSubmissionSchema = z.object({
  guestId: z.string().min(1),
  templateId: z.string().min(1),
  answers: z.record(z.unknown()).default({}),
  status: z.enum(["PENDING", "COMPLETED"]).default("PENDING"),
});

export const updateSubmissionSchema = z.object({
  answers: z.record(z.unknown()).optional(),
  status: z.enum(["PENDING", "COMPLETED"]).optional(),
});

export const listSubmissionsQuerySchema = z.object({
  guestId: z.string().optional(),
  status: z.enum(["PENDING", "COMPLETED"]).optional(),
});

// --- Consent ---
export const grantConsentSchema = z.object({
  type: z.enum(["TREATMENT", "GDPR_DATA_PROCESSING", "PHOTO", "MARKETING"]),
  version: z.string().min(1),
  text: z.string().optional(),
  docRef: z.string().optional(),
});

// --- Treatment records ---
const soapFields = {
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
  productsUsed: z.array(z.record(z.unknown())).optional(),
  photoRefs: z.array(z.string()).optional(),
};

export const createRecordSchema = z.object({
  treatmentAppointmentId: z.string().min(1),
  ...soapFields,
});

export const updateRecordSchema = z.object({ ...soapFields });

export const addendumSchema = z.object({ ...soapFields });

export const listRecordsQuerySchema = z.object({
  guestId: z.string().optional(),
  appointmentId: z.string().optional(),
});

export type CreateFormTemplateInput = z.infer<typeof createFormTemplateSchema>;
export type UpdateFormTemplateInput = z.infer<typeof updateFormTemplateSchema>;
export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;
export type UpdateSubmissionInput = z.infer<typeof updateSubmissionSchema>;
export type ListSubmissionsQuery = z.infer<typeof listSubmissionsQuerySchema>;
export type GrantConsentInput = z.infer<typeof grantConsentSchema>;
export type CreateRecordInput = z.infer<typeof createRecordSchema>;
export type UpdateRecordInput = z.infer<typeof updateRecordSchema>;
export type AddendumInput = z.infer<typeof addendumSchema>;
export type ListRecordsQuery = z.infer<typeof listRecordsQuerySchema>;
