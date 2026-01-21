import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { validateAdminLogin } from '../middleware/adminValidation';
import { adminAuthenticate } from '../middleware/adminAuth';
import { asyncHandler } from '../../utils/asyncHandler';

const router = Router();

/**
 * @route   POST /api/admin/login
 * @desc    Login an admin user
 * @access  Public
 * @body    { email, password }
 */
router.post('/login', validateAdminLogin, asyncHandler(async (req, res) => {
  await adminController.login(req, res);
}));

/**
 * @route   POST /api/admin/logout
 * @desc    Logout an admin user (invalidates session)
 * @access  Private (requires admin authentication)
 * @header  Authorization: Bearer <access_token>
 */
router.post('/logout', adminAuthenticate, asyncHandler(async (req, res) => {
  await adminController.logout(req, res);
}));

export default router;
