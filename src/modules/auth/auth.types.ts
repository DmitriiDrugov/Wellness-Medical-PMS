import type { StaffRole } from "@prisma/client";

/** Public profile of a staff member (never includes passwordHash). */
export interface StaffProfile {
  id: string;
  email: string;
  role: StaffRole;
  firstName: string;
  lastName: string;
  isActive: boolean;
  propertyId: string;
}

/** Token pair returned by login / refresh. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number; // access token TTL, seconds
}
