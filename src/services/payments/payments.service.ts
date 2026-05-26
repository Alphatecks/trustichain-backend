import crypto from 'crypto';
import Stripe from 'stripe';
import { supabase, supabaseAdmin } from '../../config/supabase';
import type {
  CreatePaymentIntentRequest,
  CreateSetupIntentRequest,
  EscrowPaymentStatusData,
  PaymentApiResponse,
  PaymentIntentResponseData,
  SetupIntentResponseData,
  StripeWebhookResponseData,
} from '../../types/api/payment.types';

type EscrowRow = {
  id: string;
  user_id: string;
  counterparty_id: string | null;
  amount_usd: string | number;
  status: string;
  payment_status: string;
};

export class PaymentsService {
  private stripeClient: any = null;

  private getAdminClient() {
    return supabaseAdmin || supabase;
  }

  private getStripeClient(): any {
    if (this.stripeClient) {
      return this.stripeClient;
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is missing');
    }

    const forceTestMode = process.env.STRIPE_TEST_MODE === 'true';
    if (forceTestMode && !secretKey.startsWith('sk_test_')) {
      throw new Error('STRIPE_TEST_MODE is enabled but STRIPE_SECRET_KEY is not a Stripe test key');
    }

    this.stripeClient = new Stripe(secretKey);
    return this.stripeClient;
  }

  private normalizeCurrency(input?: string): string {
    return (input || 'usd').trim().toLowerCase();
  }

  private toStripeAmount(amountUsd: number): number {
    return Math.round(amountUsd * 100);
  }

  private parseAmount(value: string | number | null | undefined): number {
    if (value == null) {
      return 0;
    }
    return typeof value === 'number' ? value : parseFloat(value);
  }

  private sanitizeIdempotencyKey(fallbackPrefix: string, idempotencyKey?: string): string {
    const candidate = idempotencyKey?.trim();
    if (candidate) {
      return candidate;
    }
    return `${fallbackPrefix}:${crypto.randomUUID()}`;
  }

  private async getEscrowForPayer(escrowId: string, userId: string): Promise<EscrowRow | null> {
    const adminClient = this.getAdminClient();
    const { data, error } = await adminClient
      .from('escrows')
      .select('id, user_id, counterparty_id, amount_usd, status, payment_status')
      .eq('id', escrowId)
      .single();

    if (error || !data) {
      return null;
    }

    if (data.user_id !== userId) {
      return null;
    }

    return data as EscrowRow;
  }

