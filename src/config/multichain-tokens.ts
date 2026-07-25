/**
 * Token contract / mint addresses and RPC endpoints per MULTICHAIN_NETWORK.
 * Override via env for production token addresses.
 */

export type StablecoinAsset = 'USDT' | 'USDC';
export type DepositNetwork = 'ERC20' | 'TRC20' | 'BEP20' | 'SOLANA';
export type MultichainNetworkMode = 'testnet' | 'mainnet';

export interface TokenMonitorConfig {
  asset: StablecoinAsset;
  network: DepositNetwork;
  decimals: number;
  /** EVM contract (ERC20/BEP20) */
  evmContract?: string;
  /** Tron TRC20 contract (base58 or hex) */
  tronContract?: string;
  /** Solana SPL mint */
  solanaMint?: string;
}

export interface MultichainRpcConfig {
  evmEthereum: string;
  evmBsc: string;
  solana: string;
  tron: string;
}

const TESTNET_TOKENS: TokenMonitorConfig[] = [
  {
    asset: 'USDT',
    network: 'ERC20',
    decimals: 6,
    evmContract: process.env.USDT_ERC20_CONTRACT_TESTNET || '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
  },
  {
    asset: 'USDT',
    network: 'BEP20',
    decimals: 18,
    evmContract: process.env.USDT_BEP20_CONTRACT_TESTNET || '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
  },
  {
    asset: 'USDT',
    network: 'TRC20',
    decimals: 6,
    tronContract: process.env.USDT_TRC20_CONTRACT_TESTNET || 'TG3XXyExBkPp9nzdajDZsozEu4Bka3j2NJ',
  },
  {
    asset: 'USDC',
    network: 'BEP20',
    decimals: 18,
    evmContract: process.env.USDC_BEP20_CONTRACT_TESTNET || '0x64544969ed7EBf5f0836792333253560E715FcA4',
  },
  {
    asset: 'USDC',
    network: 'SOLANA',
    decimals: 6,
    solanaMint: process.env.USDC_SOLANA_MINT_TESTNET || '4zMMC9srt5Ri5X14GAgXhaHii3qpjzjDbL1F7KSHm9zk',
  },
];

