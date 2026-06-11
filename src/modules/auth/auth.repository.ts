import type { Staff, StaffRole } from "@prisma/client";
import { prisma } from "@/platform/db";

/**
 * Auth module repository — the ONLY place that queries the Staff and RefreshToken
 * tables. Other modules needing staff data go through the auth service interface.
 */
export const authRepository = {
  findStaffByEmail(email: string): Promise<Staff | null> {
    return prisma.staff.findUnique({ where: { email } });
  },

  findStaffById(id: string): Promise<Staff | null> {
    return prisma.staff.findUnique({ where: { id } });
  },

  createRefreshToken(input: { staffId: string; tokenHash: string; expiresAt: Date }) {
    return prisma.refreshToken.create({ data: input });
  },

  findValidRefreshToken(tokenHash: string) {
    return prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
  },

  revokeRefreshTokenById(id: string) {
    return prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
  },

  revokeRefreshTokenByHash(tokenHash: string) {
    return prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  findAiAgent(propertyId: string) {
    return prisma.staff.findFirst({ where: { propertyId, role: "AI_AGENT", isActive: true } });
  },

  listStaff(params: { propertyId: string; role?: StaffRole; includeInactive?: boolean }) {
    return prisma.staff.findMany({
      where: {
        propertyId: params.propertyId,
        ...(params.includeInactive ? {} : { isActive: true }),
        ...(params.role ? { role: params.role } : {}),
      },
      orderBy: { lastName: "asc" },
    });
  },

  createStaff(data: {
    propertyId: string;
    email: string;
    passwordHash: string;
    role: StaffRole;
    firstName: string;
    lastName: string;
  }): Promise<Staff> {
    return prisma.staff.create({ data });
  },

  updateStaff(
    id: string,
    data: Partial<Pick<Staff, "role" | "firstName" | "lastName" | "isActive" | "passwordHash">>,
  ): Promise<Staff> {
    return prisma.staff.update({ where: { id }, data });
  },

  /** Revoke every live refresh token of a staff member (deactivation / password reset). */
  revokeAllStaffRefreshTokens(staffId: string) {
    return prisma.refreshToken.updateMany({
      where: { staffId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
};
