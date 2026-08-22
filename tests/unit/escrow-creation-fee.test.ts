jest.mock('../../src/config/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
  supabase: null,
}));

import { supabaseAdmin } from '../../src/config/supabase';
import {
  calculateEscrowCreationFeeBreakdown,
  resolveEscrowCreationFeePercentageByType,
} from '../../src/services/escrow/escrowCreationFee.service';

describe('escrow creation fee', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolveEscrowCreationFeePercentageByType maps supply to supplier fee', () => {
    const settings = {
      personalFreelancerFeePercentage: 2,
      supplierFeePercentage: 5,
      payrollFeePercentage: 3,
    };
    expect(resolveEscrowCreationFeePercentageByType('supply', settings)).toBe(5);
    expect(resolveEscrowCreationFeePercentageByType('freelance', settings)).toBe(2);
    expect(resolveEscrowCreationFeePercentageByType('payroll', settings)).toBe(3);
  });

  it('calculateEscrowCreationFeeBreakdown uses admin percentage', async () => {
    const mockFrom = supabaseAdmin!.from as jest.Mock;
    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: {
          personal_freelancer_fee_percentage: 2.5,
          supplier_fee_percentage: 4,
          payroll_fee_percentage: 1,
        },
        error: null,
      }),
    });

    const breakdown = await calculateEscrowCreationFeeBreakdown(100, 'freelance');
    expect(breakdown.creationFeePercentage).toBe(2.5);
    expect(breakdown.creationFeeUsd).toBe(2.5);
    expect(breakdown.payableAmountUsd).toBe(102.5);
    expect(breakdown.feeCategory).toBe('personal_freelancer');
  });
});
