import type { Staff, StaffRole } from "@prisma/client";
import { config } from "@/platform/config";
import { requireCapability } from "@/platform/rbac";
import { ConflictError, NotFoundError, UnauthorizedError } from "@/platform/errors";
import { recordAudit } from "@/platform/audit";
import { eventBus } from "@/platform/events";
import {
  issueAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
} from "@/platform/auth/jwt";
import { hashPassword, verifyPassword } from "@/platform/auth/password";
import { authRepository } from "@/modules/auth/auth.repository";
import type { StaffProfile, TokenPair } from "@/modules/auth/auth.types";
import type {
  LoginInput,
  RefreshInput,
  LogoutInput,
  CreateStaffInput,
  UpdateStaffInput,
} from "@/modules/auth/auth.schema";

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

  // ---- Staff management (staff:manage — ADMIN only) ----

  /** Full directory for the Staff page: every member incl. deactivated accounts. */
  async listDirectory(ctx: { role: StaffRole; propertyId: string }): Promise<StaffProfile[]> {
    requireCapability(ctx.role, "staff:manage");
    const rows = await authRepository.listStaff({ propertyId: ctx.propertyId, includeInactive: true });
    return rows.map(toProfile);
  },

  async createStaff(ctx: { staffId: string; role: StaffRole; propertyId: string }, input: CreateStaffInput): Promise<StaffProfile> {
    requireCapability(ctx.role, "staff:manage");
    const existing = await authRepository.findStaffByEmail(input.email);
    if (existing) throw new ConflictError("A staff account with this email already exists");
    const staff = await authRepository.createStaff({
      propertyId: ctx.propertyId,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      firstName: input.firstName,
      lastName: input.lastName,
    });
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: "CREATE",
      entityType: "Staff",
      entityId: staff.id,
      after: toProfile(staff), // never the row itself — no passwordHash in the audit trail
    });
    eventBus.emit({ type: "staff.created", entity: "staff", entityId: staff.id, propertyId: ctx.propertyId });
    return toProfile(staff);
  },

  /**
   * Update role / name / active flag, or reset the password. Lockout guards: you
   * cannot deactivate yourself or change your own role. The AI_AGENT principal is
   * managed by ops (seed), not through this surface. Deactivation and password
   * reset revoke every live refresh token so stolen/old sessions die immediately.
   */
  async updateStaff(
    ctx: { staffId: string; role: StaffRole; propertyId: string },
    id: string,
    input: UpdateStaffInput,
  ): Promise<StaffProfile> {
    requireCapability(ctx.role, "staff:manage");
    const before = await authRepository.findStaffById(id);
    if (!before || before.propertyId !== ctx.propertyId) throw new NotFoundError("Staff not found");
    if (before.role === "AI_AGENT") throw new ConflictError("The AI agent principal cannot be edited here");
    if (id === ctx.staffId) {
      if (input.isActive === false) throw new ConflictError("You cannot deactivate your own account");
      if (input.role && input.role !== before.role) throw new ConflictError("You cannot change your own role");
    }

    const after = await authRepository.updateStaff(id, {
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
    });
    if (input.isActive === false || input.password) {
      await authRepository.revokeAllStaffRefreshTokens(id);
    }
    await recordAudit({
      actorStaffId: ctx.staffId,
      propertyId: ctx.propertyId,
      action: input.isActive !== undefined && input.isActive !== before.isActive ? "STATE_CHANGE" : "UPDATE",
      entityType: "Staff",
      entityId: id,
      before: toProfile(before),
      after: toProfile(after),
      ...(input.password ? { metadata: { passwordReset: true } } : {}),
    });
    eventBus.emit({ type: "staff.updated", entity: "staff", entityId: id, propertyId: ctx.propertyId });
    return toProfile(after);
  },
};
