import { describe, it, expect } from "vitest";
import { can, requireCapability } from "@/platform/rbac";
import { ForbiddenError } from "@/platform/errors";

describe("RBAC capability matrix", () => {
  it("grants ADMIN every capability including staff:manage", () => {
    expect(can("ADMIN", "staff:manage")).toBe(true);
    expect(can("ADMIN", "compliance:manage")).toBe(true);
    expect(can("ADMIN", "folio:close")).toBe(true);
  });

  it("grants MANAGER everything except staff:manage", () => {
    expect(can("MANAGER", "staff:manage")).toBe(false);
    expect(can("MANAGER", "compliance:manage")).toBe(true);
    expect(can("MANAGER", "report:read")).toBe(true);
  });

  it("scopes RECEPTION to front-desk capabilities", () => {
    expect(can("RECEPTION", "reservation:write")).toBe(true);
    expect(can("RECEPTION", "folio:close")).toBe(true);
    expect(can("RECEPTION", "report:read")).toBe(false);
    expect(can("RECEPTION", "compliance:manage")).toBe(false);
    expect(can("RECEPTION", "catalog:manage")).toBe(false);
  });

  it("restricts audit:read (audit-log viewer) to MANAGER and ADMIN", () => {
    expect(can("ADMIN", "audit:read")).toBe(true);
    expect(can("MANAGER", "audit:read")).toBe(true);
    expect(can("RECEPTION", "audit:read")).toBe(false);
    expect(can("THERAPIST", "audit:read")).toBe(false);
    expect(can("HOUSEKEEPING", "audit:read")).toBe(false);
  });

  it("lets RESERVATION_ADMIN read reports but not close folios", () => {
    expect(can("RESERVATION_ADMIN", "report:read")).toBe(true);
    expect(can("RESERVATION_ADMIN", "folio:close")).toBe(false);
  });

  it("restricts THERAPIST to appointment + read capabilities", () => {
    expect(can("THERAPIST", "appointment:write")).toBe(true);
    expect(can("THERAPIST", "appointment:complete")).toBe(true);
    expect(can("THERAPIST", "guest:read")).toBe(true);
    expect(can("THERAPIST", "guest:write")).toBe(false);
    expect(can("THERAPIST", "reservation:write")).toBe(false);
  });

  it("restricts HOUSEKEEPING to housekeeping capabilities", () => {
    expect(can("HOUSEKEEPING", "housekeeping:manage")).toBe(true);
    expect(can("HOUSEKEEPING", "reservation:read")).toBe(false);
    expect(can("HOUSEKEEPING", "folio:read")).toBe(false);
  });

  it("requireCapability throws ForbiddenError when denied", () => {
    expect(() => requireCapability("THERAPIST", "reservation:write")).toThrow(ForbiddenError);
    expect(() => requireCapability("ADMIN", "staff:manage")).not.toThrow();
  });

  it("grants messaging to front desk + management, scopes therapist, denies housekeeping", () => {
    expect(can("RECEPTION", "messaging:write")).toBe(true);
    expect(can("MANAGER", "messaging:read")).toBe(true);
    expect(can("THERAPIST", "messaging:read")).toBe(true); // service adds own-guest scope
    expect(can("HOUSEKEEPING", "messaging:read")).toBe(false);
  });

  it("gives AI_AGENT a least-privilege booking zone and nothing destructive/financial", () => {
    expect(can("AI_AGENT", "messaging:write")).toBe(true);
    expect(can("AI_AGENT", "reservation:write")).toBe(true);
    expect(can("AI_AGENT", "appointment:write")).toBe(true);
    expect(can("AI_AGENT", "catalog:read")).toBe(true);
    expect(can("AI_AGENT", "folio:write")).toBe(false);
    expect(can("AI_AGENT", "folio:close")).toBe(false);
    expect(can("AI_AGENT", "clinical:read")).toBe(false);
    expect(can("AI_AGENT", "staff:manage")).toBe(false);
  });
});
