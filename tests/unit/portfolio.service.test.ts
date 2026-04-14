jest.mock('../../src/config/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
  supabase: null,
}));

import { supabaseAdmin } from '../../src/config/supabase';
const { portfolioService } = require('../../src/services/portfolio/portfolio.service.ts');

type EscrowRow = {
  id: string;
  created_at: string;
  updated_at: string | null;
  amount_usd: unknown;
};

function createEscrowQueryMock(rows: EscrowRow[]) {
  return {
    select: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue({ data: rows, error: null }),
  };
}

describe('PortfolioService personal monthly aggregation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('counts escrow amount in each month with personal activity and avoids duplicate same-month counting', async () => {
    const rows: EscrowRow[] = [
      // Created before target year, updated in Jan => Jan should include this amount.
      { id: 'escrow-a', created_at: '2023-12-25T10:00:00.000Z', updated_at: '2024-01-10T09:00:00.000Z', amount_usd: 100 },
      // Created in Feb, updated in Mar => amount should appear in both Feb and Mar.
      { id: 'escrow-b', created_at: '2024-02-05T12:00:00.000Z', updated_at: '2024-03-06T15:00:00.000Z', amount_usd: '200' },
      // Created and updated in Mar => counted only once in Mar.
      { id: 'escrow-c', created_at: '2024-03-08T09:00:00.000Z', updated_at: '2024-03-08T18:00:00.000Z', amount_usd: '1,250.50' },
      // Created in Mar with null updated_at => must still count for Mar.
      { id: 'escrow-d', created_at: '2024-03-15T09:00:00.000Z', updated_at: null, amount_usd: 50 },
    ];

    const query = createEscrowQueryMock(rows);
    const admin = supabaseAdmin as unknown as { from: jest.Mock };
    admin.from.mockReturnValue(query);

    const result = await portfolioService.getPortfolioPerformance('user-1', 'monthly', 2024);

    expect(result.success).toBe(true);
    expect(result.data?.timeframe).toBe('monthly');
    expect(result.data?.year).toBe(2024);
    expect(result.data?.data).toHaveLength(12);

    const jan = result.data?.data.find((d: { period: string; value: number }) => d.period === 'Jan');
    const feb = result.data?.data.find((d: { period: string; value: number }) => d.period === 'Feb');
    const mar = result.data?.data.find((d: { period: string; value: number }) => d.period === 'Mar');

    expect(jan?.value).toBe(100);
    expect(feb?.value).toBe(200);
    expect(mar?.value).toBe(1500.5);
  });
});
