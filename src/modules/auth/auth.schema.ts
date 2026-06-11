import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const logoutSchema = z.object({
  refreshToken: z.string().min(1),
});

// ---- Staff management (Staff page) ----

/** Roles assignable through the UI. AI_AGENT is a system principal seeded by ops. */
export const ASSIGNABLE_ROLES = [
  "RECEPTION",
  "RESERVATION_ADMIN",
  "THERAPIST",
  "HOUSEKEEPING",
  "MANAGER",
  "ADMIN",
] as const;

export const createStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(ASSIGNABLE_ROLES),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

export const updateStaffSchema = z.object({
  role: z.enum(ASSIGNABLE_ROLES).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  /** Admin password reset; revokes the member's sessions. */
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
