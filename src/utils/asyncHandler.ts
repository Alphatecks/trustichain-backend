import { Request, Response, NextFunction } from 'express';

/**
 * Wraps async route handlers and middleware to properly catch errors
 * and pass them to Express's error handler
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, nextFn: NextFunction) => {
    Promise.resolve(fn(req, res, nextFn)).catch((err) => nextFn(err));
  };
};
