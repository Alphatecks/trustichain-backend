/**
 * Detect incoming USDT/USDC on ERC20, TRC20, BEP20, and Solana deposit addresses;
 * credit wallets.balance_usdt / balance_usdc and record transactions.
 */

import { Interface, JsonRpcProvider, id, zeroPadValue, getAddress } from 'ethers';
import { Connection, PublicKey } from '@solana/web3.js';
import { supabase, supabaseAdmin } from '../../config/supabase';
import {
  getEvmRpcForNetwork,
  getMultichainRpcConfig,
  getTokenMonitorConfigs,
  type TokenMonitorConfig,
} from '../../config/multichain-tokens';
import {
  getMultichainNetworkMode,
  type DepositNetwork,
  type MultichainNetworkMode,
  type StablecoinAsset,
} from './multichain-wallet.service';
import { notificationService } from '../notification/notification.service';
import type { WalletSuiteContext } from './wallet.service';

const TRANSFER_TOPIC = id('Transfer(address,address,uint256)');
const EVM_BLOCK_LOOKBACK = 4000;
const EVM_MIN_LOGS_BLOCK_RANGE = 500;

export interface DetectedDeposit {
  asset: StablecoinAsset;
  network: DepositNetwork;
  txHash: string;
  logIndex: number;
  amount: number;
  fromAddress?: string;
  toAddress: string;
}

interface DepositAddressRow {
  id: string;
  user_id: string;
  wallet_id: string;
  suite_context: WalletSuiteContext;
  asset: StablecoinAsset;
  network: DepositNetwork;
  address: string;
  chain_type: string;
  chain_environment: MultichainNetworkMode;
}

