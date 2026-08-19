import type { TransactionType } from './transaction.types';
import type { UserFacingAmount } from '../../utils/userFacingAmount';

export interface WalletBalanceResponse {
  success: boolean;
  message: string;
  data?: {
    balance: {
      rlusd: number;
      usdt: number;
      usdc: number;
      usd: number;
    };
    addresses: {
      rlusd: string;
    };
    stablecoinAddresses?: StablecoinDepositAddressMap;
    multichainNetwork?: Record<string, unknown>;
  };
  /** @deprecated Use data.addresses.rlusd */
  xrplAddress?: string;
  /** @deprecated Use data.addresses.rlusd */
  rlusdAddress?: string;
  /** @deprecated Use data.addresses */
  depositAddresses?: WalletXrplDepositAddresses;
  stablecoinAddresses?: StablecoinDepositAddressMap;
  multichainNetwork?: Record<string, unknown>;
  error?: string;
}

export type WalletSwapCurrency = 'XRP' | 'USDT' | 'USDC';

export interface SwapQuoteRequest {
  amount: number;
  fromCurrency: WalletSwapCurrency;
  toCurrency: WalletSwapCurrency;
  useDEX?: boolean; // If true, get price from XRPL DEX instead of external API
}

export interface SwapQuoteResponse {
  success: boolean;
  message: string;
  data?: {
    fromCurrency: WalletSwapCurrency;
    toCurrency: WalletSwapCurrency;
    fromAmount: number;
    toAmount: number;
    /**
     * Conversion rate expressed as: 1 fromCurrency = rate toCurrency
     */
    rate: number;
    /**
     * Approximate USD value of the swap after fees
     */
    usdValue: number;
    /**
     * Platform fee charged for the swap, in USD-equivalent
     */
    feeUsd: number;
  };
  error?: string;
}

export interface SwapExecuteRequest {
  amount: number;
  fromCurrency: WalletSwapCurrency;
  toCurrency: WalletSwapCurrency;
  swapType?: 'internal' | 'onchain'; // 'internal' = database only, 'onchain' = real XRPL DEX swap
  slippageTolerance?: number; // Percentage (0-100), default 5%
}

export interface SwapExecuteResponse {
  success: boolean;
  message: string;
  data?: {
    transactionId: string;
    fromCurrency: WalletSwapCurrency;
    toCurrency: WalletSwapCurrency;
    fromAmount: number;
    toAmount: number;
    rate: number;
    usdValue: number;
    feeUsd: number;
    status: string;
    swapType?: 'internal' | 'onchain';
    xrplTxHash?: string; // Only for on-chain swaps
    transactionBlob?: string; // For user signing (on-chain swaps)
    xummUrl?: string; // For XUMM signing (on-chain swaps)
    xummUuid?: string; // For XUMM signing (on-chain swaps)
  };
  error?: string;
}

export interface FundWalletRequest {
  amount: number;
  currency: 'USD' | 'XRP' | 'USDT' | 'USDC' | 'RLUSD';
}

export interface FundWalletResponse {
  success: boolean;
  message: string;
  data?: {
    transactionId: string;
    amount: {
      usd: number;
      xrp: number;
    };
    xrplTxHash?: string;
    xummUrl?: string;
    xummUuid?: string;
    transaction?: any;
    transactionBlob?: string;
    destinationAddress?: string;
    amountXrp?: number;
    amountToken?: number;
    currency?: string;
    walletType?: 'xaman' | 'metamask' | 'browser';
    note?: string;
    status: string;
    stablecoinAddresses?: StablecoinDepositAddressMap;
  };
  error?: string;
}

export interface WithdrawWalletRequest {
  amount: number;
  currency: 'USD' | 'XRP';
  destinationAddress: string;
}

/** POST /api/wallet/send/trustitag — send XRP to another TrustiChain user by Trustitag */
export interface SendWalletToTrustitagRequest {
  trustitag: string;
  amount: number;
  currency: 'USD' | 'XRP';
}

export type SendWalletToTrustitagResponse = WithdrawWalletResponse;

export interface WithdrawWalletResponse {
  success: boolean;
  message: string;
  data?: {
    transactionId: string;
    amount: {
      usd: number;
      xrp: number;
    };
    xrplTxHash?: string;
    status: string;
  };
  error?: string;
}

export interface WalletTransaction {
  id: string;
  type: TransactionType;
  amount: UserFacingAmount;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  xrplTxHash?: string;
  description?: string;
  createdAt: string;
}

export interface ConnectWalletRequest {
  walletAddress: string; // XRPL address from MetaMask
}

export interface ConnectWalletResponse {
  success: boolean;
  message: string;
  data?: {
    walletAddress: string;
    previousAddress?: string;
  };
  error?: string;
  // Helpful information when validation fails
  help?: {
    detectedType?: 'ethereum' | 'invalid' | 'wrong_length';
    exampleCode?: string;
    correctFormat?: string;
  };
}

export interface DisconnectWalletResponse {
  success: boolean;
  message: string;
  data?: {
    previousAddress?: string;
  };
  error?: string;
}

export interface ValidateAddressRequest {
  walletAddress: string;
}

export interface ValidateAddressResponse {
  success: boolean;
  message: string;
  data?: {
    isValid: boolean;
    addressType: 'xrpl' | 'ethereum' | 'invalid';
    formattedAddress?: string;
    suggestions?: string[];
  };
  error?: string;
}

