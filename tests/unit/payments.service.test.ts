jest.mock('../../src/config/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
  supabase: null,
}));

const mockPaymentIntentsCreate = jest.fn();

jest.mock('stripe', () =>
  jest.fn().mockImplementation(() => ({
    paymentIntents: {
      create: mockPaymentIntentsCreate,
    },
  }))
);

jest.mock('../../src/services/escrow/escrow.service', () => ({
  escrowService: {
    finalizeStripeFundedEscrow: jest.fn(),
  },
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
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    mockPaymentIntentsCreate.mockResolvedValue({
      id: 'pi_new',
      client_secret: 'pi_new_secret',
      status: 'requires_payment_method',
      metadata: {},
    });
  });

  it('rejects createPaymentIntent when escrowId is missing', async () => {
    const service = new PaymentsService();
    const result = await service.createPaymentIntent('user-1', {} as any);

    expect(result.success).toBe(false);
    expect(result.message).toContain('escrowId is required');
  });

  it('returns existing payment attempt for same idempotency key', async () => {
    const escrowRow = {
      id: '550e8400-e29b-41d4-a716-446655440001',
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
      escrowId: '550e8400-e29b-41d4-a716-446655440001',
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

  it('uses server payable_amount_usd when client amountUsd differs', async () => {
    const escrowRow = {
      id: '550e8400-e29b-41d4-a716-446655440001',
      user_id: 'user-1',
      counterparty_id: 'user-2',
      amount_usd: '20.00',
      creation_fee_usd: '3.57',
      payable_amount_usd: '23.57',
      payment_method: 'stripe',
      status: 'pending',
      payment_status: 'unpaid',
    };

    const admin = supabaseAdmin as unknown as { from: jest.Mock };
    admin.from.mockImplementation((table: string) => {
      if (table === 'escrows') {
        const escrowQuery = createSingleRowQuery(escrowRow);
        return {
          ...escrowQuery,
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'escrow_payment_attempts') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: 'attempt-new' }, error: null }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const service = new PaymentsService();
    const result = await service.createPaymentIntent('user-1', {
      escrowId: '550e8400-e29b-41d4-a716-446655440001',
      amountUsd: 21.72,
    });

    if (!result.success) {
      throw new Error(result.message || result.error || 'unknown failure');
    }
    expect(result.success).toBe(true);
    expect(result.data?.payableAmountUsd).toBe(23.57);
    expect(result.message).not.toContain('must match escrow amount');
    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 2357 }),
      expect.any(Object)
    );
  });

  it('falls back to amount_usd plus creation_fee_usd when payable_amount_usd is missing', async () => {
    const escrowRow = {
      id: '550e8400-e29b-41d4-a716-446655440002',
      user_id: 'user-1',
      counterparty_id: 'user-2',
      amount_usd: '100.00',
      creation_fee_usd: '5.00',
      payable_amount_usd: null,
      payment_method: 'stripe',
      status: 'pending',
      payment_status: 'unpaid',
    };

    const admin = supabaseAdmin as unknown as { from: jest.Mock };
    admin.from.mockImplementation((table: string) => {
      if (table === 'escrows') {
        const escrowQuery = createSingleRowQuery(escrowRow);
        return {
          ...escrowQuery,
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'escrow_payment_attempts') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: 'attempt-fallback' }, error: null }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const service = new PaymentsService();
    const result = await service.createPaymentIntent('user-1', {
      escrowId: '550e8400-e29b-41d4-a716-446655440002',
    });

    if (!result.success) {
      throw new Error(result.message || result.error || 'unknown failure');
    }
    expect(result.success).toBe(true);
    expect(result.data?.payableAmountUsd).toBe(105);
    expect(mockPaymentIntentsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 10500 }),
      expect.any(Object)
    );
  });
});
