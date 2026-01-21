import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/supabase';
import { asyncHandler } from '../../utils/asyncHandler';

/**
 * Admin authentication middleware to verify Supabase JWT token and admin status
 * Extracts admin ID from token and verifies admin privileges
 */
const adminAuthenticateMiddleware = async (
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

  // Verify that the user is an admin
  const { data: adminData, error: adminError } = await supabase
    .from('admins')
    .select('id, email, full_name')
    .eq('id', user.id)
    .eq('is_active', true)
    .single();

  if (adminError || !adminData) {
    res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.',
      error: 'Forbidden',
    });
    return;
  }

  // Attach admin info to request object
  req.userId = user.id;
  req.user = {
    id: user.id,
    email: user.email || '',
  };
  
  // Add admin-specific data
  req.admin = {
    id: adminData.id,
    email: adminData.email,
    fullName: adminData.full_name,
  };

  next();
};

// Export wrapped version that properly handles async errors
export const adminAuthenticate = asyncHandler(adminAuthenticateMiddleware);
