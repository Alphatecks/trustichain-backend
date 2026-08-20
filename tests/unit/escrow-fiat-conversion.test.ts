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
    getBalance: jest.fn().mockResolvedValue(500),
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
    getXrpUsdRate: jest.fn().mockResolvedValue(2),
    getLiveExchangeRates: jest.fn().mockResolvedValue({
      success: true,
      data: {
        rates: [{ currency: 'NGN', rate: 1600 }],
        quoteDirection: 'unitsPerUsd',
        quoteBase: 'USD',
        lastUpdated: new Date().toISOString(),
      },
    }),
    resolveEscrowSettlementAmounts: jest.fn(async (amount: number, currency: string) => {
      const normalized = (currency || 'USD').trim().toUpperCase();
      const xrpUsdRate = 2;
      if (normalized === 'XRP') {
        return {
          success: true,
          data: {
            denominationAmount: amount,
            denominationCurrency: normalized,
            amountUsd: parseFloat((amount * xrpUsdRate).toFixed(2)),
            amountXrp: parseFloat(amount.toFixed(6)),
            settlementCurrency: 'XRP',
            xrpUsdRate,
          },
        };
      }
      if (normalized === 'USD' || normalized === 'RLUSD') {
        return {
          success: true,
          data: {
            denominationAmount: amount,
            denominationCurrency: normalized,
            amountUsd: parseFloat(amount.toFixed(2)),
            amountXrp: parseFloat((amount / xrpUsdRate).toFixed(6)),
            settlementCurrency: 'XRP',
            xrpUsdRate,
          },
        };
      }
      const amountUsd = parseFloat((amount / 1600).toFixed(2));
      return {
        success: true,
        data: {
          denominationAmount: amount,
          denominationCurrency: normalized,
          amountUsd,
          amountXrp: parseFloat((amountUsd / xrpUsdRate).toFixed(6)),
          settlementCurrency: 'XRP',
          xrpUsdRate,
        },
      };
    }),
  },
}));

jest.mock('../../src/services/escrow/escrowCreationFee.service', () => ({
  getEscrowCreationFeeSettings: jest.fn().mockResolvedValue({
    personalFreelancerFeePercentage: 5,
    supplierFeePercentage: 5,
    payrollFeePercentage: 5,
  }),
  resolveEscrowCreationFeePercentageByType: jest.fn().mockReturnValue(5),
}));

jest.mock('../../src/xrpl/escrow/xrpl-escrow.service', () => ({
  xrplEscrowService: {
    createEscrow: jest.fn().mockResolvedValue('mock-tx-hash'),
  },
}));

jest.mock('../../src/services/encryption/encryption.service', () => ({
  encryptionService: {
    decrypt: jest.fn().mockReturnValue('sMockSecret123456789012345678901234567890'),
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
import { xrplWalletService } from '../../src/xrpl/wallet/xrpl-wallet.service';
import { xrplEscrowService } from '../../src/xrpl/escrow/xrpl-escrow.service';
const { escrowService } = require('../../src/services/escrow/escrow.service.ts');

describe('Escrow fiat denomination conversion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('createEscrow converts NGN to small XRP amount and checks balance in XRP', async () => {
    let insertedEscrow: Record<string, unknown> | null = null;

    const admin = supabaseAdmin as unknown as { from: jest.Mock };
    admin.from.mockImplementation((table: string) => {
      if (table === 'wallets') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockImplementation((_column: string, value: string) => {
            if (value === 'user-1') {
              return {
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                      xrpl_address: 'rPayer123456789012345678901234',
                      encrypted_wallet_secret: 'encrypted-secret',
                    },
                    error: null,
                  }),
                }),
              };
            }
            if (value === 'user-2') {
              return Promise.resolve({
                data: [{ xrpl_address: 'rCounterparty123456789012345678901', user_id: 'user-2' }],
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
          maybeSingle: jest.fn().mockResolvedValue({ data: { escrow_sequence: 1 }, error: null }),
          insert: jest.fn().mockImplementation((payload: Record<string, unknown>) => {
            insertedEscrow = payload;
            return {
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'escrow-ngn-id',
                    status: 'active',
                    created_at: new Date().toISOString(),
                    ...payload,
                  },
                  error: null,
                }),
              }),
            };
          }),
        };
      }

      if (table === 'transactions') {
        return {
          insert: jest.fn().mockResolvedValue({ error: null }),
        };
      }

      return {
        rpc: jest.fn().mockResolvedValue({ error: null }),
      };
    });

    const result = await escrowService.createEscrow('user-1', {
      paymentMethod: 'trustichain',
      amount: 20000,
      currency: 'NGN',
      totalAmount: 20000,
      counterpartyId: 'user-2',
      transactionType: 'freelance',
    });

    expect(result.success).toBe(true);
    expect(insertedEscrow).toMatchObject({
      amount_usd: 12.5,
      amount_xrp: 6.25,
      creation_fee_usd: 0.625,
      payable_amount_usd: 13.13,
    });
    expect(xrplEscrowService.createEscrow).toHaveBeenCalledWith(
      expect.objectContaining({
        amountXrp: 6.25,
      })
    );
    expect(xrplWalletService.getBalance).toHaveBeenCalled();
  });
});