const MAINNET_TOKENS: TokenMonitorConfig[] = [
  {
    asset: 'USDT',
    network: 'ERC20',
    decimals: 6,
    evmContract: process.env.USDT_ERC20_CONTRACT_MAINNET || '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  },
  {
    asset: 'USDT',
    network: 'BEP20',
    decimals: 18,
    evmContract: process.env.USDT_BEP20_CONTRACT_MAINNET || '0x55d398326f99059fF775485246999027B3197955',
  },
  {
    asset: 'USDT',
    network: 'TRC20',
    decimals: 6,
    tronContract: process.env.USDT_TRC20_CONTRACT_MAINNET || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  },
  {
    asset: 'USDC',
    network: 'BEP20',
    decimals: 18,
    evmContract: process.env.USDC_BEP20_CONTRACT_MAINNET || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  },
  {
    asset: 'USDC',
    network: 'SOLANA',
    decimals: 6,
    solanaMint: process.env.USDC_SOLANA_MINT_MAINNET || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  },
];

export function getTokenMonitorConfigs(mode: MultichainNetworkMode): TokenMonitorConfig[] {
  return mode === 'mainnet' ? MAINNET_TOKENS : TESTNET_TOKENS;
}

export function getMultichainRpcConfig(mode: MultichainNetworkMode): MultichainRpcConfig {
  if (mode === 'mainnet') {
    return {
      evmEthereum: process.env.ETH_MAINNET_RPC_URL || 'https://eth.llamarpc.com',
      evmBsc: process.env.BSC_MAINNET_RPC_URL || 'https://bsc-dataseed.binance.org',
      solana: process.env.SOLANA_MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com',
      tron: process.env.TRON_MAINNET_API_URL || 'https://api.trongrid.io',
    };
  }
  return {
    evmEthereum: process.env.ETH_SEPOLIA_RPC_URL || 'https://ethereum-sepolia.publicnode.com',
    evmBsc: process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545',
    solana: process.env.SOLANA_DEVNET_RPC_URL || 'https://api.devnet.solana.com',
    tron: process.env.TRON_SHASTA_API_URL || 'https://api.shasta.trongrid.io',
  };
}

export function getEvmRpcForNetwork(
  network: DepositNetwork,
  rpc: MultichainRpcConfig
): string {
  return network === 'BEP20' ? rpc.evmBsc : rpc.evmEthereum;
}

/** Chain metadata for WalletConnect / Reown funding UI. */
export interface DepositNetworkMeta {
  chainType: 'evm' | 'tron' | 'solana';
  /** EVM numeric chain id (WalletConnect / wagmi). Absent for Tron/Solana. */
  chainId?: number;
  /** CAIP-2 chain id, e.g. eip155:1, solana:devnet, tron:mainnet */
  caip2: string;
  chainName: string;
  rpcUrl: string;
}

export interface FundingTokenConfig {
  asset: StablecoinAsset;
  network: DepositNetwork;
  chainType: 'evm' | 'tron' | 'solana';
  chainId?: number;
  caip2: string;
  chainName: string;
  decimals: number;
  /** ERC-20 / BEP-20 contract, TRC-20 contract, or Solana mint */
  tokenAddress: string;
  rpcUrl: string;
}

export interface WalletFundingConfig {
  mode: MultichainNetworkMode;
  tokens: FundingTokenConfig[];
  supportedPairs: {
    USDT: DepositNetwork[];
    USDC: DepositNetwork[];
  };
}

function getDepositNetworkMeta(
  network: DepositNetwork,
  mode: MultichainNetworkMode,
  rpc: MultichainRpcConfig
): DepositNetworkMeta {
  if (mode === 'mainnet') {
    switch (network) {
      case 'ERC20':
        return {
          chainType: 'evm',
          chainId: 1,
          caip2: 'eip155:1',
          chainName: 'Ethereum',
          rpcUrl: rpc.evmEthereum,
        };
      case 'BEP20':
        return {
          chainType: 'evm',
          chainId: 56,
          caip2: 'eip155:56',
          chainName: 'BNB Smart Chain',
          rpcUrl: rpc.evmBsc,
        };
      case 'TRC20':
        return {
          chainType: 'tron',
          caip2: 'tron:mainnet',
          chainName: 'Tron',
          rpcUrl: rpc.tron,
        };
      case 'SOLANA':
        return {
          chainType: 'solana',
          caip2: 'solana:mainnet',
          chainName: 'Solana',
          rpcUrl: rpc.solana,
        };
    }
  }

  switch (network) {
    case 'ERC20':
      return {
        chainType: 'evm',
        chainId: 11155111,
        caip2: 'eip155:11155111',
        chainName: 'Ethereum Sepolia',
        rpcUrl: rpc.evmEthereum,
      };
    case 'BEP20':
      return {
        chainType: 'evm',
        chainId: 97,
        caip2: 'eip155:97',
        chainName: 'BSC Testnet',
        rpcUrl: rpc.evmBsc,
      };
    case 'TRC20':
      return {
        chainType: 'tron',
        caip2: 'tron:shasta',
        chainName: 'Tron Shasta',
        rpcUrl: rpc.tron,
      };
    case 'SOLANA':
      return {
        chainType: 'solana',
        caip2: 'solana:devnet',
        chainName: 'Solana Devnet',
        rpcUrl: rpc.solana,
      };
  }
}

function tokenAddressOf(token: TokenMonitorConfig): string | undefined {
  return token.evmContract ?? token.tronContract ?? token.solanaMint;
}

/** Full funding config for frontend Reown / WalletConnect wiring. */
export function getWalletFundingConfig(mode: MultichainNetworkMode): WalletFundingConfig {
  const rpc = getMultichainRpcConfig(mode);
  const tokens: FundingTokenConfig[] = [];

  for (const token of getTokenMonitorConfigs(mode)) {
    const address = tokenAddressOf(token);
    if (!address) continue;
    const meta = getDepositNetworkMeta(token.network, mode, rpc);
    tokens.push({
      asset: token.asset,
      network: token.network,
      chainType: meta.chainType,
      chainId: meta.chainId,
      caip2: meta.caip2,
      chainName: meta.chainName,
      decimals: token.decimals,
      tokenAddress: address,
      rpcUrl: meta.rpcUrl,
    });
  }

  return {
    mode,
    tokens,
    supportedPairs: {
      USDT: ['ERC20', 'TRC20', 'BEP20'],
      USDC: ['BEP20', 'SOLANA'],
    },
  };
}
