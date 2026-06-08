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
});
