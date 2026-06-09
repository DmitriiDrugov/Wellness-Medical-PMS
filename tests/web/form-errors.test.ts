// tests/web/form-errors.test.ts
import { describe, it, expect } from "vitest";
import { toFieldErrors } from "@/web/form-errors";

describe("toFieldErrors", () => {
  it("maps a ZodError.flatten() shape to first message per field", () => {
    const details = {
      formErrors: [],
      fieldErrors: { email: ["Invalid email"], firstName: ["Required", "Too short"] },
    };
    expect(toFieldErrors(details)).toEqual({ email: "Invalid email", firstName: "Required" });
  });

  it("returns an empty object for missing/odd shapes", () => {
    expect(toFieldErrors(undefined)).toEqual({});
    expect(toFieldErrors(null)).toEqual({});
    expect(toFieldErrors({ formErrors: ["bad"] })).toEqual({});
    expect(toFieldErrors({ fieldErrors: { x: [] } })).toEqual({});
  });
});
