import logger from '../utils/logger.js';
import { AppError } from '../utils/app-error.js';

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'ROUTE_NOT_FOUND', message: `Route ${req.method} ${req.path} not found` },
    requestId: req.requestId,
  });
};

export const errorHandler = (err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';

  if (statusCode >= 500) {
    logger.error({ err, requestId: req.requestId, path: req.path }, err.message);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: err.message || 'Internal server error',
      details: err.details || [],
    },
    requestId: req.requestId,
  });
};
