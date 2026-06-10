export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = []) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}

export const notFound = (resource = 'Resource') =>
  new AppError(`${resource} not found`, 404, 'NOT_FOUND');

export const unauthorized = (message = 'Unauthorized') =>
  new AppError(message, 401, 'UNAUTHORIZED');

export const forbidden = (message = 'Forbidden') =>
  new AppError(message, 403, 'FORBIDDEN');

export const badRequest = (message, details = []) =>
  new AppError(message, 400, 'BAD_REQUEST', details);

export const conflict = (message) =>
  new AppError(message, 409, 'CONFLICT');