  async createPaymentIntent(
    userId: string,
    request: CreatePaymentIntentRequest
  ): Promise<PaymentApiResponse<PaymentIntentResponseData>> {
    try {
      if (!request.escrowId) {
        return {
          success: false,
          message: 'escrowId is required',
          error: 'Validation failed',
        };
      }

      const escrow = await this.getEscrowForPayer(request.escrowId, userId);
      if (!escrow) {
        return {
          success: false,
          message: 'Escrow not found or you are not the payer for this escrow',
          error: 'Escrow access denied',
        };
      }

      if (escrow.status === 'cancelled' || escrow.status === 'completed') {
        return {
          success: false,
          message: `Cannot create payment intent for escrow in "${escrow.status}" status`,
          error: 'Invalid escrow status',
        };
      }

      const escrowAmountUsd = this.parseAmount(escrow.amount_usd);
      const requestedAmountUsd = request.amountUsd ?? escrowAmountUsd;
      if (requestedAmountUsd <= 0) {
        return {
          success: false,
          message: 'Payment amount must be greater than zero',
          error: 'Invalid amount',
        };
      }

      if (Math.abs(requestedAmountUsd - escrowAmountUsd) > 0.009) {
        return {
          success: false,
          message: `Requested amount (${requestedAmountUsd}) must match escrow amount (${escrowAmountUsd})`,
          error: 'Amount mismatch',
        };
      }

      const currency = this.normalizeCurrency(request.currency);
      const idempotencyKey = this.sanitizeIdempotencyKey(
        `pi:${request.escrowId}:${userId}`,
        request.idempotencyKey
      );

      const adminClient = this.getAdminClient();
      const { data: existingAttempt } = await adminClient
        .from('escrow_payment_attempts')
        .select('id, stripe_intent_id, stripe_client_secret, status, amount_usd, currency')
        .eq('escrow_id', request.escrowId)
        .eq('payer_user_id', userId)
        .eq('intent_type', 'payment_intent')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existingAttempt) {
        return {
          success: true,
          message: 'Existing PaymentIntent returned for idempotency key',
          data: {
            escrowId: request.escrowId,
            paymentAttemptId: existingAttempt.id,
            intentId: existingAttempt.stripe_intent_id,
            clientSecret: existingAttempt.stripe_client_secret,
            status: existingAttempt.status,
            amountUsd: this.parseAmount(existingAttempt.amount_usd),
            currency: existingAttempt.currency,
            requiresAction: existingAttempt.status === 'requires_action',
          },
        };
      }

      const stripe = this.getStripeClient();
      const paymentIntentCreatePayload: any = {
        amount: this.toStripeAmount(requestedAmountUsd),
        currency,
        payment_method_options: {
          card: { request_three_d_secure: 'automatic' },
        },
        metadata: {
          escrow_id: request.escrowId,
          payer_user_id: userId,
          counterparty_id: escrow.counterparty_id || '',
          integration_mode: 'test',
        },
      };

      if (request.paymentMethodTypes && request.paymentMethodTypes.length > 0) {
        paymentIntentCreatePayload.payment_method_types = request.paymentMethodTypes;
      } else {
        paymentIntentCreatePayload.automatic_payment_methods = { enabled: true };
      }

      const paymentIntent = await stripe.paymentIntents.create(
        paymentIntentCreatePayload,
        { idempotencyKey }
      );

      if (!paymentIntent.client_secret) {
        return {
          success: false,
          message: 'Stripe did not return a client_secret',
          error: 'Payment intent creation failed',
        };
      }

      const { data: insertedAttempt, error: insertError } = await adminClient
        .from('escrow_payment_attempts')
        .insert({
          escrow_id: request.escrowId,
          payer_user_id: userId,
          counterparty_id: escrow.counterparty_id,
          provider: 'stripe',
          intent_type: 'payment_intent',
          stripe_intent_id: paymentIntent.id,
          stripe_client_secret: paymentIntent.client_secret,
          idempotency_key: idempotencyKey,
          amount_usd: requestedAmountUsd,
          currency,
          status: paymentIntent.status,
          metadata: paymentIntent.metadata,
        })
        .select('id')
        .single();

      if (insertError || !insertedAttempt) {
        return {
          success: false,
          message: 'Failed to persist payment attempt',
          error: insertError?.message || 'DB write failed',
        };
      }

      await adminClient
        .from('escrows')
        .update({
          payment_status: paymentIntent.status,
          payment_linked_at: new Date().toISOString(),
        })
        .eq('id', request.escrowId);

      return {
        success: true,
        message: 'Stripe PaymentIntent created successfully',
        data: {
          escrowId: request.escrowId,
          paymentAttemptId: insertedAttempt.id,
          intentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          status: paymentIntent.status,
          amountUsd: requestedAmountUsd,
          currency,
          requiresAction: paymentIntent.status === 'requires_action',
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create PaymentIntent',
        error: 'Stripe PaymentIntent creation failed',
      };
    }
  }

