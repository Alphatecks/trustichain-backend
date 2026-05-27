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
