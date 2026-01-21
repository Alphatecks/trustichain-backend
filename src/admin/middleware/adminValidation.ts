import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { AdminLoginRequest, AdminLoginResponse } from '../../types/api/admin.types';

// Admin login validation schema
const adminLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const validateAdminLogin = (
  req: Request<{}, AdminLoginResponse, AdminLoginRequest>,
  res: Response<AdminLoginResponse>,
  next: NextFunction
): void => {
  try {
    adminLoginSchema.parse(req.body);
    next();
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      const firstError = error.issues[0];
      res.status(400).json({
        success: false,
        message: firstError.message,
        error: 'Validation failed',
      });
    } else if (error && typeof error === 'object' && 'message' in error) {
      res.status(400).json({
        success: false,
        message: (error as any).message || 'Invalid request data',
        error: 'Validation failed',
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid request data',
        error: 'Validation failed',
      });
    }
  }
};
