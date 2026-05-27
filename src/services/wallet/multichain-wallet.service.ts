/**
 * Custodial deposit addresses for USDT / USDC on non-XRPL networks.
 * USDT: ERC-20, TRC-20, BEP-20
 * USDC: BEP-20, Solana
 */

import { Wallet as EvmWallet } from 'ethers';
import { Keypair } from '@solana/web3.js';
import { supabase, supabaseAdmin } from '../../config/supabase';
import { encryptionService } from '../encryption/encryption.service';
import type { WalletSuiteContext } from './wallet.service';

export type StablecoinAsset = 'USDT' | 'USDC';
export type DepositNetwork = 'ERC20' | 'TRC20' | 'BEP20' | 'SOLANA';
export type ChainType = 'evm' | 'tron' | 'solana';

export const USDT_DEPOSIT_NETWORKS: DepositNetwork[] = ['ERC20', 'TRC20', 'BEP20'];
export const USDC_DEPOSIT_NETWORKS: DepositNetwork[] = ['BEP20', 'SOLANA'];

export type StablecoinDepositAddressMap = {
  USDT: Partial<Record<'ERC20' | 'TRC20' | 'BEP20', string>>;
  USDC: Partial<Record<'BEP20' | 'SOLANA', string>>;
};

export type MultichainNetworkMode = 'testnet' | 'mainnet';

export interface MultichainNetworkInfo {
  mode: MultichainNetworkMode;
  /** Human-readable chain the user must send on (UI labels). */
  chains: {
    USDT: { ERC20: string; TRC20: string; BEP20: string };
    USDC: { BEP20: string; SOLANA: string };
  };
}

const TESTNET_CHAINS: MultichainNetworkInfo['chains'] = {
  USDT: { ERC20: 'Ethereum Sepolia', TRC20: 'Tron Shasta', BEP20: 'BSC Testnet' },
  USDC: { BEP20: 'BSC Testnet', SOLANA: 'Solana Devnet' },
};

const MAINNET_CHAINS: MultichainNetworkInfo['chains'] = {
  USDT: { ERC20: 'Ethereum', TRC20: 'Tron', BEP20: 'BNB Smart Chain' },
  USDC: { BEP20: 'BNB Smart Chain', SOLANA: 'Solana' },
};

export function getMultichainNetworkMode(): MultichainNetworkMode {
  const raw = (process.env.MULTICHAIN_NETWORK || 'testnet').toLowerCase();
  return raw === 'mainnet' ? 'mainnet' : 'testnet';
}

export function getMultichainNetworkInfo(): MultichainNetworkInfo {
  const mode = getMultichainNetworkMode();
  return {
    mode,
    chains: mode === 'testnet' ? TESTNET_CHAINS : MAINNET_CHAINS,
  };
}

function getTronGridHost(): string {
  return getMultichainNetworkMode() === 'testnet'
    ? 'https://api.shasta.trongrid.io'
    : 'https://api.trongrid.io';
}

function isValidAssetNetwork(asset: StablecoinAsset, network: DepositNetwork): boolean {
  if (asset === 'USDT') {
    return (USDT_DEPOSIT_NETWORKS as string[]).includes(network);
  }
  return (USDC_DEPOSIT_NETWORKS as string[]).includes(network);
}

/** Tron base58 address from secp256k1 private key (TRC-20 deposits). */
function tronAddressFromPrivateKey(privateKeyHex: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const TronWeb = require('tronweb');
  const tronWeb = new TronWeb({ fullHost: getTronGridHost() });
  return tronWeb.address.fromPrivateKey(privateKeyHex.replace(/^0x/, ''));
}

function generateEvmWallet(): { address: string; privateKey: string } {
  const w = EvmWallet.createRandom();
  return { address: w.address, privateKey: w.privateKey };
}

function generateTronWallet(): { address: string; privateKey: string } {
  const evm = generateEvmWallet();
  const pk = evm.privateKey.startsWith('0x') ? evm.privateKey.slice(2) : evm.privateKey;
  return { address: tronAddressFromPrivateKey(pk), privateKey: evm.privateKey };
}

function generateSolanaWallet(): { address: string; secretKey: Uint8Array } {
  const kp = Keypair.generate();
  return { address: kp.publicKey.toBase58(), secretKey: kp.secretKey };
}

export class MultichainWalletService {
  getNetworkInfo(): MultichainNetworkInfo {
    return getMultichainNetworkInfo();
  }

  validateAssetNetwork(asset: string, network: string): asset is StablecoinAsset {
    if (asset !== 'USDT' && asset !== 'USDC') return false;
    return isValidAssetNetwork(asset, network as DepositNetwork);
  }

