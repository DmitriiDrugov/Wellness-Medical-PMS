import type { StaffRole } from "@prisma/client";
import { UnauthorizedError } from "@/platform/errors";
import { verifyAccessToken } from "@/platform/auth/jwt";

/** The authenticated caller, derived from the access token (stateless). */
export interface AuthContext {
  staffId: string;
  role: StaffRole;
  propertyId: string;
}

/**
 * Extract and verify the Bearer access token from a request. Throws
 * UnauthorizedError if the header is missing/malformed or the token is invalid.
 */
export function requireAuth(req: Request): AuthContext {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or malformed Authorization header");
  }
  const claims = verifyAccessToken(header.slice("Bearer ".length).trim());
  return { staffId: claims.sub, role: claims.role, propertyId: claims.propertyId };
}
