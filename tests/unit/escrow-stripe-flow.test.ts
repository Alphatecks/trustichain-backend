jest.mock('../../src/config/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
  supabase: null,
}));

jest.mock('../../src/services/storage/storage.service', () => ({
  storageService: {
    getSignedUrlForUserProfilePhoto: jest.fn(),
  },
}));

jest.mock('../../src/xrpl/wallet/xrpl-wallet.service', () => ({
  xrplWalletService: {
    getBalance: jest.fn(),
  },
}));

jest.mock('../../src/services/xumm/xumm.service', () => ({
  xummService: {},
}));

jest.mock('../../src/services/trustitag.service', () => ({
  trustitagService: {},
}));

jest.mock('../../src/services/exchange/exchange.service', () => ({
  exchangeService: {
    getLiveExchangeRates: jest.fn().mockResolvedValue({
      success: true,
      data: {
        rates: [{ currency: 'USD', rate: 2 }],
      },
    }),
  },
}));

jest.mock('../../src/services/escrow/escrowCreationFee.service', () => ({
  getEscrowCreationFeeSettings: jest.fn().mockResolvedValue({
    personalFreelancerFeePercentage: 2,
    supplierFeePercentage: 2,
    payrollFeePercentage: 2,
  }),
  resolveEscrowCreationFeePercentageByType: jest.fn().mockReturnValue(2),
}));

jest.mock('../../src/xrpl/escrow/xrpl-escrow.service', () => ({
  xrplEscrowService: {
    createEscrow: jest.fn(),
  },
}));

jest.mock('../../src/services/email.service', () => ({
  emailService: {
    sendEscrowCreationConfirmationToPayer: jest.fn().mockResolvedValue(undefined),
    sendEscrowCreationNotificationToCounterparty: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/notification/notification.service', () => ({
  notificationService: {
    createNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

import { supabaseAdmin } from '../../src/config/supabase';
import { xrplEscrowService } from '../../src/xrpl/escrow/xrpl-escrow.service';
import { emailService } from '../../src/services/email.service';
const { escrowService } = require('../../src/services/escrow/escrow.service.ts');

describe('Stripe escrow flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('finalizeStripeFundedEscrow is idempotent when xrpl_escrow_id already set', async () => {
    const escrowRow = {
      id: 'escrow-1',
      payment_method: 'stripe',
      xrpl_escrow_id: 'existing-tx-hash',
      user_id: 'user-1',
      counterparty_id: 'user-2',
      amount_xrp: 10,
      amount_usd: 20,
    };

    const admin = supabaseAdmin as unknown as { from: jest.Mock };
    admin.from.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: escrowRow, error: null }),
    }));

    const result = await escrowService.finalizeStripeFundedEscrow('escrow-1');

    expect(result.success).toBe(true);
    expect(result.message).toContain('already finalized');
    expect(result.data?.xrplTxHash).toBe('existing-tx-hash');
    expect(xrplEscrowService.createEscrow).not.toHaveBeenCalled();
    expect(emailService.sendEscrowCreationConfirmationToPayer).not.toHaveBeenCalled();
  });

  it('createEscrow with paymentMethod stripe persists pending escrow without XRPL or emails', async () => {
    let insertedEscrow: Record<string, unknown> | null = null;

    const admin = supabaseAdmin as unknown as { from: jest.Mock };
    admin.from.mockImplementation((table: string) => {
      if (table === 'wallets') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockImplementation((_column: string, value: string) => {
            if (value === 'user-2') {
              return Promise.resolve({
                data: [{ xrpl_address: 'rCounterparty123', user_id: 'user-2' }],
                error: null,
              });
            }
            return {
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
              }),
            };
          }),
        };
      }

      if (table === 'escrows') {
        return {
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: { escrow_sequence: 5 }, error: null }),
          insert: jest.fn().mockImplementation((payload: Record<string, unknown>) => {
            insertedEscrow = payload;
            return {
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'new-stripe-escrow-id',
                    status: 'pending',
                    ...payload,
                  },
                  error: null,
                }),
              }),
            };
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await escrowService.createEscrow('user-1', {
      paymentMethod: 'stripe',
      amount: 20,
      currency: 'USD',
      counterpartyId: 'user-2',
    });

    expect(result.success).toBe(true);
    expect(result.data?.paymentMethod).toBe('stripe');
    expect(result.data?.paymentStatus).toBe('unpaid');
    expect(result.data?.payableAmountUsd).toBe(20.4);
    expect(insertedEscrow).toMatchObject({
      payment_method: 'stripe',
      payment_status: 'unpaid',
      status: 'pending',
      xrpl_escrow_id: null,
      payable_amount_usd: 20.4,
    });
    expect(xrplEscrowService.createEscrow).not.toHaveBeenCalled();
    expect(emailService.sendEscrowCreationConfirmationToPayer).not.toHaveBeenCalled();
    expect(emailService.sendEscrowCreationNotificationToCounterparty).not.toHaveBeenCalled();
  });
});