  async createSetupIntent(
    userId: string,
    request: CreateSetupIntentRequest
  ): Promise<PaymentApiResponse<SetupIntentResponseData>> {
    try {
      if (!request.escrowId) {
        return {
          success: false,
          message: 'escrowId is required',
          error: 'Validation failed',
        };
      }

      const escrow = await this.getEscrowForPayer(request.escrowId, userId);
      if (!escrow) {
        return {
          success: false,
          message: 'Escrow not found or you are not the payer for this escrow',
          error: 'Escrow access denied',
        };
      }

      const idempotencyKey = this.sanitizeIdempotencyKey(
        `si:${request.escrowId}:${userId}`,
        request.idempotencyKey
      );
      const adminClient = this.getAdminClient();

      const { data: existingAttempt } = await adminClient
        .from('escrow_payment_attempts')
        .select('id, stripe_intent_id, stripe_client_secret, status')
        .eq('escrow_id', request.escrowId)
        .eq('payer_user_id', userId)
        .eq('intent_type', 'setup_intent')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existingAttempt) {
        return {
          success: true,
          message: 'Existing SetupIntent returned for idempotency key',
          data: {
            escrowId: request.escrowId,
            paymentAttemptId: existingAttempt.id,
            intentId: existingAttempt.stripe_intent_id,
            clientSecret: existingAttempt.stripe_client_secret,
            status: existingAttempt.status,
          },
        };
      }

      const stripe = this.getStripeClient();
      const setupIntent = await stripe.setupIntents.create(
        {
          payment_method_types: ['card'],
          usage: 'off_session',
          metadata: {
            escrow_id: request.escrowId,
            payer_user_id: userId,
            customer_email: request.customerEmail || '',
            integration_mode: 'test',
          },
        },
        { idempotencyKey }
      );

      if (!setupIntent.client_secret) {
        return {
          success: false,
          message: 'Stripe did not return a client_secret',
          error: 'Setup intent creation failed',
        };
      }

      const { data: insertedAttempt, error: insertError } = await adminClient
        .from('escrow_payment_attempts')
        .insert({
          escrow_id: request.escrowId,
          payer_user_id: userId,
          counterparty_id: escrow.counterparty_id,
          provider: 'stripe',
          intent_type: 'setup_intent',
          stripe_intent_id: setupIntent.id,
          stripe_client_secret: setupIntent.client_secret,
          idempotency_key: idempotencyKey,
          amount_usd: null,
          currency: 'usd',
          status: setupIntent.status,
          metadata: setupIntent.metadata,
        })
        .select('id')
        .single();

      if (insertError || !insertedAttempt) {
        return {
          success: false,
          message: 'Failed to persist setup attempt',
          error: insertError?.message || 'DB write failed',
        };
      }

      return {
        success: true,
        message: 'Stripe SetupIntent created successfully',
        data: {
          escrowId: request.escrowId,
          paymentAttemptId: insertedAttempt.id,
          intentId: setupIntent.id,
          clientSecret: setupIntent.client_secret,
          status: setupIntent.status,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create SetupIntent',
        error: 'Stripe SetupIntent creation failed',
      };
    }
  }

  async getEscrowPaymentStatus(
    userId: string,
    escrowId: string
  ): Promise<PaymentApiResponse<EscrowPaymentStatusData>> {
    try {
      const escrow = await this.getEscrowForPayer(escrowId, userId);
      if (!escrow) {
        return {
          success: false,
          message: 'Escrow not found or inaccessible',
          error: 'Escrow access denied',
        };
      }

      const adminClient = this.getAdminClient();
      const { data: latestAttempt } = await adminClient
        .from('escrow_payment_attempts')
        .select('id, intent_type, stripe_intent_id, status, failure_code, failure_message, retry_count, latest_webhook_event_type, updated_at')
        .eq('escrow_id', escrowId)
        .eq('payer_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        success: true,
        message: 'Escrow payment status fetched successfully',
        data: {
          escrowId,
          paymentStatus: escrow.payment_status || 'unpaid',
          latestAttempt: latestAttempt
            ? {
                id: latestAttempt.id,
                intentType: latestAttempt.intent_type,
                stripeIntentId: latestAttempt.stripe_intent_id,
                status: latestAttempt.status,
                failureCode: latestAttempt.failure_code,
                failureMessage: latestAttempt.failure_message,
                retryCount: latestAttempt.retry_count,
                latestWebhookEventType: latestAttempt.latest_webhook_event_type,
                updatedAt: latestAttempt.updated_at,
              }
            : undefined,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch escrow payment status',
        error: 'Escrow payment status failed',
      };
    }
  }

  private async markWebhookProcessed(
    event: any,
    intentId?: string
  ): Promise<{ duplicate: boolean; recordCreated: boolean }> {
    const adminClient = this.getAdminClient();
    const { error } = await adminClient.from('stripe_webhook_events').insert({
      event_id: event.id,
      event_type: event.type,
      stripe_intent_id: intentId || null,
      payload: event,
      processed: false,
    });

    if (!error) {
      return { duplicate: false, recordCreated: true };
    }

    if ((error as { code?: string }).code === '23505') {
      return { duplicate: true, recordCreated: false };
    }

    throw new Error(error.message);
  }

  private extractRisk(event: any): { riskLevel: string | null; fraudRuleHit: boolean } {
    if (event.type !== 'charge.succeeded' && event.type !== 'charge.failed') {
      return { riskLevel: null, fraudRuleHit: false };
    }

    const charge = event.data.object as any;
    const riskLevel = charge.outcome?.risk_level || null;
    const fraudRuleHit = Boolean(charge.outcome?.type === 'blocked');
    return { riskLevel, fraudRuleHit };
  }

  private async updateAttemptForEvent(
    intentId: string,
    intentType: 'payment_intent' | 'setup_intent',
    status: string,
    event: any,
    failureCode: string | null,
    failureMessage: string | null
  ): Promise<string | null> {
    const adminClient = this.getAdminClient();
    const { riskLevel, fraudRuleHit } = this.extractRisk(event);

    const { data: updated, error } = await adminClient
      .from('escrow_payment_attempts')
      .update({
        status,
        failure_code: failureCode,
        failure_message: failureMessage,
        retry_count: status === 'requires_payment_method' || status === 'failed' ? 1 : 0,
        latest_webhook_event_id: event.id,
        latest_webhook_event_type: event.type,
        fraud_risk_level: riskLevel,
        fraud_rule_hit: fraudRuleHit,
        raw_last_event: event,
      })
      .eq('stripe_intent_id', intentId)
      .eq('intent_type', intentType)
      .select('id, escrow_id')
      .single();

    if (error || !updated) {
      return null;
    }

    await adminClient
      .from('escrows')
      .update({
        payment_status: status,
        payment_linked_at: new Date().toISOString(),
      })
      .eq('id', updated.escrow_id);

    await adminClient
      .from('stripe_webhook_events')
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        payment_attempt_id: updated.id,
      })
      .eq('event_id', event.id);

