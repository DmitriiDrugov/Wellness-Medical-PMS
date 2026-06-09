import type { Staff, StaffRole } from "@prisma/client";
import { config } from "@/platform/config";
import { requireCapability } from "@/platform/rbac";
import { UnauthorizedError, NotFoundError } from "@/platform/errors";
import { recordAudit } from "@/platform/audit";
import {
  issueAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
} from "@/platform/auth/jwt";
import { verifyPassword } from "@/platform/auth/password";
import { authRepository } from "@/modules/auth/auth.repository";
import type { StaffProfile, TokenPair } from "@/modules/auth/auth.types";
import type { LoginInput, RefreshInput, LogoutInput } from "@/modules/auth/auth.schema";

function toProfile(staff: Staff): StaffProfile {
  return {
    id: staff.id,
    email: staff.email,
    role: staff.role,
    firstName: staff.firstName,
    lastName: staff.lastName,
    isActive: staff.isActive,
    propertyId: staff.propertyId,
  };
}

async function issuePair(staff: Staff): Promise<TokenPair> {
  const accessToken = issueAccessToken({
    sub: staff.id,
    role: staff.role,
    propertyId: staff.propertyId,
  });
  const refresh = generateRefreshToken();
  await authRepository.createRefreshToken({
    staffId: staff.id,
    tokenHash: refresh.hash,
    expiresAt: refreshTokenExpiry(),
  });
  return {
    accessToken,
    refreshToken: refresh.raw,
    tokenType: "Bearer",
    expiresIn: config.jwt.accessTtlSeconds,
  };
}

export const authService = {
  async login(input: LoginInput): Promise<TokenPair> {
    const staff = await authRepository.findStaffByEmail(input.email);
    // Verify password even when staff is missing/inactive to avoid leaking which
    // accounts exist via timing, then fail uniformly.
    const ok = staff ? await verifyPassword(input.password, staff.passwordHash) : false;
    if (!staff || !staff.isActive || !ok) {
      throw new UnauthorizedError("Invalid credentials");
    }
    const pair = await issuePair(staff);
    await recordAudit({
      actorStaffId: staff.id,
      propertyId: staff.propertyId,
      action: "LOGIN",
      entityType: "Staff",
      entityId: staff.id,
    });
    return pair;
  },

  /** Rotate the refresh token: revoke the presented one, issue a fresh pair. */
  async refresh(input: RefreshInput): Promise<TokenPair> {
    const existing = await authRepository.findValidRefreshToken(hashRefreshToken(input.refreshToken));
    if (!existing) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }
    if (!existing.staffId) {
      throw new UnauthorizedError("Token does not belong to a staff account");
    }
    const staff = await authRepository.findStaffById(existing.staffId);
    if (!staff || !staff.isActive) {
      throw new UnauthorizedError("Account is inactive");
    }
    await authRepository.revokeRefreshTokenById(existing.id);
    return issuePair(staff);
  },

  async logout(input: LogoutInput): Promise<void> {
    await authRepository.revokeRefreshTokenByHash(hashRefreshToken(input.refreshToken));
  },

  async getProfile(staffId: string): Promise<StaffProfile> {
    const staff = await authRepository.findStaffById(staffId);
    if (!staff) throw new NotFoundError("Staff not found");
    return toProfile(staff);
  },

  async listStaff(ctx: { role: StaffRole; propertyId: string }, role?: StaffRole): Promise<StaffProfile[]> {
    requireCapability(ctx.role, "appointment:read");
    const rows = await authRepository.listStaff({ propertyId: ctx.propertyId, role });
    return rows.map(toProfile);
  },
};
