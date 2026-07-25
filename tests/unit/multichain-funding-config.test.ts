import { getWalletFundingConfig } from '../../src/config/multichain-tokens';

describe('getWalletFundingConfig', () => {
  it('returns testnet tokens with EVM chain ids for WalletConnect', () => {
    const config = getWalletFundingConfig('testnet');
    expect(config.mode).toBe('testnet');
    expect(config.supportedPairs.USDT).toEqual(['ERC20', 'TRC20', 'BEP20']);
    expect(config.supportedPairs.USDC).toEqual(['BEP20', 'SOLANA']);

    const usdtErc20 = config.tokens.find((t) => t.asset === 'USDT' && t.network === 'ERC20');
    expect(usdtErc20).toMatchObject({
      chainType: 'evm',
      chainId: 11155111,
      caip2: 'eip155:11155111',
      decimals: 6,
    });
    expect(usdtErc20?.tokenAddress).toMatch(/^0x/i);

    const usdcSol = config.tokens.find((t) => t.asset === 'USDC' && t.network === 'SOLANA');
    expect(usdcSol).toMatchObject({
      chainType: 'solana',
      caip2: 'solana:devnet',
      decimals: 6,
    });
    expect(usdcSol?.chainId).toBeUndefined();
  });

  it('returns mainnet chain ids', () => {
    const config = getWalletFundingConfig('mainnet');
    const usdtBep20 = config.tokens.find((t) => t.asset === 'USDT' && t.network === 'BEP20');
    expect(usdtBep20).toMatchObject({
      chainId: 56,
      caip2: 'eip155:56',
      chainName: 'BNB Smart Chain',
    });
  });
});
