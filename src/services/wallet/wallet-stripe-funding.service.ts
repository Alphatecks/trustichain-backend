import crypto from 'crypto';
import Stripe from 'stripe';
import { supabase, supabaseAdmin } from '../../config/supabase';
import { notificationService } from '../notification/notification.service';
import type {
  CreateWalletStripeFundingIntentRequest,
  WalletFundingBalanceAsset,
  WalletStripeFundingIntentResponseData,
  WalletStripeFundingStatusData,
  WalletApiResponse,
} from '../../types/api/wallet.types';

type WalletSuiteContext = 'personal' | 'business';

type WalletRow = {
  id: string;
  user_id: string;
  suite_context: WalletSuiteContext;
  balance_usdt: string | number | null;
  balance_usdc: string | number | null;
};

type WalletFundingAttemptRow = {
  id: string;
  user_id: string;
  wallet_id: string;
  suite_context: WalletSuiteContext;
  stripe_intent_id: string;
  stripe_client_secret: string;
  idempotency_key: string;
  amount_usd: string | number;
  currency: string;
  balance_asset: WalletFundingBalanceAsset;
  status: string;
  transaction_id: string | null;
  credited_at: string | null;
  failure_code: string | null;
  failure_message: string | null;
  latest_webhook_event_id: string | null;
};

export class WalletStripeFundingService {
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

  private parseAmount(value: string | number | null | undefined): number {
    if (value == null) {
      return 0;
    }
    return typeof value === 'number' ? value : parseFloat(value);
  }

  private normalizeCurrency(input?: string): string {
    return (input || 'usd').trim().toLowerCase();
  }

  private toStripeAmount(amountUsd: number): number {
    return Math.round(amountUsd * 100);
  }

  private sanitizeIdempotencyKey(userId: string, idempotencyKey?: string): string {
    const candidate = idempotencyKey?.trim();
    if (candidate) {
      return candidate;
    }
    return `wallet-fund:${userId}:${crypto.randomUUID()}`;
  }

  private getFundingLimits(): { minUsd: number; maxUsd: number } {
    const minUsd = parseFloat(process.env.STRIPE_WALLET_FUNDING_MIN_USD || '1');
    const maxUsd = parseFloat(process.env.STRIPE_WALLET_FUNDING_MAX_USD || '10000');
    return {
      minUsd: Number.isFinite(minUsd) && minUsd > 0 ? minUsd : 1,
      maxUsd: Number.isFinite(maxUsd) && maxUsd > 0 ? maxUsd : 10000,
    };
  }

  private normalizeSuiteContext(input?: string): WalletSuiteContext {
    return input === 'business' ? 'business' : 'personal';
  }

  private normalizeBalanceAsset(input?: string): WalletFundingBalanceAsset {
    return input?.toUpperCase() === 'USDT' ? 'USDT' : 'USDC';
  }

  private balanceFieldForAsset(asset: WalletFundingBalanceAsset): 'balance_usdt' | 'balance_usdc' {
    return asset === 'USDT' ? 'balance_usdt' : 'balance_usdc';
  }

  private async getWalletForUser(
    userId: string,
    suiteContext: WalletSuiteContext
  ): Promise<WalletRow | null> {
    const adminClient = this.getAdminClient();
    const { data, error } = await adminClient
      .from('wallets')
      .select('id, user_id, suite_context, balance_usdt, balance_usdc')
      .eq('user_id', userId)
      .eq('suite_context', suiteContext)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as WalletRow;
  }

  async createFundingIntent(
    userId: string,
    request: CreateWalletStripeFundingIntentRequest
  ): Promise<WalletApiResponse<WalletStripeFundingIntentResponseData>> {
    try {
      const amountUsd = request.amountUsd;
      if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
        return {
          success: false,
          message: 'amountUsd must be a positive number',
          error: 'Validation failed',
        };
      }

      const { minUsd, maxUsd } = this.getFundingLimits();
      if (amountUsd < minUsd || amountUsd > maxUsd) {
        return {
          success: false,
          message: `Funding amount must be between $${minUsd} and $${maxUsd}`,
          error: 'Amount out of range',
        };
      }

      const suiteContext = this.normalizeSuiteContext(request.suiteContext);
      const balanceAsset = this.normalizeBalanceAsset(request.asset);
      const wallet = await this.getWalletForUser(userId, suiteContext);
      if (!wallet) {
        return {
          success: false,
          message: 'Wallet not found. Create a wallet first.',
          error: 'Wallet not found',
        };
      }

      const currency = this.normalizeCurrency(request.currency);
      const idempotencyKey = this.sanitizeIdempotencyKey(userId, request.idempotencyKey);
      const adminClient = this.getAdminClient();

      const { data: existingAttempt } = await adminClient
        .from('wallet_funding_attempts')
        .select('id, stripe_intent_id, stripe_client_secret, status, amount_usd, currency, balance_asset')
        .eq('user_id', userId)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existingAttempt) {
        return {
          success: true,
          message: 'Existing wallet funding PaymentIntent returned for idempotency key',
          data: {
            fundingAttemptId: existingAttempt.id,
            intentId: existingAttempt.stripe_intent_id,
            clientSecret: existingAttempt.stripe_client_secret,
            status: existingAttempt.status,
            amountUsd: this.parseAmount(existingAttempt.amount_usd),
            currency: existingAttempt.currency,
            asset: existingAttempt.balance_asset as WalletFundingBalanceAsset,
            suiteContext,
            requiresAction: existingAttempt.status === 'requires_action',
          },
        };
      }

