export interface CreatePaymentIntentRequest {
  escrowId: string;
  amountUsd?: number;
  currency?: string;
  paymentMethodTypes?: string[];
  idempotencyKey?: string;
}

export interface CreateSetupIntentRequest {
  escrowId: string;
  customerEmail?: string;
  idempotencyKey?: string;
}

export interface PaymentIntentResponseData {
  escrowId: string;
  paymentAttemptId: string;
  intentId: string;
  clientSecret: string;
  status: string;
  amountUsd: number | null;
  currency: string;
  requiresAction: boolean;
}

export interface SetupIntentResponseData {
  escrowId: string;
  paymentAttemptId: string;
  intentId: string;
  clientSecret: string;
  status: string;
}

export interface StripeWebhookResponseData {
  received: boolean;
  eventId?: string;
  eventType?: string;
  duplicate?: boolean;
}

export interface EscrowPaymentStatusData {
  escrowId: string;
  paymentStatus: string;
  latestAttempt?: {
    id: string;
    intentType: string;
    stripeIntentId: string;
    status: string;
    failureCode: string | null;
    failureMessage: string | null;
    retryCount: number;
    latestWebhookEventType: string | null;
    updatedAt: string;
  };
}

export interface PaymentApiResponse<T = undefined> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}
