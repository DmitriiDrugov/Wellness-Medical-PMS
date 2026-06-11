import { prisma } from "@/platform/db";

export const guestAuthRepository = {
  findAccountByEmail(email: string) {
    return prisma.guestAccount.findUnique({ where: { email }, include: { guest: true } });
  },
  findAccountById(id: string) {
    return prisma.guestAccount.findUnique({ where: { id }, include: { guest: true } });
  },
  findAccountByInviteHash(inviteTokenHash: string) {
    return prisma.guestAccount.findFirst({ where: { inviteTokenHash }, include: { guest: true } });
  },
  findAccountByGuestId(guestId: string) {
    return prisma.guestAccount.findUnique({ where: { guestId } });
  },
  /** Strip credentials so the account can no longer log in or be re-invited. */
  disableAccount(id: string) {
    return prisma.guestAccount.update({
      where: { id },
      data: { passwordHash: null, inviteTokenHash: null, activatedAt: null },
    });
  },
  revokeAllRefreshTokens(guestAccountId: string) {
    return prisma.refreshToken.updateMany({
      where: { guestAccountId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
  activate(id: string, passwordHash: string) {
    return prisma.guestAccount.update({
      where: { id },
      data: { passwordHash, inviteTokenHash: null, activatedAt: new Date() },
    });
  },
  touchLogin(id: string) {
    return prisma.guestAccount.update({ where: { id }, data: { lastLoginAt: new Date() } });
  },
  createRefreshToken(input: { guestAccountId: string; tokenHash: string; expiresAt: Date }) {
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
    return prisma.refreshToken.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
  },
};
