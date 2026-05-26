jest.mock('../../src/config/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
  supabase: null,
}));

import { supabaseAdmin } from '../../src/config/supabase';
const { PaymentsService } = require('../../src/services/payments/payments.service.ts');

function createSingleRowQuery(row: any) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: row, error: null }),
    maybeSingle: jest.fn().mockResolvedValue({ data: row, error: null }),
  };
}

describe('PaymentsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects createPaymentIntent when escrowId is missing', async () => {
    const service = new PaymentsService();
    const result = await service.createPaymentIntent('user-1', {} as any);

    expect(result.success).toBe(false);
    expect(result.message).toContain('escrowId is required');
  });

  it('returns existing payment attempt for same idempotency key', async () => {
    const escrowRow = {
      id: 'escrow-1',
      user_id: 'user-1',
      counterparty_id: 'user-2',
      amount_usd: '100.00',
      status: 'pending',
      payment_status: 'unpaid',
    };
    const existingAttempt = {
      id: 'attempt-1',
      stripe_intent_id: 'pi_123',
      stripe_client_secret: 'pi_123_secret_abc',
      status: 'requires_payment_method',
      amount_usd: '100.00',
      currency: 'usd',
    };

    const admin = supabaseAdmin as unknown as { from: jest.Mock };
    admin.from.mockImplementation((table: string) => {
      if (table === 'escrows') {
        return createSingleRowQuery(escrowRow);
      }
      if (table === 'escrow_payment_attempts') {
        return createSingleRowQuery(existingAttempt);
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const service = new PaymentsService();
    const result = await service.createPaymentIntent('user-1', {
      escrowId: 'escrow-1',
      amountUsd: 100,
      idempotencyKey: 'same-key',
    });

    expect(result.success).toBe(true);
    expect(result.data?.paymentAttemptId).toBe('attempt-1');
    expect(result.data?.intentId).toBe('pi_123');
    expect(result.data?.clientSecret).toBe('pi_123_secret_abc');
  });

  it('rejects webhook processing without signature header', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    const service = new PaymentsService();
    const result = await service.processWebhook(Buffer.from('{}'), undefined);

    expect(result.success).toBe(false);
    expect(result.message).toContain('signature');
  });
});
