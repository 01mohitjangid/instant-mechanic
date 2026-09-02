/**
 * One error type for anything the API deliberately refuses.
 *
 * Routes throw these; the error middleware is the only place that decides how
 * an error becomes a response body. Anything else that escapes a handler is an
 * unexpected bug and becomes a 500 with no internal detail leaked.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: { path: string; message: string }[];

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: { path: string; message: string }[]
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    if (details) this.details = details;
  }

  static badRequest(message: string): ApiError {
    return new ApiError(400, 'BAD_REQUEST', message);
  }

  static notFound(resource: string, id: string | number): ApiError {
    return new ApiError(404, 'NOT_FOUND', `${resource} ${id} was not found`);
  }

  static validation(details: { path: string; message: string }[]): ApiError {
    return new ApiError(422, 'VALIDATION_FAILED', 'Some query parameters are invalid', details);
  }
}