export interface ConnectXUMMRequest {
  // No body needed - XUMM will return the address
}

export interface ConnectXUMMResponse {
  success: boolean;
  message: string;
  data?: {
    xummUrl: string;
    xummUuid: string;
    qrCode?: string;
    qrUri?: string;
    instructions: string;
  };
  error?: string;
}

export interface ConnectXUMMStatusResponse {
  success: boolean;
  message: string;
  data?: {
    signed: boolean;
    walletAddress?: string;
    xummUuid: string;
    status: 'pending' | 'signed' | 'cancelled' | 'expired' | 'connected';
  };
  error?: string;
}

export type WalletFundingCurrency = 'XRP' | 'RLUSD' | 'USDT' | 'USDC';

export interface WalletXrplDepositAddresses {
  xrp: string;
  rlusd: string;
}

export interface StablecoinDepositAddressMap {
  USDT: Partial<Record<'ERC20' | 'TRC20' | 'BEP20', string>>;
  USDC: Partial<Record<'BEP20' | 'SOLANA', string>>;
}

export interface FundingTokenConfigResponse {
  asset: 'USDT' | 'USDC';
  network: 'ERC20' | 'TRC20' | 'BEP20' | 'SOLANA';
  chainType: 'evm' | 'tron' | 'solana';
  chainId?: number;
  caip2: string;
  chainName: string;
  decimals: number;
  tokenAddress: string;
  rpcUrl: string;
}

export interface WalletFundingConfigResponse {
  success: boolean;
  message: string;
  data?: {
    mode: 'testnet' | 'mainnet';
    tokens: FundingTokenConfigResponse[];
    supportedPairs: {
      USDT: Array<'ERC20' | 'TRC20' | 'BEP20'>;
      USDC: Array<'BEP20' | 'SOLANA'>;
    };
  };
  error?: string;
}

export interface NotifyDepositRequest {
  asset: 'USDT' | 'USDC';
  network: 'ERC20' | 'TRC20' | 'BEP20' | 'SOLANA';
  txHash: string;
}

export type MultichainDepositStatus = 'pending' | 'credited' | 'failed' | 'not_found';

export interface NotifyDepositResponse {
  success: boolean;
  message: string;
  data?: {
    status: Exclude<MultichainDepositStatus, 'not_found'>;
    asset: 'USDT' | 'USDC';
    network: 'ERC20' | 'TRC20' | 'BEP20' | 'SOLANA';
    txHash: string;
    amount?: number;
    transactionId?: string;
    creditId?: string;
    errorMessage?: string;
  };
  error?: string;
}

export interface DepositStatusResponse {
  success: boolean;
  message: string;
  data?: {
    status: MultichainDepositStatus;
    asset?: 'USDT' | 'USDC';
    network?: 'ERC20' | 'TRC20' | 'BEP20' | 'SOLANA';
    txHash: string;
    amount?: number;
    transactionId?: string;
    creditId?: string;
    errorMessage?: string;
  };
  error?: string;
}

export interface FundXUMMRequest {
  amount: number;
  currency?: WalletFundingCurrency; // Defaults to XRP
}

export interface FundXUMMResponse {
  success: boolean;
  message: string;
  data?: {
    transactionId: string;
    xummUrl: string;
    xummUuid: string;
    qrCode?: string;
    qrUri?: string;
    amount: number;
    destinationAddress: string;
    instructions: string;
  };
  error?: string;
}

export interface FundXUMMStatusResponse {
  success: boolean;
  message: string;
  data?: {
    signed: boolean;
    xummUuid: string;
    transactionId: string;
    status: 'pending' | 'signed' | 'submitted' | 'completed' | 'cancelled' | 'expired' | 'failed';
    xrplTxHash?: string;
    amount?: number;
  };
  error?: string;
}

export interface WalletTransactionsResponse {
  success: boolean;
  message: string;
  data?: {
    transactions: WalletTransaction[];
    total: number;
  };
  error?: string;
}

export interface XUMMPayloadStatusResponse {
  success: boolean;
  message: string;
  data?: {
    signed: boolean;
    signedTxBlob: string | null;
    cancelled: boolean;
    expired: boolean;
    xrplTxHash: string | null;
  };
  error?: string;
}

export interface WalletApiResponse<T = undefined> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export type WalletFundingBalanceAsset = 'USDT' | 'USDC';

export interface CreateWalletStripeFundingIntentRequest {
  amountUsd: number;
  currency?: string;
  suiteContext?: 'personal' | 'business';
  asset?: WalletFundingBalanceAsset;
  idempotencyKey?: string;
}

export interface WalletStripeFundingIntentResponseData {
  fundingAttemptId: string;
  intentId: string;
  clientSecret: string;
  status: string;
  amountUsd: number;
  currency: string;
  asset: WalletFundingBalanceAsset;
  suiteContext: 'personal' | 'business';
  requiresAction: boolean;
}

export interface WalletStripeFundingStatusData {
  fundingAttemptId: string;
  intentId: string;
  status: string;
  amountUsd: number;
  currency: string;
  asset: WalletFundingBalanceAsset;
  suiteContext: 'personal' | 'business';
  credited: boolean;
  transactionId?: string;
  creditedAt?: string;
  failureCode?: string;
  failureMessage?: string;
}

