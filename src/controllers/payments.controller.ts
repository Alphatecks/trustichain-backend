import { Request, Response } from 'express';
import { z } from 'zod';
import { paymentsService } from '../services/payments/payments.service';
import type {
  CreatePaymentIntentRequest,
  CreateSetupIntentRequest,
  EscrowPaymentStatusData,
  PaymentApiResponse,
  PaymentIntentResponseData,
  SetupIntentResponseData,
  StripeWebhookResponseData,
} from '../types/api/payment.types';

const createPaymentIntentSchema = z.object({
  escrowId: z.string().uuid('escrowId must be a valid UUID'),
  amountUsd: z.number().positive().optional(),
  currency: z.string().min(3).max(8).optional(),
  paymentMethodTypes: z.array(z.string().min(1)).optional(),
  idempotencyKey: z.string().min(1).max(255).optional(),
});

const createSetupIntentSchema = z.object({
  escrowId: z.string().uuid('escrowId must be a valid UUID'),
  customerEmail: z.string().email().optional(),
  idempotencyKey: z.string().min(1).max(255).optional(),
});

export class PaymentsController {
  async createPaymentIntent(
    req: Request,
    res: Response<PaymentApiResponse<PaymentIntentResponseData>>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const parsed = createPaymentIntentSchema.parse(req.body);
      const result = await paymentsService.createPaymentIntent(userId, parsed as CreatePaymentIntentRequest);
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid request body';
      res.status(400).json({
        success: false,
        message,
        error: 'Validation failed',
      });
    }
  }

  async createSetupIntent(
    req: Request,
    res: Response<PaymentApiResponse<SetupIntentResponseData>>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const parsed = createSetupIntentSchema.parse(req.body);
      const result = await paymentsService.createSetupIntent(userId, parsed as CreateSetupIntentRequest);
      res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid request body';
      res.status(400).json({
        success: false,
        message,
        error: 'Validation failed',
      });
    }
  }

  async getEscrowPaymentStatus(
    req: Request,
    res: Response<PaymentApiResponse<EscrowPaymentStatusData>>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const escrowId = req.params.escrowId as string;
      const result = await paymentsService.getEscrowPaymentStatus(userId, escrowId);
      res.status(result.success ? 200 : 404).json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch payment status';
      res.status(500).json({
        success: false,
        message,
        error: 'Payment status lookup failed',
      });
    }
  }

  async handleStripeWebhook(
    req: Request,
    res: Response<PaymentApiResponse<StripeWebhookResponseData>>
  ): Promise<void> {
    const signature = req.headers['stripe-signature'];
    const signatureHeader = Array.isArray(signature) ? signature[0] : signature;
    const bodyBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    const result = await paymentsService.processWebhook(bodyBuffer, signatureHeader);
    res.status(result.success ? 200 : 400).json(result);
  }
}

export const paymentsController = new PaymentsController();
