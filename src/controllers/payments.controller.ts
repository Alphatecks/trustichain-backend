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

const createPaymentIntentBodySchema = z.object({
  escrowId: z.string().min(1).optional(),
  escrow_id: z.string().min(1).optional(),
  amountUsd: z.number().positive().optional(),
  amount_usd: z.number().positive().optional(),
  currency: z.string().min(3).max(8).optional(),
  paymentMethodTypes: z.array(z.string().min(1)).optional(),
  payment_method_types: z.array(z.string().min(1)).optional(),
  idempotencyKey: z.string().min(1).max(255).optional(),
  idempotency_key: z.string().min(1).max(255).optional(),
});

const createSetupIntentBodySchema = z.object({
  escrowId: z.string().min(1).optional(),
  escrow_id: z.string().min(1).optional(),
  customerEmail: z.string().email().optional(),
  customer_email: z.string().email().optional(),
  idempotencyKey: z.string().min(1).max(255).optional(),
  idempotency_key: z.string().min(1).max(255).optional(),
});

function readString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function resolveEscrowIdFromRequest(req: Request): string | undefined {
  return (
    readString(req.params.escrowId) ||
    readString(req.body?.escrowId) ||
    readString(req.body?.escrow_id)
  );
}

function formatValidationMessage(error: z.ZodError): string {
  const firstIssue = error.issues[0];
  if (!firstIssue) {
    return 'Invalid request body';
  }
  if (firstIssue.path[0] === 'escrowId') {
    return 'escrowId is required (UUID or formatted id such as #ESC-2026-025)';
  }
  return firstIssue.message;
}

export class PaymentsController {
  async createPaymentIntent(
    req: Request,
    res: Response<PaymentApiResponse<PaymentIntentResponseData>>
  ): Promise<void> {
    try {
      const userId = req.userId!;
      const parsedBody = createPaymentIntentBodySchema.safeParse(req.body ?? {});
      if (!parsedBody.success) {
        res.status(400).json({
          success: false,
          message: formatValidationMessage(parsedBody.error),
          error: 'Validation failed',
        });
        return;
      }

      const escrowId = resolveEscrowIdFromRequest(req);
      if (!escrowId) {
        res.status(400).json({
          success: false,
          message: 'escrowId is required (UUID or formatted id such as #ESC-2026-025)',
          error: 'Validation failed',
        });
        return;
      }

      const body = parsedBody.data;
      const request: CreatePaymentIntentRequest = {
        escrowId,
        amountUsd: body.amountUsd ?? body.amount_usd,
        currency: body.currency,
        paymentMethodTypes: body.paymentMethodTypes ?? body.payment_method_types,
        idempotencyKey: body.idempotencyKey ?? body.idempotency_key,
      };

      const result = await paymentsService.createPaymentIntent(userId, request);
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
      const parsedBody = createSetupIntentBodySchema.safeParse(req.body ?? {});
      if (!parsedBody.success) {
        res.status(400).json({
          success: false,
          message: formatValidationMessage(parsedBody.error),
          error: 'Validation failed',
        });
        return;
      }

      const escrowId = resolveEscrowIdFromRequest(req);
      if (!escrowId) {
        res.status(400).json({
          success: false,
          message: 'escrowId is required (UUID or formatted id such as #ESC-2026-025)',
          error: 'Validation failed',
        });
        return;
      }

      const body = parsedBody.data;
      const request: CreateSetupIntentRequest = {
        escrowId,
        customerEmail: body.customerEmail ?? body.customer_email,
        idempotencyKey: body.idempotencyKey ?? body.idempotency_key,
      };

      const result = await paymentsService.createSetupIntent(userId, request);
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
