import { z } from "zod";

export const createAppointmentSchema = z.object({
  guestId: z.string().min(1),
  treatmentId: z.string().min(1),
  therapistId: z.string().min(1),
  resourceId: z.string().min(1),
  startTime: z.coerce.date(),
  reservationId: z.string().min(1).optional(),
  notes: z.string().optional(),
});

// Reschedule / reassign. endTime is always derived from the treatment's duration.
export const updateAppointmentSchema = z.object({
  therapistId: z.string().min(1).optional(),
  resourceId: z.string().min(1).optional(),
  startTime: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export const listAppointmentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  therapistId: z.string().optional(),
  guestId: z.string().optional(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
});

export const appointmentAvailabilityQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    therapistId: z.string().optional(),
    resourceId: z.string().optional(),
  })
  .refine((v) => v.to > v.from, { message: "to must be after from", path: ["to"] })
  .refine((v) => v.therapistId || v.resourceId, {
    message: "Provide therapistId and/or resourceId",
    path: ["therapistId"],
  });

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
export type AppointmentAvailabilityQuery = z.infer<typeof appointmentAvailabilityQuerySchema>;
