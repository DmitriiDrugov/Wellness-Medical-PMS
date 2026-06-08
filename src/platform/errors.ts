/**
 * Typed application error hierarchy. Services throw these; the HTTP layer
 * (src/platform/http.ts) maps each to a status code + error envelope.
 */
export abstract class AppError extends Error {
  abstract readonly status: number;
  abstract readonly code: string;
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  readonly status = 422;
  readonly code = "VALIDATION_ERROR";
}

export class UnauthorizedError extends AppError {
  readonly status = 401;
  readonly code = "UNAUTHORIZED";
}

export class ForbiddenError extends AppError {
  readonly status = 403;
  readonly code = "FORBIDDEN";
}

export class NotFoundError extends AppError {
  readonly status = 404;
  readonly code = "NOT_FOUND";
}

export class ConflictError extends AppError {
  readonly status = 409;
  readonly code = "CONFLICT";
}
