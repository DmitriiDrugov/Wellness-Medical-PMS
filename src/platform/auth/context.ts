import type { StaffRole } from "@prisma/client";
import { UnauthorizedError } from "@/platform/errors";
import { verifyAccessToken, verifyGuestAccessToken } from "@/platform/auth/jwt";

export interface StaffAuthContext {
  kind: "staff";
  staffId: string;
  role: StaffRole;
  propertyId: string;
}
export interface GuestAuthContext {
  kind: "guest";
  guestAccountId: string;
  guestId: string;
  propertyId: string;
}
export type AuthContext = StaffAuthContext;

function bearer(req: Request): string {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or malformed Authorization header");
  }
  return header.slice("Bearer ".length).trim();
}

/** Staff principal (unchanged signature for existing callers). */
export function requireAuth(req: Request): StaffAuthContext {
  const claims = verifyAccessToken(bearer(req));
  return { kind: "staff", staffId: claims.sub, role: claims.role, propertyId: claims.propertyId };
}

export const requireStaff = requireAuth;

/** Guest principal — authorized by ownership, not the RBAC matrix. */
export function requireGuest(req: Request): GuestAuthContext {
  const claims = verifyGuestAccessToken(bearer(req));
  return {
    kind: "guest",
    guestAccountId: claims.sub,
    guestId: claims.guestId,
    propertyId: claims.propertyId,
  };
}