      const stripe = this.getStripeClient();
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: this.toStripeAmount(amountUsd),
          currency,
          automatic_payment_methods: { enabled: true },
          payment_method_options: {
            card: { request_three_d_secure: 'automatic' },
          },
          metadata: {
            purpose: 'wallet_funding',
            user_id: userId,
            wallet_id: wallet.id,
            suite_context: suiteContext,
            balance_asset: balanceAsset,
          },
        },
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
        .from('wallet_funding_attempts')
        .insert({
          user_id: userId,
          wallet_id: wallet.id,
          suite_context: suiteContext,
          provider: 'stripe',
          stripe_intent_id: paymentIntent.id,
          stripe_client_secret: paymentIntent.client_secret,
          idempotency_key: idempotencyKey,
          amount_usd: amountUsd,
          currency,
          balance_asset: balanceAsset,
          status: paymentIntent.status,
          metadata: paymentIntent.metadata,
        })
        .select('id')
        .single();

      if (insertError || !insertedAttempt) {
        return {
          success: false,
          message: 'Failed to persist wallet funding attempt',
          error: insertError?.message || 'DB write failed',
        };
      }

      return {
        success: true,
        message: 'Wallet funding PaymentIntent created successfully',
        data: {
          fundingAttemptId: insertedAttempt.id,
          intentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          status: paymentIntent.status,
          amountUsd,
          currency,
          asset: balanceAsset,
          suiteContext,
          requiresAction: paymentIntent.status === 'requires_action',
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create wallet funding PaymentIntent',
        error: 'Stripe wallet funding failed',
      };
    }
  }

  async getFundingStatus(
    userId: string,
    params: { fundingAttemptId?: string; intentId?: string }
  ): Promise<WalletApiResponse<WalletStripeFundingStatusData>> {
    try {
      const attempt = await this.loadAttemptForUser(userId, params);
      if (!attempt) {
        return {
          success: false,
          message: 'Wallet funding attempt not found',
          error: 'Not found',
        };
      }

      if (attempt.status === 'succeeded' && !attempt.transaction_id) {
        await this.creditWalletIfSucceeded(attempt, null);
        const refreshed = await this.loadAttemptById(attempt.id, userId);
        if (refreshed) {
          return this.buildStatusResponse(refreshed);
        }
      }

      return this.buildStatusResponse(attempt);
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch wallet funding status',
        error: 'Wallet funding status failed',
      };
    }
  }

  private async loadAttemptForUser(
    userId: string,
    params: { fundingAttemptId?: string; intentId?: string }
  ): Promise<WalletFundingAttemptRow | null> {
    const adminClient = this.getAdminClient();
    if (params.fundingAttemptId) {
      return this.loadAttemptById(params.fundingAttemptId, userId);
    }

    if (params.intentId) {
      const { data } = await adminClient
        .from('wallet_funding_attempts')
        .select('*')
        .eq('user_id', userId)
        .eq('stripe_intent_id', params.intentId)
        .maybeSingle();
      return (data as WalletFundingAttemptRow | null) ?? null;
    }

    return null;
  }

  private async loadAttemptById(
    attemptId: string,
    userId: string
  ): Promise<WalletFundingAttemptRow | null> {
    const adminClient = this.getAdminClient();
    const { data } = await adminClient
      .from('wallet_funding_attempts')
      .select('*')
      .eq('id', attemptId)
      .eq('user_id', userId)
      .maybeSingle();
    return (data as WalletFundingAttemptRow | null) ?? null;
  }

  private buildStatusResponse(
    attempt: WalletFundingAttemptRow
  ): WalletApiResponse<WalletStripeFundingStatusData> {
    return {
      success: true,
      message: 'Wallet funding status fetched successfully',
      data: {
        fundingAttemptId: attempt.id,
        intentId: attempt.stripe_intent_id,
        status: attempt.status,
        amountUsd: this.parseAmount(attempt.amount_usd),
        currency: attempt.currency,
        asset: attempt.balance_asset,
        suiteContext: attempt.suite_context,
        credited: Boolean(attempt.transaction_id),
        transactionId: attempt.transaction_id || undefined,
        creditedAt: attempt.credited_at || undefined,
        failureCode: attempt.failure_code || undefined,
        failureMessage: attempt.failure_message || undefined,
      },
    };
  }

  async handleWebhookEvent(
    intentId: string,
    intentType: 'payment_intent' | 'setup_intent',
    status: string,
    event: any,
    failureCode: string | null,
    failureMessage: string | null
  ): Promise<string | null> {
    if (intentType !== 'payment_intent') {
      return null;
    }

    const adminClient = this.getAdminClient();
    const { data: attempt, error } = await adminClient
      .from('wallet_funding_attempts')
      .select('*')
      .eq('stripe_intent_id', intentId)
      .maybeSingle();

    if (error || !attempt) {
      return null;
    }

    const { data: updated, error: updateError } = await adminClient
      .from('wallet_funding_attempts')
      .update({
        status,
        failure_code: failureCode,
        failure_message: failureMessage,
        latest_webhook_event_id: event.id,
        latest_webhook_event_type: event.type,
        raw_last_event: event,
      })
      .eq('id', attempt.id)
      .select('*')
      .single();

    if (updateError || !updated) {
      return null;
    }

    if (status === 'succeeded') {
      await this.creditWalletIfSucceeded(updated as WalletFundingAttemptRow, event.id);
    }

    await adminClient
      .from('stripe_webhook_events')
      .update({
        wallet_funding_attempt_id: updated.id,
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq('event_id', event.id);

    return updated.id as string;
  }

  private async creditWalletIfSucceeded(
    attempt: WalletFundingAttemptRow,
    webhookEventId: string | null
  ): Promise<{ credited: boolean; alreadyCredited?: boolean; transactionId?: string }> {
    if (attempt.transaction_id) {
      return { credited: false, alreadyCredited: true, transactionId: attempt.transaction_id };
    }

    const adminClient = this.getAdminClient();

    const { data: existingTx } = await adminClient
      .from('transactions')
      .select('id')
      .eq('user_id', attempt.user_id)
      .eq('xrpl_tx_hash', attempt.stripe_intent_id)
      .eq('type', 'deposit')
      .maybeSingle();

    if (existingTx?.id) {
      await adminClient
        .from('wallet_funding_attempts')
        .update({
          transaction_id: existingTx.id,
          credited_at: new Date().toISOString(),
          latest_webhook_event_id: webhookEventId || attempt.latest_webhook_event_id,
        })
        .eq('id', attempt.id)
        .is('transaction_id', null);

      return { credited: false, alreadyCredited: true, transactionId: existingTx.id };
    }

    const amountUsd = this.parseAmount(attempt.amount_usd);
    const balanceField = this.balanceFieldForAsset(attempt.balance_asset);

    const { data: wallet } = await adminClient
      .from('wallets')
      .select('balance_usdt, balance_usdc')
      .eq('id', attempt.wallet_id)
      .single();

    if (!wallet) {
      return { credited: false };
    }

    const currentBalance = this.parseAmount(wallet[balanceField]);
    const newBalance = parseFloat((currentBalance + amountUsd).toFixed(6));
    const paymentMethodLabel = 'Google Pay / Apple Pay';

    const { data: txRow, error: txError } = await adminClient
      .from('transactions')
      .insert({
        user_id: attempt.user_id,
        type: 'deposit',
        amount_xrp: 0,
        amount_usd: amountUsd,
        xrpl_tx_hash: attempt.stripe_intent_id,
        status: 'completed',
        description: `Wallet funding $${amountUsd.toFixed(2)} via ${paymentMethodLabel} (${attempt.balance_asset})`,
      })
      .select('id')
      .single();

    if (txError || !txRow) {
      console.error('[WalletStripeFunding] transaction insert failed:', txError);
      return { credited: false };
    }

    const { error: walletError } = await adminClient
      .from('wallets')
      .update({
        [balanceField]: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', attempt.wallet_id);

    if (walletError) {
      console.error('[WalletStripeFunding] wallet update failed:', walletError);
      await adminClient.from('transactions').delete().eq('id', txRow.id);
      return { credited: false };
    }

    const { error: attemptUpdateError } = await adminClient
      .from('wallet_funding_attempts')
      .update({
        transaction_id: txRow.id,
        credited_at: new Date().toISOString(),
        latest_webhook_event_id: webhookEventId || attempt.latest_webhook_event_id,
      })
      .eq('id', attempt.id)
      .is('transaction_id', null);

    if (attemptUpdateError) {
      console.error('[WalletStripeFunding] attempt credit marker failed:', attemptUpdateError);
    }

    try {
      await notificationService.createNotification({
        userId: attempt.user_id,
        type: 'wallet_deposit',
        title: 'Wallet funded',
        message: `Your wallet was credited with $${amountUsd.toFixed(2)} ${attempt.balance_asset} via ${paymentMethodLabel}.`,
        metadata: {
          asset: attempt.balance_asset,
          amount: amountUsd,
          stripeIntentId: attempt.stripe_intent_id,
          transactionId: txRow.id,
          source: 'stripe_wallet_funding',
        },
      });
    } catch (notifyErr) {
      console.warn('[WalletStripeFunding] notification failed:', notifyErr);
    }

    return { credited: true, transactionId: txRow.id };
  }
}

export const walletStripeFundingService = new WalletStripeFundingService();
