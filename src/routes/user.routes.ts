import { Router } from 'express';
import multer from 'multer';
import { userController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

const profilePhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB — must match storage USER_PROFILE_PHOTO_MAX_BYTES
});

/**
 * @route   GET /api/user/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile', authenticate, asyncHandler(async (req, res) => {
  await userController.getUserProfile(req, res);
}));

/**
 * @route   POST /api/user/profile/photo
 * @desc    Upload profile picture (multipart field "photo"; JPEG, PNG, GIF, WebP, HEIC)
 * @access  Private
 */
router.post(
  '/profile/photo',
  authenticate,
  profilePhotoUpload.single('photo'),
  asyncHandler(async (req, res) => {
    await userController.uploadProfilePhoto(req, res);
  })
);

/**
 * @route   GET /api/user/linked-accounts
 * @desc    Get user linked accounts
 * @access  Private
 */
router.get('/linked-accounts', authenticate, asyncHandler(async (req, res) => {
  await userController.getLinkedAccounts(req, res);
}));

/**
 * @route   GET /api/user/beneficiaries
 * @desc    Get user beneficiaries
 * @access  Private
 */
router.get('/beneficiaries', authenticate, asyncHandler(async (req, res) => {
  await userController.getBeneficiaries(req, res);
}));

export default router;


