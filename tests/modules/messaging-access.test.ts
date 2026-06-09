import { describe, it, expect } from "vitest";
import { canStaffAccessConversation, assertGuestOwnsConversation } from "@/modules/messaging/access";
import { ForbiddenError } from "@/platform/errors";

describe("messaging access", () => {
  const conv = { guestId: "g1" };

  it("lets reception/manager access any conversation", () => {
    expect(canStaffAccessConversation("RECEPTION", "s1", conv, false)).toBe(true);
    expect(canStaffAccessConversation("MANAGER", "s1", conv, false)).toBe(true);
  });

  it("lets a therapist access only their own guest's conversation", () => {
    expect(canStaffAccessConversation("THERAPIST", "t1", conv, true)).toBe(true);
    expect(canStaffAccessConversation("THERAPIST", "t1", conv, false)).toBe(false);
  });

  it("denies housekeeping", () => {
    expect(canStaffAccessConversation("HOUSEKEEPING", "s1", conv, true)).toBe(false);
  });

  it("guest ownership: matches guestId, else 403", () => {
    expect(() => assertGuestOwnsConversation("g1", conv)).not.toThrow();
    expect(() => assertGuestOwnsConversation("other", conv)).toThrow(ForbiddenError);
  });
});
