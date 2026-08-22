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
  xrplWalletService: {},
}));

jest.mock('../../src/services/xumm/xumm.service', () => ({
  xummService: {},
}));

jest.mock('../../src/services/trustitag.service', () => ({
  trustitagService: {},
}));

jest.mock('../../src/services/exchange/exchange.service', () => ({
  exchangeService: {},
}));

jest.mock('../../src/services/email.service', () => ({
  emailService: {},
}));

jest.mock('../../src/services/notification/notification.service', () => ({
  notificationService: {},
}));

jest.mock('../../src/xrpl/escrow/xrpl-escrow.service', () => ({
  xrplEscrowService: {},
}));

import { supabaseAdmin } from '../../src/config/supabase';
const { escrowService } = require('../../src/services/escrow/escrow.service.ts');

describe('getInitiatorLockedEscrowAmountUsd', () => {
  const mockFrom = supabaseAdmin!.from as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function mockEscrowQuery(rows: unknown[]) {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
    };
    chain.or.mockResolvedValue({ data: rows, error: null });
    mockFrom.mockReturnValue(chain);
    return chain;
  }

  it('sums pending initiator escrows not yet on-chain', async () => {
    mockEscrowQuery([
      { amount_usd: 50, payable_amount_usd: 55, payment_method: 'xrp_wallet', payment_status: 'unpaid' },
      { amount_usd: 20, payable_amount_usd: null, payment_method: 'stripe', payment_status: 'succeeded' },
    ]);

    const locked = await escrowService.getInitiatorLockedEscrowAmountUsd('user-1', 'personal');
    expect(locked).toBe(75);
  });

  it('excludes unpaid stripe escrows', async () => {
    mockEscrowQuery([
      { amount_usd: 100, payable_amount_usd: 100, xrpl_escrow_id: 'abc123', payment_method: 'xrp_wallet', payment_status: 'succeeded' },
      { amount_usd: 30, payable_amount_usd: 30, xrpl_escrow_id: null, payment_method: 'stripe', payment_status: 'unpaid' },
      { amount_usd: 15, payable_amount_usd: 15, xrpl_escrow_id: null, payment_method: 'xrp_wallet', payment_status: 'unpaid' },
    ]);

    const locked = await escrowService.getInitiatorLockedEscrowAmountUsd('user-1', 'personal');
    expect(locked).toBe(115);

    const forAvailable = await escrowService.getInitiatorLockedEscrowAmountUsd('user-1', 'personal', {
      excludeOnChain: true,
    });
    expect(forAvailable).toBe(15);
  });
});