export class MultichainDepositMonitorService {
  async syncAllDeposits(): Promise<{
    success: boolean;
    message: string;
    data?: { scanned: number; credited: number; errors: string[] };
    error?: string;
  }> {
    const adminClient = supabaseAdmin || supabase;
    const chainEnvironment = getMultichainNetworkMode();

    const { data: rows, error } = await adminClient
      .from('wallet_deposit_addresses')
      .select('id, user_id, wallet_id, suite_context, asset, network, address, chain_type, chain_environment')
      .eq('chain_environment', chainEnvironment);

    if (error) {
      return { success: false, message: 'Failed to load deposit addresses', error: error.message };
    }

    const addresses = (rows ?? []) as DepositAddressRow[];
    const tokenConfigs = getTokenMonitorConfigs(chainEnvironment);
    const rpc = getMultichainRpcConfig(chainEnvironment);
    const errors: string[] = [];
    let credited = 0;

    const evmByRpc = new Map<string, DepositAddressRow[]>();
    for (const row of addresses) {
      if (row.chain_type !== 'evm') continue;
      const rpcUrl = getEvmRpcForNetwork(row.network, rpc);
      const list = evmByRpc.get(rpcUrl) ?? [];
      list.push(row);
      evmByRpc.set(rpcUrl, list);
    }

    for (const [rpcUrl, group] of evmByRpc) {
      try {
        const found = await this.scanEvmDeposits(rpcUrl, group, tokenConfigs);
        for (const dep of found) {
          const row = group.find(
            (r) => r.address.toLowerCase() === dep.toAddress.toLowerCase() && r.asset === dep.asset && r.network === dep.network
          );
          if (!row) continue;
          const ok = await this.creditDeposit(row, dep, chainEnvironment);
          if (ok) credited += 1;
        }
      } catch (e) {
        errors.push(`EVM ${rpcUrl}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    for (const row of addresses.filter((r) => r.chain_type === 'tron')) {
      try {
        const found = await this.scanTronDeposits(row, tokenConfigs, rpc.tron);
        for (const dep of found) {
          const ok = await this.creditDeposit(row, dep, chainEnvironment);
          if (ok) credited += 1;
        }
      } catch (e) {
        errors.push(`Tron ${row.address}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    for (const row of addresses.filter((r) => r.chain_type === 'solana')) {
      try {
        const found = await this.scanSolanaDeposits(row, tokenConfigs, rpc.solana);
        for (const dep of found) {
          const ok = await this.creditDeposit(row, dep, chainEnvironment);
          if (ok) credited += 1;
        }
      } catch (e) {
        errors.push(`Solana ${row.address}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return {
      success: true,
      message: `Multichain deposit sync finished (${credited} credited)`,
      data: { scanned: addresses.length, credited, errors },
    };
  }

  async syncDepositsForUser(
    userId: string,
    suiteContext: WalletSuiteContext = 'personal'
  ): Promise<void> {
    const adminClient = supabaseAdmin || supabase;
    const chainEnvironment = getMultichainNetworkMode();

    const { data: rows } = await adminClient
      .from('wallet_deposit_addresses')
      .select('id, user_id, wallet_id, suite_context, asset, network, address, chain_type, chain_environment')
      .eq('user_id', userId)
      .eq('suite_context', suiteContext)
      .eq('chain_environment', chainEnvironment);

    if (!rows?.length) return;

    const tokenConfigs = getTokenMonitorConfigs(chainEnvironment);
    const rpc = getMultichainRpcConfig(chainEnvironment);
    const addresses = rows as DepositAddressRow[];

    for (const row of addresses.filter((r) => r.chain_type === 'evm')) {
      const rpcUrl = getEvmRpcForNetwork(row.network, rpc);
      const found = await this.scanEvmDeposits(rpcUrl, [row], tokenConfigs);
      for (const dep of found) {
        await this.creditDeposit(row, dep, chainEnvironment);
      }
    }
    for (const row of addresses.filter((r) => r.chain_type === 'tron')) {
      const found = await this.scanTronDeposits(row, tokenConfigs, rpc.tron);
      for (const dep of found) await this.creditDeposit(row, dep, chainEnvironment);
    }
    for (const row of addresses.filter((r) => r.chain_type === 'solana')) {
      const found = await this.scanSolanaDeposits(row, tokenConfigs, rpc.solana);
      for (const dep of found) await this.creditDeposit(row, dep, chainEnvironment);
    }
  }

  private tokenConfigFor(
    configs: TokenMonitorConfig[],
    asset: StablecoinAsset,
    network: DepositNetwork
  ): TokenMonitorConfig | undefined {
    return configs.find((c) => c.asset === asset && c.network === network);
  }

  private async scanEvmDeposits(
    rpcUrl: string,
    rows: DepositAddressRow[],
    tokenConfigs: TokenMonitorConfig[]
  ): Promise<DetectedDeposit[]> {
    const provider = new JsonRpcProvider(rpcUrl);
    const currentBlock = await provider.getBlockNumber();
    const adminClient = supabaseAdmin || supabase;
    const results: DetectedDeposit[] = [];
    const iface = new Interface(['event Transfer(address indexed from, address indexed to, uint256 value)']);

    for (const row of rows) {
      const token = this.tokenConfigFor(tokenConfigs, row.asset, row.network);
      if (!token?.evmContract) continue;

      const { data: cursorRow } = await adminClient
        .from('multichain_deposit_scan_cursors')
        .select('cursor_value')
        .eq('deposit_address_id', row.id)
        .eq('cursor_key', 'evm_block')
        .maybeSingle();

      let fromBlock = cursorRow?.cursor_value
        ? Math.max(0, parseInt(cursorRow.cursor_value, 10))
        : Math.max(0, currentBlock - EVM_BLOCK_LOOKBACK);

      if (fromBlock >= currentBlock) {
        fromBlock = Math.max(0, currentBlock - 100);
      }

      const toAddress = getAddress(row.address);
      const toTopic = zeroPadValue(toAddress, 32);

      let scanTo = currentBlock;
      while (fromBlock <= scanTo) {
        const chunkEnd = Math.min(fromBlock + EVM_MIN_LOGS_BLOCK_RANGE - 1, scanTo);
        const logs = await provider.getLogs({
          address: token.evmContract,
          topics: [TRANSFER_TOPIC, null, toTopic],
          fromBlock,
          toBlock: chunkEnd,
        });

        for (const log of logs) {
          try {
            const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
            if (!parsed) continue;
            const value = parsed.args[2] as bigint;
            const amount = Number(value) / 10 ** token.decimals;
            if (amount <= 0) continue;
            results.push({
              asset: row.asset,
              network: row.network,
              txHash: log.transactionHash,
              logIndex: log.index,
              amount,
              fromAddress: parsed.args[0] as string,
              toAddress: row.address,
            });
          } catch {
            // skip unparseable log
          }
        }
        fromBlock = chunkEnd + 1;
      }

      await adminClient.from('multichain_deposit_scan_cursors').upsert(
        {
          deposit_address_id: row.id,
          cursor_key: 'evm_block',
          cursor_value: String(currentBlock),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'deposit_address_id,cursor_key' }
      );
    }

    return results;
  }

  private async scanTronDeposits(
    row: DepositAddressRow,
    tokenConfigs: TokenMonitorConfig[],
    tronApiBase: string
  ): Promise<DetectedDeposit[]> {
    const token = this.tokenConfigFor(tokenConfigs, row.asset, row.network);
    if (!token?.tronContract) return [];

    const headers: Record<string, string> = { Accept: 'application/json' };
    const apiKey = process.env.TRONGRID_API_KEY || process.env.TRON_PRO_API_KEY;
    if (apiKey) headers['TRON-PRO-API-KEY'] = apiKey;

    const url = new URL(`${tronApiBase}/v1/accounts/${row.address}/transactions/trc20`);
    url.searchParams.set('only_to', 'true');
    url.searchParams.set('limit', '50');
    url.searchParams.set('contract_address', token.tronContract);

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
      throw new Error(`TronGrid ${res.status}: ${await res.text()}`);
    }

    const body = (await res.json()) as {
      data?: Array<{
        transaction_id: string;
        from: string;
        to: string;
        value: string;
        token_info?: { decimals?: number };
      }>;
    };

    const decimals = token.decimals;
    const results: DetectedDeposit[] = [];
    for (const tx of body.data ?? []) {
      if (tx.to !== row.address) continue;
      const raw = BigInt(tx.value || '0');
      const amount = Number(raw) / 10 ** (tx.token_info?.decimals ?? decimals);
      if (amount <= 0) continue;
      results.push({
        asset: row.asset,
        network: row.network,
        txHash: tx.transaction_id,
        logIndex: 0,
        amount,
        fromAddress: tx.from,
        toAddress: row.address,
      });
    }
    return results;
  }

  private async scanSolanaDeposits(
    row: DepositAddressRow,
    tokenConfigs: TokenMonitorConfig[],
    solanaRpc: string
  ): Promise<DetectedDeposit[]> {
    const token = this.tokenConfigFor(tokenConfigs, row.asset, row.network);
    if (!token?.solanaMint) return [];

    const connection = new Connection(solanaRpc, 'confirmed');
    const pubkey = new PublicKey(row.address);
    const mint = new PublicKey(token.solanaMint);
    const signatures = await connection.getSignaturesForAddress(pubkey, { limit: 30 });
    const results: DetectedDeposit[] = [];

    for (const sigInfo of signatures) {
      if (sigInfo.err) continue;
      const tx = await connection.getParsedTransaction(sigInfo.signature, {
        maxSupportedTransactionVersion: 0,
      });
      if (!tx?.meta) continue;

      const pre = tx.meta.preTokenBalances ?? [];
      const post = tx.meta.postTokenBalances ?? [];

      for (const postBal of post) {
        if (postBal.mint !== mint.toBase58()) continue;
        if (postBal.owner !== row.address) continue;

        const preBal = pre.find(
          (p) => p.accountIndex === postBal.accountIndex && p.mint === postBal.mint
        );
        const preAmount = preBal?.uiTokenAmount?.uiAmount ?? 0;
        const postAmount = postBal.uiTokenAmount?.uiAmount ?? 0;
        const delta = postAmount - preAmount;
        if (delta <= 0) continue;

        results.push({
          asset: row.asset,
          network: row.network,
          txHash: sigInfo.signature,
          logIndex: postBal.accountIndex,
          amount: delta,
          toAddress: row.address,
        });
      }
    }
    return results;
  }

  private async creditDeposit(
    row: DepositAddressRow,
    dep: DetectedDeposit,
    chainEnvironment: MultichainNetworkMode
  ): Promise<boolean> {
    const adminClient = supabaseAdmin || supabase;

    const { data: existing } = await adminClient
      .from('multichain_deposit_credits')
      .select('id')
      .eq('chain_environment', chainEnvironment)
      .eq('network', dep.network)
      .eq('tx_hash', dep.txHash)
      .eq('log_index', dep.logIndex)
      .maybeSingle();

    if (existing) return false;

    const { data: wallet } = await adminClient
      .from('wallets')
      .select('balance_usdt, balance_usdc')
      .eq('id', row.wallet_id)
      .single();

    if (!wallet) return false;

    const amountUsd = dep.amount;
    const balanceField = dep.asset === 'USDT' ? 'balance_usdt' : 'balance_usdc';
    const current = parseFloat(String(wallet[balanceField] ?? 0));
    const newBalance = parseFloat((current + dep.amount).toFixed(6));

    const { data: txRow, error: txError } = await adminClient
      .from('transactions')
      .insert({
        user_id: row.user_id,
        type: 'deposit',
        amount_xrp: 0,
        amount_usd: amountUsd,
        xrpl_tx_hash: dep.txHash,
        status: 'completed',
        description: `Multichain deposit ${dep.amount} ${dep.asset} (${dep.network}, ${chainEnvironment})`,
      })
      .select('id')
      .single();

    if (txError || !txRow) {
      console.error('[MultichainDeposit] transaction insert failed:', txError);
      return false;
    }

    const { error: creditError } = await adminClient.from('multichain_deposit_credits').insert({
      user_id: row.user_id,
      wallet_id: row.wallet_id,
      suite_context: row.suite_context,
      asset: dep.asset,
      network: dep.network,
      chain_environment: chainEnvironment,
      tx_hash: dep.txHash,
      log_index: dep.logIndex,
      amount: dep.amount,
      from_address: dep.fromAddress ?? null,
      to_address: dep.toAddress,
      transaction_id: txRow.id,
    });

    if (creditError) {
      if (creditError.code === '23505') return false;
      console.error('[MultichainDeposit] credit insert failed:', creditError);
      await adminClient.from('transactions').delete().eq('id', txRow.id);
      return false;
    }

    const { error: walletError } = await adminClient
      .from('wallets')
      .update({
        [balanceField]: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.wallet_id);

    if (walletError) {
      console.error('[MultichainDeposit] wallet update failed:', walletError);
      return false;
    }

    try {
      await notificationService.createNotification({
        userId: row.user_id,
        type: 'wallet_deposit',
        title: 'Deposit received',
        message: `You received ${dep.amount.toFixed(2)} ${dep.asset} on ${dep.network}.`,
        metadata: {
          asset: dep.asset,
          network: dep.network,
          txHash: dep.txHash,
          amount: dep.amount,
          chainEnvironment,
        },
      });
    } catch (notifyErr) {
      console.warn('[MultichainDeposit] notification failed:', notifyErr);
    }

    return true;
  }
}

export const multichainDepositMonitorService = new MultichainDepositMonitorService();
