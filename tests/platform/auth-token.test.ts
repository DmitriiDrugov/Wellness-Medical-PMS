import { describe, it, expect } from "vitest";
import {
  issueAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from "@/platform/auth/jwt";
import { hashPassword, verifyPassword } from "@/platform/auth/password";
import { UnauthorizedError } from "@/platform/errors";

describe("access tokens", () => {
  it("round-trips claims through issue/verify", () => {
    const token = issueAccessToken({ sub: "staff_1", role: "MANAGER", propertyId: "prop_1" });
    const claims = verifyAccessToken(token);
    expect(claims).toMatchObject({ sub: "staff_1", role: "MANAGER", propertyId: "prop_1" });
  });

  it("rejects a tampered/invalid token with UnauthorizedError", () => {
    expect(() => verifyAccessToken("not-a-real-token")).toThrow(UnauthorizedError);
  });
});

describe("refresh tokens", () => {
  it("generates a raw token whose sha-256 hash is stable and matches", () => {
    const { raw, hash } = generateRefreshToken();
    expect(raw).toBeTruthy();
    expect(hashRefreshToken(raw)).toBe(hash);
  });

  it("produces distinct tokens each call", () => {
    expect(generateRefreshToken().raw).not.toBe(generateRefreshToken().raw);
  });
});

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("Passw0rd!");
    expect(await verifyPassword("Passw0rd!", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});
