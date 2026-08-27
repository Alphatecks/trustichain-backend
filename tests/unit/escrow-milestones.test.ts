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
    getXrpUsdRate: jest.fn().mockResolvedValue(2),
    resolveEscrowSettlementAmounts: jest.fn(async (amount: number, currency: string) => {
      const normalized = (currency || 'USD').trim().toUpperCase();
      const xrpUsdRate = 2;
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
      return {
        success: false,
        message: 'unsupported',
        error: 'unsupported',
      };
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
  calculateEscrowCreationFeeBreakdown: jest.fn().mockResolvedValue({
    creationFeeUsd: 0.4,
    creationFeePercentage: 2,
    payableAmountUsd: 20.4,
    feeCategory: 'personal_freelancer',
  }),
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
const { escrowService } = require('../../src/services/escrow/escrow.service.ts');

describe('escrow milestones on create', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function mockStripeCreateWithMilestones(insertedMilestones: Record<string, unknown>[]) {
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
          insert: jest.fn().mockImplementation((payload: Record<string, unknown>) => ({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'milestone-escrow-id',
                  status: 'pending',
                  ...payload,
                },
                error: null,
              }),
            }),
          })),
        };
      }

      if (table === 'escrow_milestones') {
        return {
          insert: jest.fn().mockImplementation((rows: Record<string, unknown>[]) => {
            insertedMilestones.push(...rows);
            return { error: null };
          }),
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: insertedMilestones.map((row, index) => ({
              id: `ms-${index + 1}`,
              ...row,
              status: 'pending',
              created_at: '2026-08-27T00:00:00.000Z',
              completed_at: null,
            })),
            error: null,
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
  }

  it('persists added milestones when releaseType is Milestones', async () => {
    const insertedMilestones: Record<string, unknown>[] = [];
    mockStripeCreateWithMilestones(insertedMilestones);

    const result = await escrowService.createEscrow('user-1', {
      paymentMethod: 'stripe',
      amount: 20,
      totalAmount: 20,
      currency: 'USD',
      counterpartyId: 'user-2',
      transactionType: 'freelance',
      releaseType: 'Milestones',
      expectedCompletionDate: '27/08/2026',
      disputeResolutionPeriod: '14 days',
      milestones: [
        { amount: 200, details: 'for work' },
      ],
    });

    expect(result.success).toBe(true);
    expect(insertedMilestones).toHaveLength(1);
    expect(insertedMilestones[0]).toMatchObject({
      escrow_id: 'milestone-escrow-id',
      milestone_order: 1,
      milestone_details: 'for work',
      milestone_amount_usd: 200,
      status: 'pending',
    });
    expect(result.data?.milestones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          milestoneDetails: 'for work',
          milestoneAmountUsd: 200,
          milestoneOrder: 1,
          status: 'pending',
        }),
      ])
    );
  });

  it('rejects milestone escrows with no added milestones', async () => {
    const insertedMilestones: Record<string, unknown>[] = [];
    mockStripeCreateWithMilestones(insertedMilestones);

    const result = await escrowService.createEscrow('user-1', {
      paymentMethod: 'stripe',
      amount: 20,
      currency: 'USD',
      counterpartyId: 'user-2',
      transactionType: 'freelance',
      releaseType: 'Milestones',
      expectedCompletionDate: '2026-08-27',
      disputeResolutionPeriod: '14 days',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/at least one milestone/i);
    expect(insertedMilestones).toHaveLength(0);
  });
});
