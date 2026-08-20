import { ExchangeService } from '../../src/services/exchange/exchange.service';

describe('ExchangeService.resolveEscrowSettlementAmounts', () => {
  const service = new ExchangeService();

  beforeEach(() => {
    service.clearCache();
    jest.restoreAllMocks();
  });

  it('converts fiat NGN to USD then XRP using unitsPerUsd rates', async () => {
    jest.spyOn(service, 'getXrpUsdRate').mockResolvedValue(2);
    jest.spyOn(service, 'getLiveExchangeRates').mockResolvedValue({
      success: true,
      message: 'ok',
      data: {
        rates: [{ currency: 'NGN', rate: 1600 }],
        quoteDirection: 'unitsPerUsd',
        quoteBase: 'USD',
        lastUpdated: new Date().toISOString(),
      },
    });

    const result = await service.resolveEscrowSettlementAmounts(20000, 'NGN');

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.amountUsd).toBe(12.5);
    expect(result.data.amountXrp).toBe(6.25);
    expect(result.data.denominationCurrency).toBe('NGN');
  });

  it('treats XRP amounts as settlement currency without fiat conversion', async () => {
    jest.spyOn(service, 'getXrpUsdRate').mockResolvedValue(2);

    const result = await service.resolveEscrowSettlementAmounts(10, 'XRP');

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.amountXrp).toBe(10);
    expect(result.data.amountUsd).toBe(20);
  });

  it('converts USD to XRP settlement', async () => {
    jest.spyOn(service, 'getXrpUsdRate').mockResolvedValue(2);

    const result = await service.resolveEscrowSettlementAmounts(20, 'USD');

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.amountUsd).toBe(20);
    expect(result.data.amountXrp).toBe(10);
  });
});
