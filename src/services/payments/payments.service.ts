import crypto from 'crypto';
import Stripe from 'stripe';
import { supabase, supabaseAdmin } from '../../config/supabase';
import { walletStripeFundingService } from '../wallet/wallet-stripe-funding.service';
import { escrowService } from '../escrow/escrow.service';
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
  creation_fee_usd?: string | number | null;
  payable_amount_usd?: string | number | null;
  payment_method?: string | null;
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

  private resolvePayableAmountUsd(escrow: EscrowRow): number {
    const payable = this.parseAmount(escrow.payable_amount_usd);
    if (payable > 0) {
      return payable;
    }
    const base = this.parseAmount(escrow.amount_usd);
    const fee = this.parseAmount(escrow.creation_fee_usd);
    const combined = base + fee;
    return combined > 0 ? parseFloat(combined.toFixed(2)) : base;
  }

  private async maybeFinalizeStripeEscrow(escrowId: string, status: string): Promise<void> {
    if (status !== 'succeeded') {
      return;
    }
    const adminClient = this.getAdminClient();
    const { data: escrow } = await adminClient
      .from('escrows')
      .select('payment_method, xrpl_escrow_id')
      .eq('id', escrowId)
      .maybeSingle();

    if (escrow?.payment_method === 'stripe' && !escrow.xrpl_escrow_id) {
      const result = await escrowService.finalizeStripeFundedEscrow(escrowId);
      if (!result.success) {
        console.error('[Payments] Stripe escrow finalize failed:', result.message);
      }
    }
  }

  private static readonly UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  private async getEscrowForPayer(escrowIdInput: string, userId: string): Promise<EscrowRow | null> {
    const adminClient = this.getAdminClient();
    const trimmed = escrowIdInput.trim().replace(/^#/, '');

    if (PaymentsService.UUID_REGEX.test(trimmed)) {
      const { data, error } = await adminClient
        .from('escrows')
        .select('id, user_id, counterparty_id, amount_usd, creation_fee_usd, payable_amount_usd, payment_method, status, payment_status')
        .eq('id', trimmed)
        .maybeSingle();

      if (error || !data || data.user_id !== userId) {
        return null;
      }

      return data as EscrowRow;
    }

    const match = /^ESC-(\d{4})-(\d+)$/i.exec(trimmed);
    if (!match) {
      return null;
    }

    const year = parseInt(match[1]!, 10);
    const sequence = parseInt(match[2]!, 10);
    const start = `${year}-01-01T00:00:00.000Z`;
    const end = `${year + 1}-01-01T00:00:00.000Z`;

    const { data, error } = await adminClient
      .from('escrows')
      .select('id, user_id, counterparty_id, amount_usd, creation_fee_usd, payable_amount_usd, payment_method, status, payment_status')
      .eq('escrow_sequence', sequence)
      .gte('created_at', start)
      .lt('created_at', end)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
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

      const escrowUuid = escrow.id;

      if (escrow.status === 'cancelled' || escrow.status === 'completed') {
        return {
          success: false,
          message: `Cannot create payment intent for escrow in "${escrow.status}" status`,
          error: 'Invalid escrow status',
        };
      }

      const escrowAmountUsd = this.parseAmount(escrow.amount_usd);
      const creationFeeUsd = this.parseAmount(escrow.creation_fee_usd);
      const payableAmountUsd = this.resolvePayableAmountUsd(escrow);

      if (request.amountUsd != null && Math.abs(request.amountUsd - payableAmountUsd) > 0.009) {
        console.warn('[Payments] Client amountUsd ignored; using server payable amount', {
          clientAmountUsd: request.amountUsd,
          payableAmountUsd,
          escrowAmountUsd,
        });
      }

      if (payableAmountUsd <= 0) {
        return {
          success: false,
          message: 'Payment amount must be greater than zero',
          error: 'Invalid amount',
        };
      }

      const chargeAmountUsd = payableAmountUsd;

      const currency = this.normalizeCurrency(request.currency);
      const idempotencyKey = this.sanitizeIdempotencyKey(
        `pi:${escrowUuid}:${userId}`,
        request.idempotencyKey
      );

      const adminClient = this.getAdminClient();
      const { data: existingAttempt } = await adminClient
        .from('escrow_payment_attempts')
        .select('id, stripe_intent_id, stripe_client_secret, status, amount_usd, currency')
        .eq('escrow_id', escrowUuid)
        .eq('payer_user_id', userId)
        .eq('intent_type', 'payment_intent')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existingAttempt) {
        return {
          success: true,
          message: 'Existing PaymentIntent returned for idempotency key',
          data: {
            escrowId: escrowUuid,
            paymentAttemptId: existingAttempt.id,
            intentId: existingAttempt.stripe_intent_id,
            clientSecret: existingAttempt.stripe_client_secret,
            status: existingAttempt.status,
            amountUsd: this.parseAmount(existingAttempt.amount_usd),
            payableAmountUsd: this.parseAmount(existingAttempt.amount_usd),
            creationFeeUsd,
            currency: existingAttempt.currency,
            requiresAction: existingAttempt.status === 'requires_action',
          },
        };
      }

      const stripe = this.getStripeClient();
      const paymentIntentCreatePayload: any = {
        amount: this.toStripeAmount(chargeAmountUsd),
        currency,
        payment_method_options: {
          card: { request_three_d_secure: 'automatic' },
        },
        metadata: {
          escrow_id: escrowUuid,
          payer_user_id: userId,
          counterparty_id: escrow.counterparty_id || '',
          payment_method: escrow.payment_method || 'stripe',
          payable_amount_usd: String(payableAmountUsd),
          creation_fee_usd: String(creationFeeUsd),
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
          escrow_id: escrowUuid,
          payer_user_id: userId,
          counterparty_id: escrow.counterparty_id,
          provider: 'stripe',
          intent_type: 'payment_intent',
          stripe_intent_id: paymentIntent.id,
          stripe_client_secret: paymentIntent.client_secret,
          idempotency_key: idempotencyKey,
          amount_usd: chargeAmountUsd,
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
        .eq('id', escrowUuid);

      return {
        success: true,
        message: 'Stripe PaymentIntent created successfully',
        data: {
          escrowId: escrowUuid,
          paymentAttemptId: insertedAttempt.id,
          intentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          status: paymentIntent.status,
          amountUsd: escrowAmountUsd,
          payableAmountUsd: chargeAmountUsd,
          creationFeeUsd,
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

      const escrowUuid = escrow.id;

      const idempotencyKey = this.sanitizeIdempotencyKey(
        `si:${escrowUuid}:${userId}`,
        request.idempotencyKey
      );
      const adminClient = this.getAdminClient();

      const { data: existingAttempt } = await adminClient
        .from('escrow_payment_attempts')
        .select('id, stripe_intent_id, stripe_client_secret, status')
        .eq('escrow_id', escrowUuid)
        .eq('payer_user_id', userId)
        .eq('intent_type', 'setup_intent')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existingAttempt) {
        return {
          success: true,
          message: 'Existing SetupIntent returned for idempotency key',
          data: {
            escrowId: escrowUuid,
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
            escrow_id: escrowUuid,
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
          escrow_id: escrowUuid,
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
          escrowId: escrowUuid,
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
        .eq('escrow_id', escrow.id)
        .eq('payer_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestAttempt?.status === 'succeeded' && escrow.payment_method === 'stripe') {
        await this.maybeFinalizeStripeEscrow(escrow.id, 'succeeded');
      }

      const { data: refreshedEscrow } = await adminClient
        .from('escrows')
        .select('payment_status, status, xrpl_escrow_id')
        .eq('id', escrow.id)
        .maybeSingle();

      return {
        success: true,
        message: 'Escrow payment status fetched successfully',
        data: {
          escrowId: escrow.id,
          paymentStatus: refreshedEscrow?.payment_status || escrow.payment_status || 'unpaid',
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
  ): Promise<{ attemptId: string; escrowId: string } | null> {
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

    return { attemptId: updated.id as string, escrowId: updated.escrow_id as string };
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
          const walletHandled = await walletStripeFundingService.handleWebhookEvent(
            paymentIntent.id,
            'payment_intent',
            'succeeded',
            event,
            null,
            null
          );
          if (!walletHandled) {
            const updated = await this.updateAttemptForEvent(
              paymentIntent.id,
              'payment_intent',
              'succeeded',
              event,
              null,
              null
            );
            if (updated) {
              await this.maybeFinalizeStripeEscrow(updated.escrowId, 'succeeded');
            }
          }
          break;
        }
        case 'payment_intent.processing': {
          const paymentIntent = event.data.object as any;
          const walletHandled = await walletStripeFundingService.handleWebhookEvent(
            paymentIntent.id,
            'payment_intent',
            'processing',
            event,
            null,
            null
          );
          if (!walletHandled) {
            await this.updateAttemptForEvent(
              paymentIntent.id,
              'payment_intent',
              'processing',
              event,
              null,
              null
            );
          }
          break;
        }
        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as any;
          const failureCode = paymentIntent.last_payment_error?.code || null;
          const failureMessage = paymentIntent.last_payment_error?.message || null;
          const walletHandled = await walletStripeFundingService.handleWebhookEvent(
            paymentIntent.id,
            'payment_intent',
            'failed',
            event,
            failureCode,
            failureMessage
          );
          if (!walletHandled) {
            await this.updateAttemptForEvent(
              paymentIntent.id,
              'payment_intent',
              'failed',
              event,
              failureCode,
              failureMessage
            );
          }
          break;
        }
        case 'payment_intent.canceled': {
          const paymentIntent = event.data.object as any;
          const walletHandled = await walletStripeFundingService.handleWebhookEvent(
            paymentIntent.id,
            'payment_intent',
            'canceled',
            event,
            null,
            paymentIntent.cancellation_reason || null
          );
          if (!walletHandled) {
            await this.updateAttemptForEvent(
              paymentIntent.id,
              'payment_intent',
              'canceled',
              event,
              null,
              paymentIntent.cancellation_reason || null
            );
          }
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