  /**
   * Create missing deposit addresses for a wallet (idempotent).
   * ERC-20 and BEP-20 USDT/USDC EVM deposits share one 0x address per user wallet.
   */
  async provisionDepositAddresses(
    userId: string,
    walletId: string,
    suiteContext: WalletSuiteContext
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const adminClient = supabaseAdmin || supabase;
    const chainEnvironment = getMultichainNetworkMode();

    const { data: existing } = await adminClient
      .from('wallet_deposit_addresses')
      .select('asset, network, address')
      .eq('user_id', userId)
      .eq('suite_context', suiteContext)
      .eq('chain_environment', chainEnvironment);

    const existingSet = new Set((existing ?? []).map((r) => `${r.asset}:${r.network}`));

    const rows: Array<{
      user_id: string;
      wallet_id: string;
      suite_context: WalletSuiteContext;
      asset: StablecoinAsset;
      network: DepositNetwork;
      address: string;
      chain_type: ChainType;
      chain_environment: MultichainNetworkMode;
      encrypted_secret: string | null;
    }> = [];

    let evmWallet: { address: string; privateKey: string } | null = null;
    let tronWallet: { address: string; privateKey: string } | null = null;
    let solanaWallet: { address: string; secretKey: Uint8Array } | null = null;

    const needEvm =
      !existingSet.has('USDT:ERC20') ||
      !existingSet.has('USDT:BEP20') ||
      !existingSet.has('USDC:BEP20');
    const needTron = !existingSet.has('USDT:TRC20');
    const needSolana = !existingSet.has('USDC:SOLANA');

    if (needEvm) {
      evmWallet = generateEvmWallet();
      const enc = encryptionService.encrypt(evmWallet.privateKey);
      if (!existingSet.has('USDT:ERC20')) {
        rows.push({
          user_id: userId,
          wallet_id: walletId,
          suite_context: suiteContext,
          asset: 'USDT',
          network: 'ERC20',
          address: evmWallet.address,
          chain_type: 'evm',
          chain_environment: chainEnvironment,
          encrypted_secret: enc,
        });
      }
      if (!existingSet.has('USDT:BEP20')) {
        rows.push({
          user_id: userId,
          wallet_id: walletId,
          suite_context: suiteContext,
          asset: 'USDT',
          network: 'BEP20',
          address: evmWallet.address,
          chain_type: 'evm',
          chain_environment: chainEnvironment,
          encrypted_secret: enc,
        });
      }
      if (!existingSet.has('USDC:BEP20')) {
        rows.push({
          user_id: userId,
          wallet_id: walletId,
          suite_context: suiteContext,
          asset: 'USDC',
          network: 'BEP20',
          address: evmWallet.address,
          chain_type: 'evm',
          chain_environment: chainEnvironment,
          encrypted_secret: enc,
        });
      }
    }

    if (needTron) {
      tronWallet = generateTronWallet();
      rows.push({
        user_id: userId,
        wallet_id: walletId,
        suite_context: suiteContext,
        asset: 'USDT',
        network: 'TRC20',
        address: tronWallet.address,
        chain_type: 'tron',
        chain_environment: chainEnvironment,
        encrypted_secret: encryptionService.encrypt(tronWallet.privateKey),
      });
    }

    if (needSolana) {
      solanaWallet = generateSolanaWallet();
      rows.push({
        user_id: userId,
        wallet_id: walletId,
        suite_context: suiteContext,
        asset: 'USDC',
        network: 'SOLANA',
        address: solanaWallet.address,
        chain_type: 'solana',
        chain_environment: chainEnvironment,
        encrypted_secret: encryptionService.encrypt(
          Buffer.from(solanaWallet.secretKey).toString('base64')
        ),
      });
    }

    if (rows.length === 0) {
      return { success: true, message: 'Deposit addresses already provisioned' };
    }

    const { error } = await adminClient.from('wallet_deposit_addresses').insert(rows);
    if (error) {
      return { success: false, message: 'Failed to save deposit addresses', error: error.message };
    }

    return { success: true, message: 'Deposit addresses provisioned' };
  }

  async getStablecoinDepositAddresses(
    userId: string,
    suiteContext: WalletSuiteContext = 'personal'
  ): Promise<StablecoinDepositAddressMap> {
    const adminClient = supabaseAdmin || supabase;
    const chainEnvironment = getMultichainNetworkMode();
    const { data: rows } = await adminClient
      .from('wallet_deposit_addresses')
      .select('asset, network, address')
      .eq('user_id', userId)
      .eq('suite_context', suiteContext)
      .eq('chain_environment', chainEnvironment);

    const map: StablecoinDepositAddressMap = { USDT: {}, USDC: {} };
    for (const row of rows ?? []) {
      if (row.asset === 'USDT' && ['ERC20', 'TRC20', 'BEP20'].includes(row.network)) {
        map.USDT[row.network as 'ERC20' | 'TRC20' | 'BEP20'] = row.address;
      }
      if (row.asset === 'USDC' && ['BEP20', 'SOLANA'].includes(row.network)) {
        map.USDC[row.network as 'BEP20' | 'SOLANA'] = row.address;
      }
    }
    return map;
  }

  async getDepositAddress(
    userId: string,
    asset: StablecoinAsset,
    network: DepositNetwork,
    suiteContext: WalletSuiteContext = 'personal'
  ): Promise<{ success: boolean; address?: string; message?: string; error?: string }> {
    if (!isValidAssetNetwork(asset, network)) {
      return {
        success: false,
        message: `Invalid network ${network} for ${asset}`,
        error: 'Invalid asset/network',
      };
    }

    const adminClient = supabaseAdmin || supabase;
    const chainEnvironment = getMultichainNetworkMode();
    const { data: row } = await adminClient
      .from('wallet_deposit_addresses')
      .select('address')
      .eq('user_id', userId)
      .eq('suite_context', suiteContext)
      .eq('asset', asset)
      .eq('network', network)
      .eq('chain_environment', chainEnvironment)
      .maybeSingle();

    if (!row?.address) {
      return {
        success: false,
        message: 'Deposit address not found. Create a wallet first.',
        error: 'Address not provisioned',
      };
    }

    return { success: true, address: row.address };
  }
}

export const multichainWalletService = new MultichainWalletService();
