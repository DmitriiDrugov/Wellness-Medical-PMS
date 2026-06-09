import { z } from "zod";

export const guestLoginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export const guestRefreshSchema = z.object({ refreshToken: z.string().min(1) });
export const guestLogoutSchema = z.object({ refreshToken: z.string().min(1) });
export const guestSetPasswordSchema = z.object({
  inviteToken: z.string().min(1),
  password: z.string().min(8),
});

export type GuestLoginInput = z.infer<typeof guestLoginSchema>;
export type GuestRefreshInput = z.infer<typeof guestRefreshSchema>;
export type GuestLogoutInput = z.infer<typeof guestLogoutSchema>;
export type GuestSetPasswordInput = z.infer<typeof guestSetPasswordSchema>;
