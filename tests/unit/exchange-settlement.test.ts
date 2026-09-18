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
        xrpUsdRate: 2,
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

describe('ExchangeService live rate sources', () => {
  const service = new ExchangeService();

  beforeEach(() => {
    service.clearCache();
    jest.restoreAllMocks();
    delete process.env.EXCHANGE_RATE_API_KEY;
    delete process.env.FALLBACK_XRP_USD_RATE;
  });

  it('falls back to CoinGecko when Coinbase XRP spot fails', async () => {
    global.fetch = jest.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      if (url.includes('coinbase')) {
        throw new Error('timeout');
      }
      if (url.includes('coingecko')) {
        return {
          ok: true,
          json: async () => ({ ripple: { usd: 1.32 } }),
        } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    });

    await expect(service.getXrpUsdRate()).resolves.toBe(1.32);
  });

  it('loads fiat from open.er-api and returns USD plus xrpUsdRate', async () => {
    global.fetch = jest.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      if (url.includes('open.er-api.com')) {
        return {
          ok: true,
          json: async () => ({
            result: 'success',
            rates: { EUR: 0.87, NGN: 1330.27, GBP: 0.75 },
          }),
        } as Response;
      }
      if (url.includes('coinbase')) {
        throw new Error('timeout');
      }
      if (url.includes('coingecko')) {
        return {
          ok: true,
          json: async () => ({ ripple: { usd: 1.32 } }),
        } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    });

    const result = await service.getLiveExchangeRates();
    expect(result.success).toBe(true);
    expect(result.data?.rates.find((entry) => entry.currency === 'USD')?.rate).toBe(1);
    expect(result.data?.rates.find((entry) => entry.currency === 'NGN')?.rate).toBe(1330.27);
    expect(result.data?.xrpUsdRate).toBe(1.32);
  });
});
