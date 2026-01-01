// Ensure Supabase env vars are set for config import
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'anon-key';

jest.mock('xrpl', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: async () => {},
    request: async () => { throw new Error('actNotFound'); },
    disconnect: async () => {},
  })),
}));

const { WalletService } = require('../../dist/services/wallet/wallet.service');
const supabaseModule = require('../../dist/config/supabase');
const { xrplWalletService } = require('../../dist/xrpl/wallet/xrpl-wallet.service');

describe('WalletService.getBalance - preserve DB balances when XRPL empty', () => {
  const userId = 'user-123';
  const mockWallet = {
    id: 'wallet-1',
    xrpl_address: 'rTESTADDRESS',
    balance_xrp: 10,
    balance_usdt: 5,
    balance_usdc: 5,
  };

  // Create a mock admin client that simulates Supabase queries
  const mockUpdate = jest.fn().mockResolvedValue({ error: null });

  const mockAdminClient = {
    from: jest.fn((table) => {
      if (table === 'wallets') {
        return {
          select: () => ({
            eq: () => ({ single: async () => ({ data: mockWallet, error: null }), maybeSingle: async () => ({ data: mockWallet, error: null }) }),
          }),
          update: () => ({ eq: mockUpdate }),
          insert: () => ({ select: async () => ({ data: mockWallet, error: null }) }),
        };
      }

      if (table === 'transactions') {
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ eq: () => ({ not: () => ({ limit: async () => ({ data: [], error: null }) }), limit: async () => ({ data: [], error: null }) }) }) }),
          }),
          insert: () => ({ select: async () => ({ data: { id: 'tx1' }, error: null }) }),
        };
      }

      return {
        select: () => ({ eq: async () => ({ data: null, error: null }) }),
      };
    }),
  };

  beforeEach(() => {
    // Replace supabaseAdmin with our mock
    supabaseModule.supabaseAdmin = mockAdminClient;

    // Mock XRPL balances to be all zero (empty connected wallet)
    jest.spyOn(xrplWalletService, 'getAllBalances').mockResolvedValue({ xrp: 0, usdt: 0, usdc: 0 });

    // Mock exchange rates to avoid external HTTP calls and speed up test
    const exchangeModule = require('../../dist/services/exchange/exchange.service');
    jest.spyOn(exchangeModule.exchangeService, 'getLiveExchangeRates').mockResolvedValue({ success: true, data: { rates: [{ currency: 'USD', rate: 1.85 }] } });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockUpdate.mockClear();
  });

  it('should preserve existing DB balances when connected XRPL wallet is empty', async () => {
    const svc = new WalletService();
    const res = await svc.getBalance(userId);

    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(res.data.balance.xrp).toBe(mockWallet.balance_xrp);
    expect(res.data.balance.usdt).toBe(mockWallet.balance_usdt);
    expect(res.data.balance.usdc).toBe(mockWallet.balance_usdc);

    // Ensure update() was not called to overwrite DB balances
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
