import { config, getCurrentPropertyId } from "@/platform/config";
import { UnauthorizedError, NotFoundError, ValidationError } from "@/platform/errors";
import { recordAudit } from "@/platform/audit";
import {
  issueGuestAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
} from "@/platform/auth/jwt";
import { hashPassword, verifyPassword } from "@/platform/auth/password";
import { guestAuthRepository } from "@/modules/guest-auth/guest-auth.repository";
import type { GuestProfile, GuestTokenPair } from "@/modules/guest-auth/guest-auth.types";
import type {
  GuestLoginInput, GuestRefreshInput, GuestLogoutInput, GuestSetPasswordInput,
} from "@/modules/guest-auth/guest-auth.schema";

type Account = Awaited<ReturnType<typeof guestAuthRepository.findAccountById>>;

async function issuePair(account: NonNullable<Account>): Promise<GuestTokenPair> {
  const propertyId = await getCurrentPropertyId();
  const accessToken = issueGuestAccessToken({
    sub: account.id,
    guestId: account.guestId,
    propertyId,
  });
  const refresh = generateRefreshToken();
  await guestAuthRepository.createRefreshToken({
    guestAccountId: account.id,
    tokenHash: refresh.hash,
    expiresAt: refreshTokenExpiry(),
  });
  return { accessToken, refreshToken: refresh.raw, tokenType: "Bearer", expiresIn: config.jwt.accessTtlSeconds };
}

async function toProfile(account: NonNullable<Account>): Promise<GuestProfile> {
  const propertyId = await getCurrentPropertyId();
  return {
    guestId: account.guestId,
    email: account.email,
    firstName: account.guest.firstName,
    lastName: account.guest.lastName,
    propertyId,
  };
}

export const guestAuthService = {
  async login(input: GuestLoginInput): Promise<GuestTokenPair> {
    const account = await guestAuthRepository.findAccountByEmail(input.email);
    const ok = account?.passwordHash ? await verifyPassword(input.password, account.passwordHash) : false;
    if (!account || !account.activatedAt || !ok) throw new UnauthorizedError("Invalid credentials");
    await guestAuthRepository.touchLogin(account.id);
    const propertyId = await getCurrentPropertyId();
    await recordAudit({
      actorStaffId: null, propertyId,
      action: "LOGIN", entityType: "GuestAccount", entityId: account.id,
    });
    return issuePair(account);
  },

  async setPassword(input: GuestSetPasswordInput): Promise<GuestProfile> {
    const account = await guestAuthRepository.findAccountByInviteHash(hashRefreshToken(input.inviteToken));
    if (!account) throw new ValidationError("Invalid or used invite token");
    const passwordHash = await hashPassword(input.password);
    const updated = await guestAuthRepository.activate(account.id, passwordHash);
    return await toProfile({ ...account, ...updated });
  },

  async refresh(input: GuestRefreshInput): Promise<GuestTokenPair> {
    const existing = await guestAuthRepository.findValidRefreshToken(hashRefreshToken(input.refreshToken));
    if (!existing?.guestAccountId) throw new UnauthorizedError("Invalid or expired refresh token");
    const account = await guestAuthRepository.findAccountById(existing.guestAccountId);
    if (!account) throw new UnauthorizedError("Account not found");
    await guestAuthRepository.revokeRefreshTokenById(existing.id);
    return issuePair(account);
  },

  async logout(input: GuestLogoutInput): Promise<void> {
    await guestAuthRepository.revokeRefreshTokenByHash(hashRefreshToken(input.refreshToken));
  },

  async getProfile(guestAccountId: string): Promise<GuestProfile> {
    const account = await guestAuthRepository.findAccountById(guestAccountId);
    if (!account) throw new NotFoundError("Guest account not found");
    return await toProfile(account);
  },
};
