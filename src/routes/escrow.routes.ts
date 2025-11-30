import { Router } from 'express';
import { escrowController } from '../controllers/escrow.controller';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * @route   GET /api/escrow/active
 * @desc    Get active escrows count and locked amount
 * @access  Private
 */
router.get('/active', authenticate, asyncHandler(async (req, res) => {
  await escrowController.getActiveEscrows(req, res);
}));

/**
 * @route   GET /api/escrow/total
 * @desc    Get total escrowed amount
 * @access  Private
 */
router.get('/total', authenticate, asyncHandler(async (req, res) => {
  await escrowController.getTotalEscrowed(req, res);
}));

/**
 * @route   POST /api/escrow/create
 * @desc    Create a new escrow
 * @access  Private
 * @body    { counterpartyId: string, amount: number, currency: 'USD' | 'XRP', description?: string }
 */
router.post('/create', authenticate, asyncHandler(async (req, res) => {
  await escrowController.createEscrow(req, res);
}));

/**
 * @route   GET /api/escrow/completed/month
 * @desc    Get completed escrows count for the current month
 * @access  Private
 */
router.get('/completed/month', authenticate, asyncHandler(async (req, res) => {
  await escrowController.getCompletedEscrowsForMonth(req, res);
}));

/**
 * @route   GET /api/escrow/list
 * @desc    Get escrow list
 * @access  Private
 * @query   limit, offset
 */
router.get('/list', authenticate, asyncHandler(async (req, res) => {
  await escrowController.getEscrowList(req, res);
}));

export default router;


