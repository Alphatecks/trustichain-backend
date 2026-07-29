jest.mock('../../src/config/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
  supabase: null,
}));

jest.mock('../../src/services/notification/notification.service', () => ({
  notificationService: {
    createNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

import { supabaseAdmin } from '../../src/config/supabase';
const { WalletStripeFundingService } = require('../../src/services/wallet/wallet-stripe-funding.service.ts');

function createSingleRowQuery(row: any) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: row, error: null }),
    single: jest.fn().mockResolvedValue({ data: row, error: null }),
  };
}

describe('WalletStripeFundingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects createFundingIntent when amountUsd is missing', async () => {
    const service = new WalletStripeFundingService();
    const result = await service.createFundingIntent('user-1', {} as any);

    expect(result.success).toBe(false);
    expect(result.message).toContain('amountUsd');
  });

  it('rejects createFundingIntent when wallet does not exist', async () => {
    const admin = supabaseAdmin as unknown as { from: jest.Mock };
    admin.from.mockImplementation((table: string) => {
      if (table === 'wallets') {
        return createSingleRowQuery(null);
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const service = new WalletStripeFundingService();
    const result = await service.createFundingIntent('user-1', { amountUsd: 25 });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Wallet not found');
  });

  it('returns not found for unknown funding status lookup', async () => {
    const admin = supabaseAdmin as unknown as { from: jest.Mock };
    admin.from.mockImplementation((table: string) => {
      if (table === 'wallet_funding_attempts') {
        return createSingleRowQuery(null);
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const service = new WalletStripeFundingService();
    const result = await service.getFundingStatus('user-1', { fundingAttemptId: 'attempt-1' });

    expect(result.success).toBe(false);
    expect(result.message).toContain('not found');
  });
});
