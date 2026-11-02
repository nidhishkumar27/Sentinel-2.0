import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

export const notFound = (req: Request, _res: Response, next: NextFunction) =>
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`, undefined, 'ROUTE_NOT_FOUND'));

/**
 * Every error leaves the API in one shape:
 * { success:false, error:{ code, message, details? }, requestId }
 */
export const errorHandler = (err: any, req: Request, res: Response, _next: NextFunction) => {
  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  let details: unknown;

  if (err instanceof ApiError) {
    status = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err?.code === 11000) {
    status = 409;
    code = 'DUPLICATE';
    message = `Duplicate value for: ${Object.keys(err.keyValue || {}).join(', ')}`;
  } else if (err?.name === 'CastError') {
    status = 400;
    code = 'INVALID_ID';
    message = 'Invalid identifier';
  } else if (err?.name === 'ValidationError') {
    status = 400;
    code = 'VALIDATION_FAILED';
    message = err.message;
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Malformed JSON body';
  }

  if (status >= 500) logger.error(`[${req.id}]`, err);
  res.status(status).json({
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
    requestId: req.id,
    ...(env.NODE_ENV === 'development' && status >= 500 ? { stack: err?.stack } : {}),
  });
};
