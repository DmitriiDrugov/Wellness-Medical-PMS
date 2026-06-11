import { z } from "zod";

export const ID_DOCUMENT_TYPES = ["PASSPORT", "NATIONAL_ID", "DRIVING_LICENCE"] as const;
export const GUEST_DOCUMENT_KINDS = ["PASSPORT", "MEDICAL_REPORT", "PRESCRIPTION", "CONSENT", "OTHER"] as const;

export const createGuestSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(1).optional(),
  nationality: z.string().length(2).optional(), // ISO-3166 alpha-2
  dateOfBirth: z.coerce.date().optional(),
  // Identity / travel document
  idDocumentType: z.enum(ID_DOCUMENT_TYPES).optional(),
  idDocumentNumber: z.string().min(1).optional(),
  idDocumentExpiry: z.coerce.date().optional(),
  placeOfBirth: z.string().optional(),
  gender: z.string().optional(),
  addressLine: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  gdprConsentDataProcessing: z.boolean().default(false),
  gdprConsentMarketing: z.boolean().default(false),
});

export const updateGuestSchema = createGuestSchema.partial();

export const listGuestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

/** Medical profile is a full replace (upsert) — all fields optional free-text. */
export const upsertMedicalProfileSchema = z.object({
  dietaryNotes: z.string().nullish(),
  allergies: z.string().nullish(),
  contraindications: z.string().nullish(),
  currentMedications: z.string().nullish(),
  prescriptions: z.string().nullish(),
  mobilityNotes: z.string().nullish(),
  generalNotes: z.string().nullish(),
});

export const addDocumentSchema = z.object({
  kind: z.enum(GUEST_DOCUMENT_KINDS),
  label: z.string().min(1),
  externalRef: z.string().min(1),
});

export type CreateGuestInput = z.infer<typeof createGuestSchema>;
export type UpdateGuestInput = z.infer<typeof updateGuestSchema>;
export type ListGuestsQuery = z.infer<typeof listGuestsQuerySchema>;
export type UpsertMedicalProfileInput = z.infer<typeof upsertMedicalProfileSchema>;
export type AddDocumentInput = z.infer<typeof addDocumentSchema>;
