import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { RegisterRequest } from '../types/api/auth.types';

// Registration validation schema
const registerSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    fullName: z
      .string()
      .min(2, 'Full name must be at least 2 characters')
      .max(100, 'Full name must be less than 100 characters')
      .regex(/^[a-zA-Z\s'-]+$/, 'Full name can only contain letters, spaces, hyphens, and apostrophes'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    confirmPassword: z.string(),
    country: z
      .string()
      .min(2, 'Country code must be at least 2 characters')
      .max(100, 'Country name must be less than 100 characters'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export const validateRegister = (
  req: Request<{}, RegisterResponse, RegisterRequest>,
  res: Response<RegisterResponse>,
  next: NextFunction
): void => {
  try {
    registerSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const firstError = error.errors[0];
      res.status(400).json({
        success: false,
        message: firstError.message,
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


