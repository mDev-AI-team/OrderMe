import type { Request, Response, NextFunction } from 'express';
import type pino from 'pino';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function createErrorHandler(logger: pino.Logger) {
  return (err: AppError, _req: Request, res: Response, _next: NextFunction): void => {
    const statusCode = err.statusCode ?? 500;
    const isOperational = err.isOperational ?? false;

    if (!isOperational) {
      logger.error({ err }, 'Unhandled error');
    }

    res.status(statusCode).json({
      success: false,
      error: statusCode >= 500 ? 'Internal server error' : err.message,
    });
  };
}
