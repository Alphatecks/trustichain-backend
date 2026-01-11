import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { asyncHandler } from '../utils/asyncHandler';


/**
 * Authentication middleware to verify Supabase JWT token
 * Extracts user ID from token and attaches it to request object
 */
const authenticateMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Authorization token required. Please provide a valid Bearer token.',
      error: 'Unauthorized',
    });
    return;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  // Verify token with Supabase
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token. Please log in again.',
      error: 'Unauthorized',
    });
    return;
  }

  // Attach user info to request object
  req.userId = user.id;
  req.user = {
    id: user.id,
    email: user.email || '',
  };

  next();
};

// Export wrapped version that properly handles async errors
export const authenticate = asyncHandler(authenticateMiddleware);


