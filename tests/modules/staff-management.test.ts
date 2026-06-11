import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression guards for staff management (staff:manage — ADMIN only):
 *  - create hashes the password, rejects duplicate emails, never audits the hash;
 *  - lockout protection: you cannot deactivate yourself or change your own role;
 *  - the AI_AGENT principal is not editable through this surface;
 *  - deactivation and password reset revoke every live refresh token;
 *  - only ADMIN holds staff:manage (MANAGER is everything BUT staff management).
 */

const admin = { staffId: "adm1", role: "ADMIN" as const, propertyId: "p1" };

const existingStaff = {
  id: "s2",
  propertyId: "p1",
  email: "reception@hotel.example",
  passwordHash: "old-hash",
  role: "RECEPTION",
  firstName: "Rita",
  lastName: "Front",
  isActive: true,
};

const { repo } = vi.hoisted(() => ({
  repo: {
    findStaffByEmail: vi.fn(async (): Promise<Record<string, unknown> | null> => null),
    findStaffById: vi.fn(),
    createStaff: vi.fn(async (data: object) => ({ id: "new1", isActive: true, ...data })),
    updateStaff: vi.fn(async (id: string, data: object) => ({ ...existingStaff, id, ...data })),
    revokeAllStaffRefreshTokens: vi.fn(async () => ({ count: 1 })),
    listStaff: vi.fn(async () => [existingStaff]),
  },
}));

const { recordAudit } = vi.hoisted(() => ({
  recordAudit: vi.fn(async (_entry: { after?: Record<string, unknown> }) => {}),
}));

vi.mock("@/platform/audit", () => ({ recordAudit }));
vi.mock("@/platform/events", () => ({ eventBus: { emit: vi.fn() } }));
vi.mock("@/modules/auth/auth.repository", () => ({ authRepository: repo }));

import { authService } from "@/modules/auth/auth.service";
import { can } from "@/platform/rbac";
import { verifyPassword } from "@/platform/auth/password";

beforeEach(() => {
  vi.clearAllMocks();
  repo.findStaffByEmail.mockResolvedValue(null);
  repo.findStaffById.mockResolvedValue({ ...existingStaff });
});

describe("createStaff", () => {
  const input = {
    email: "new@hotel.example",
    password: "Sup3rSecret",
    role: "THERAPIST" as const,
    firstName: "Nora",
    lastName: "Hands",
  };

  it("stores a bcrypt hash, never the plain password", async () => {
    await authService.createStaff(admin, input);
    const data = repo.createStaff.mock.calls[0]![0] as { passwordHash: string };
    expect(data.passwordHash).not.toBe(input.password);
    await expect(verifyPassword(input.password, data.passwordHash)).resolves.toBe(true);
  });

  it("rejects a duplicate email with a 409", async () => {
    repo.findStaffByEmail.mockResolvedValue(existingStaff);
    await expect(authService.createStaff(admin, input)).rejects.toMatchObject({ status: 409 });
  });

  it("keeps the password hash out of the audit trail", async () => {
    await authService.createStaff(admin, input);
    const entry = recordAudit.mock.calls[0]![0];
    expect(entry.after?.passwordHash).toBeUndefined();
  });

  it("is forbidden for MANAGER (staff:manage is ADMIN-only)", async () => {
    await expect(
      authService.createStaff({ ...admin, role: "MANAGER" }, input),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("updateStaff guards", () => {
  it("blocks deactivating your own account", async () => {
    repo.findStaffById.mockResolvedValue({ ...existingStaff, id: "adm1", role: "ADMIN" });
    await expect(authService.updateStaff(admin, "adm1", { isActive: false })).rejects.toMatchObject({ status: 409 });
  });

  it("blocks changing your own role", async () => {
    repo.findStaffById.mockResolvedValue({ ...existingStaff, id: "adm1", role: "ADMIN" });
    await expect(authService.updateStaff(admin, "adm1", { role: "RECEPTION" })).rejects.toMatchObject({ status: 409 });
  });

  it("refuses to edit the AI_AGENT principal", async () => {
    repo.findStaffById.mockResolvedValue({ ...existingStaff, role: "AI_AGENT" });
    await expect(authService.updateStaff(admin, "s2", { isActive: false })).rejects.toMatchObject({ status: 409 });
  });

  it("hides staff of another property (404)", async () => {
    repo.findStaffById.mockResolvedValue({ ...existingStaff, propertyId: "p2" });
    await expect(authService.updateStaff(admin, "s2", { firstName: "X" })).rejects.toMatchObject({ status: 404 });
  });
});

describe("session revocation", () => {
  it("revokes all refresh tokens on deactivation", async () => {
    await authService.updateStaff(admin, "s2", { isActive: false });
    expect(repo.revokeAllStaffRefreshTokens).toHaveBeenCalledWith("s2");
  });

  it("revokes all refresh tokens on password reset", async () => {
    await authService.updateStaff(admin, "s2", { password: "NewSecret123" });
    expect(repo.revokeAllStaffRefreshTokens).toHaveBeenCalledWith("s2");
  });

  it("does NOT revoke sessions on a plain rename", async () => {
    await authService.updateStaff(admin, "s2", { firstName: "Renata" });
    expect(repo.revokeAllStaffRefreshTokens).not.toHaveBeenCalled();
  });
});

describe("rbac", () => {
  it("only ADMIN holds staff:manage", () => {
    expect(can("ADMIN", "staff:manage")).toBe(true);
    expect(can("MANAGER", "staff:manage")).toBe(false);
    expect(can("RECEPTION", "staff:manage")).toBe(false);
  });
});
