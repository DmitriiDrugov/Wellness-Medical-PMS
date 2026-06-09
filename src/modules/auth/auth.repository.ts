import type { Staff } from "@prisma/client";
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
};
