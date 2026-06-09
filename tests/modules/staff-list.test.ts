import { describe, it, expect, vi, beforeEach } from "vitest";

const staffRows = [
  { id: "t1", email: "a@x.io", role: "THERAPIST", firstName: "Ann", lastName: "Lee", isActive: true, propertyId: "p1", passwordHash: "h" },
  { id: "t2", email: "b@x.io", role: "THERAPIST", firstName: "Bo", lastName: "Ng", isActive: true, propertyId: "p1", passwordHash: "h" },
];

vi.mock("@/modules/auth/auth.repository", () => ({
  authRepository: { listStaff: vi.fn(async () => staffRows) },
}));

import { authService } from "@/modules/auth/auth.service";

const ctx = { kind: "staff" as const, staffId: "r1", role: "RECEPTION" as const, propertyId: "p1" };

describe("authService.listStaff", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns profile-safe rows (no passwordHash) for a capable role", async () => {
    const out = await authService.listStaff(ctx, "THERAPIST");
    expect(out).toHaveLength(2);
    expect(out[0]).not.toHaveProperty("passwordHash");
    expect(out[0]).toMatchObject({ id: "t1", firstName: "Ann", role: "THERAPIST" });
  });

  it("rejects a role lacking appointment:read", async () => {
    const hk = { ...ctx, role: "HOUSEKEEPING" as const };
    await expect(authService.listStaff(hk, "THERAPIST")).rejects.toThrow();
  });
});
