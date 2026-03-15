/**
 * Cron / scheduled job endpoints. Protected by CRON_SECRET (header X-Cron-Secret or Authorization: Bearer <CRON_SECRET>).
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { escrowService } from '../services/escrow/escrow.service';

const router = Router();

function cronSecretAuth(req: Request, res: Response, next: () => void): void {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(503).json({
      success: false,
      message: 'Cron secret not configured (CRON_SECRET)',
      error: 'Cron not configured',
    });
    return;
  }
  const headerSecret = req.headers['x-cron-secret'] || (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  if (headerSecret !== secret) {
    res.status(401).json({
      success: false,
      message: 'Invalid or missing cron secret',
      error: 'Unauthorized',
    });
    return;
  }
  next();
}

/**
 * @route   POST /api/cron/auto-release-supply-escrows
 * @desc    Run auto-release for supply escrows with "Automatic release after delivery" whose expected_release_date has passed. Call from external cron (e.g. every 15 min). Requires CRON_SECRET.
 * @access  X-Cron-Secret or Authorization: Bearer <CRON_SECRET>
 */
router.post(
  '/auto-release-supply-escrows',
  cronSecretAuth,
  asyncHandler(async (_req: Request, res: Response) => {
    const result = await escrowService.runAutoReleaseForSupplyEscrows();
    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(500).json(result);
    }
  })
);

export default router;
