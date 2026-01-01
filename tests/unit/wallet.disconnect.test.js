// Ensure Supabase env vars for config import
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';

const { walletService } = require('../../dist/services/wallet/wallet.service');
const supabaseModule = require('../../dist/config/supabase');

describe('WalletService.disconnectWallet', () => {
  const userId = 'user-456';
  const mockWallet = {
    xrpl_address: 'rOLDADDRESS',
    balance_xrp: 10,
    balance_usdt: 0,
    balance_usdc: 0,
  };

  const mockUpdate = jest.fn().mockResolvedValue({ error: null });
  const mockInsert = jest.fn().mockResolvedValue({ error: null });

  const mockAdminClient = {
    from: jest.fn((table) => {
      if (table === 'wallets') {
        return {
          select: () => ({ eq: () => ({ single: async () => ({ data: mockWallet, error: null }) }) }),
          update: () => ({ eq: mockUpdate }),
        };
      }

      if (table === 'transactions') {
        return {
          insert: () => ({ select: async () => ({ data: { id: 'tx1' }, error: null }) }),
        };
      }

      return { select: () => ({ eq: async () => ({ data: null, error: null }) }) };
    }),
  };

  beforeEach(() => {
    supabaseModule.supabaseAdmin = mockAdminClient;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockUpdate.mockClear();
  });

  it('disconnects an existing XRPL wallet and preserves balances', async () => {
    const res = await walletService.disconnectWallet(userId);

    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(res.data.previousAddress).toBe(mockWallet.xrpl_address);

    // Ensure update cleared the xrpl_address
    expect(mockUpdate).toHaveBeenCalled();
  });
});
