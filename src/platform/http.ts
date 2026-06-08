import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError, ValidationError } from "@/platform/errors";

/**
 * Consistent JSON envelope for the whole API.
 * Success: { data, error: null, meta? }
 * Failure: { data: null, error: { code, message, details? } }
 */
export interface ListMeta {
  page: number;
  pageSize: number;
  total: number;
}

export function ok<T>(data: T, meta?: ListMeta): NextResponse {
  return NextResponse.json({ data, error: null, ...(meta ? { meta } : {}) }, { status: 200 });
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json({ data, error: null }, { status: 201 });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

function errorResponse(status: number, code: string, message: string, details?: unknown): NextResponse {
  return NextResponse.json({ data: null, error: { code, message, details } }, { status });
}

/**
 * Map any thrown value to an error envelope. ZodErrors become 422; AppErrors use
 * their declared status; anything else is a 500 with a generic message.
 */
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return errorResponse(422, "VALIDATION_ERROR", "Invalid request", err.flatten());
  }
  if (err instanceof AppError) {
    return errorResponse(err.status, err.code, err.message, err.details);
  }
  console.error("Unhandled error:", err);
  return errorResponse(500, "INTERNAL_ERROR", "Internal server error");
}

/**
 * Wrap a route handler so thrown AppErrors/ZodErrors become proper responses.
 * Usage: export const POST = handle(async (req) => { ... return ok(data) });
 */
export function handle<Args extends unknown[]>(
  fn: (req: Request, ...args: Args) => Promise<NextResponse>,
): (req: Request, ...args: Args) => Promise<NextResponse> {
  return async (req, ...args) => {
    try {
      return await fn(req, ...args);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

/** Parse + validate a JSON body with a zod schema, throwing ValidationError on bad JSON. */
export async function parseJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
}