    return updated.id as string;
  }

  async processWebhook(
    payload: Buffer,
    signature: string | undefined
  ): Promise<PaymentApiResponse<StripeWebhookResponseData>> {
    try {
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!endpointSecret) {
        return {
          success: false,
          message: 'STRIPE_WEBHOOK_SECRET is missing',
          error: 'Webhook configuration missing',
        };
      }

      if (!signature) {
        return {
          success: false,
          message: 'Stripe signature header is missing',
          error: 'Invalid webhook signature',
        };
      }

      const stripe = this.getStripeClient();
      const event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);

      let intentId: string | undefined;
      if ('id' in event.data.object) {
        intentId = (event.data.object as { id?: string }).id;
      }

      const eventRecord = await this.markWebhookProcessed(event, intentId);
      if (eventRecord.duplicate) {
        return {
          success: true,
          message: 'Webhook already processed',
          data: {
            received: true,
            eventId: event.id,
            eventType: event.type,
            duplicate: true,
          },
        };
      }

      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as any;
          await this.updateAttemptForEvent(
            paymentIntent.id,
            'payment_intent',
            'succeeded',
            event,
            null,
            null
          );
          break;
        }
        case 'payment_intent.processing': {
          const paymentIntent = event.data.object as any;
          await this.updateAttemptForEvent(
            paymentIntent.id,
            'payment_intent',
            'processing',
            event,
            null,
            null
          );
          break;
        }
        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as any;
          const failureCode = paymentIntent.last_payment_error?.code || null;
          const failureMessage = paymentIntent.last_payment_error?.message || null;
          await this.updateAttemptForEvent(
            paymentIntent.id,
            'payment_intent',
            'failed',
            event,
            failureCode,
            failureMessage
          );
          break;
        }
        case 'payment_intent.canceled': {
          const paymentIntent = event.data.object as any;
          await this.updateAttemptForEvent(
            paymentIntent.id,
            'payment_intent',
            'canceled',
            event,
            null,
            paymentIntent.cancellation_reason || null
          );
          break;
        }
        case 'setup_intent.succeeded': {
          const setupIntent = event.data.object as any;
          await this.updateAttemptForEvent(
            setupIntent.id,
            'setup_intent',
            'succeeded',
            event,
            null,
            null
          );
          break;
        }
        case 'setup_intent.setup_failed': {
          const setupIntent = event.data.object as any;
          const failureCode = setupIntent.last_setup_error?.code || null;
          const failureMessage = setupIntent.last_setup_error?.message || null;
          await this.updateAttemptForEvent(
            setupIntent.id,
            'setup_intent',
            'failed',
            event,
            failureCode,
            failureMessage
          );
          break;
        }
        default: {
          const adminClient = this.getAdminClient();
          await adminClient
            .from('stripe_webhook_events')
            .update({
              processed: true,
              processed_at: new Date().toISOString(),
            })
            .eq('event_id', event.id);
          break;
        }
      }

      return {
        success: true,
        message: 'Webhook processed successfully',
        data: {
          received: true,
          eventId: event.id,
          eventType: event.type,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to process webhook',
        error: 'Stripe webhook processing failed',
      };
    }
  }
}

export const paymentsService = new PaymentsService();
