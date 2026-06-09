import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { StaffRole } from "@prisma/client";
import { config } from "@/platform/config";
import { UnauthorizedError } from "@/platform/errors";

/** Claims carried in the access token (and the request auth context). */
export interface AccessTokenClaims {
  sub: string; // staff id
  role: StaffRole;
  propertyId: string;
}

export function issueAccessToken(claims: AccessTokenClaims): string {
  return jwt.sign(claims, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessTtlSeconds,
  });
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret);
    if (typeof decoded === "string") throw new Error("Unexpected token payload");
    const { sub, role, propertyId } = decoded as jwt.JwtPayload & Partial<AccessTokenClaims>;
    if (!sub || !role || !propertyId) throw new Error("Missing claims");
    return { sub, role: role as StaffRole, propertyId };
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }
}

/**
 * Refresh tokens are opaque high-entropy strings (not JWTs). We store only their
 * SHA-256 hash in the DB, which allows O(1) lookup and revocation on logout /
 * staff deactivation. Returns the raw token (given to the client) and its hash.
 */
export function generateRefreshToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(48).toString("base64url");
  return { raw, hash: hashRefreshToken(raw) };
}

export function hashRefreshToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + config.jwt.refreshTtlSeconds * 1000);
}

/** Claims carried in a GUEST access token. */
export interface GuestTokenClaims {
  sub: string; // guestAccountId
  guestId: string;
  propertyId: string;
  kind: "guest";
}

export function issueGuestAccessToken(claims: Omit<GuestTokenClaims, "kind">): string {
  return jwt.sign({ ...claims, kind: "guest" }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessTtlSeconds,
  });
}

export function verifyGuestAccessToken(token: string): GuestTokenClaims {
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret);
    if (typeof decoded === "string") throw new Error("Unexpected token payload");
    const d = decoded as jwt.JwtPayload & Partial<GuestTokenClaims>;
    if (!d.sub || !d.guestId || !d.propertyId || d.kind !== "guest") throw new Error("Missing claims");
    return { sub: d.sub, guestId: d.guestId, propertyId: d.propertyId, kind: "guest" };
  } catch {
    throw new UnauthorizedError("Invalid or expired guest token");
  }
}
