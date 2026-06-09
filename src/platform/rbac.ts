import type { StaffRole } from "@prisma/client";
import { ForbiddenError } from "@/platform/errors";

/**
 * Capability-based RBAC. Roles are granted a set of capabilities; services and
 * routes check capabilities, not role names directly. Row-level "own only" rules
 * (e.g. a therapist may only touch their own appointments) are NOT expressed here
 * — the capability is granted and the service adds the ownership filter.
 *
 * Mirrors the RBAC matrix in the design spec (§7).
 */
export type Capability =
  | "guest:read"
  | "guest:write"
  | "reservation:read"
  | "reservation:write"
  | "catalog:read"
  | "catalog:manage"
  | "appointment:read"
  | "appointment:write"
  | "appointment:complete"
  | "housekeeping:read"
  | "housekeeping:manage"
  | "folio:read"
  | "folio:write"
  | "folio:close"
  | "report:read"
  | "audit:read"
  | "compliance:manage"
  | "staff:manage"
  // Phase 6 — clinical
  | "forms:manage"
  | "submission:write"
  | "clinical:read"
  | "clinical:write"
  | "consent:write"
  | "consent:read"
  | "consent:status:read"
  | "messaging:read"
  | "messaging:write";

const ALL: Capability[] = [
  "guest:read", "guest:write",
  "reservation:read", "reservation:write",
  "catalog:read", "catalog:manage",
  "appointment:read", "appointment:write", "appointment:complete",
  "housekeeping:read", "housekeeping:manage",
  "folio:read", "folio:write", "folio:close",
  "report:read", "audit:read", "compliance:manage", "staff:manage",
  "forms:manage", "submission:write",
  "clinical:read", "clinical:write",
  "consent:write", "consent:read", "consent:status:read",
  "messaging:read", "messaging:write",
];

const MATRIX: Record<StaffRole, Capability[]> = {
  RECEPTION: [
    "guest:read", "guest:write",
    "reservation:read", "reservation:write",
    "catalog:read",
    "appointment:read", "appointment:write",
    "folio:read", "folio:write", "folio:close",
    "submission:write", "consent:write", "consent:status:read",
    "messaging:read", "messaging:write",
  ],
  RESERVATION_ADMIN: [
    "guest:read", "guest:write",
    "reservation:read", "reservation:write",
    "catalog:read",
    "appointment:read", "appointment:write",
    "folio:read", "folio:write",
    "report:read",
    "submission:write", "consent:status:read",
    "messaging:read", "messaging:write",
  ],
  THERAPIST: [
    "guest:read",
    "catalog:read",
    "appointment:read", "appointment:write", "appointment:complete",
    "submission:write",
    "clinical:read", "clinical:write",
    "consent:write", "consent:read", "consent:status:read",
    "messaging:read",
  ],
  HOUSEKEEPING: [
    "housekeeping:read", "housekeeping:manage",
  ],
  MANAGER: ALL.filter((c) => c !== "staff:manage"),
  ADMIN: [...ALL],
  AI_AGENT: [
    "messaging:read", "messaging:write",
    "reservation:read", "reservation:write",
    "appointment:read", "appointment:write",
    "catalog:read",
  ],
};

export function can(role: StaffRole, capability: Capability): boolean {
  return MATRIX[role].includes(capability);
}

/** Throw ForbiddenError unless the role has the capability. */
export function requireCapability(role: StaffRole, capability: Capability): void {
  if (!can(role, capability)) {
    throw new ForbiddenError(`Role ${role} lacks capability ${capability}`);
  }
}

export const rbacMatrix = MATRIX;
