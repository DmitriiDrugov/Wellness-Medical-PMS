// tests/web/mutation-error.test.ts
import { describe, it, expect } from "vitest";
import { ApiError } from "@/web/api-client";
import { classifyMutationError } from "@/web/form-errors";

describe("classifyMutationError", () => {
  it("maps a Zod 422 (fieldErrors) to per-field messages, no banner", () => {
    const err = new ApiError(422, "VALIDATION_ERROR", "Invalid request", {
      formErrors: [],
      fieldErrors: { treatmentId: ["Required"] },
    });
    expect(classifyMutationError(err)).toEqual({
      error: null,
      fieldErrors: { treatmentId: "Required" },
    });
  });

  it("surfaces a domain ValidationError (422 without fieldErrors) as a banner message", () => {
    // e.g. appointments.service "Treatment requires a SAUNA resource" — details is undefined.
    const err = new ApiError(422, "VALIDATION_ERROR", "Treatment requires a SAUNA resource");
    expect(classifyMutationError(err)).toEqual({
      error: "Treatment requires a SAUNA resource",
      fieldErrors: {},
    });
  });

  it("surfaces a non-422 ApiError (e.g. 409 conflict) as a banner message", () => {
    const err = new ApiError(409, "CONFLICT", "Therapist is already booked for this time slot");
    expect(classifyMutationError(err)).toEqual({
      error: "Therapist is already booked for this time slot",
      fieldErrors: {},
    });
  });

  it("falls back to a generic message for non-ApiError throwables", () => {
    expect(classifyMutationError(new Error("boom"))).toEqual({
      error: "Something went wrong. Please try again.",
      fieldErrors: {},
    });
  });
});
