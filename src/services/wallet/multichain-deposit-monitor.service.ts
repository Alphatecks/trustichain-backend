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
  multichainWalletService,
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
    const result = await this.creditDepositDetailed(row, dep, chainEnvironment);
    return result.credited || !!result.alreadyCredited;
  }

  private async creditDepositDetailed(
    row: DepositAddressRow,
    dep: DetectedDeposit,
    chainEnvironment: MultichainNetworkMode
  ): Promise<{
    credited: boolean;
    alreadyCredited?: boolean;
    creditId?: string;
    transactionId?: string;
    amount?: number;
  }> {
    const adminClient = supabaseAdmin || supabase;

    const { data: existing } = await adminClient
      .from('multichain_deposit_credits')
      .select('id, transaction_id, amount')
      .eq('chain_environment', chainEnvironment)
      .eq('network', dep.network)
      .eq('tx_hash', dep.txHash)
      .eq('log_index', dep.logIndex)
      .maybeSingle();

    if (existing) {
      return {
        credited: false,
        alreadyCredited: true,
        creditId: existing.id,
        transactionId: existing.transaction_id ?? undefined,
        amount: existing.amount != null ? parseFloat(String(existing.amount)) : dep.amount,
      };
    }

    const { data: wallet } = await adminClient
      .from('wallets')
      .select('balance_usdt, balance_usdc')
      .eq('id', row.wallet_id)
      .single();

    if (!wallet) return { credited: false };

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
      return { credited: false };
    }

    const { data: creditRow, error: creditError } = await adminClient
      .from('multichain_deposit_credits')
      .insert({
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
      })
      .select('id')
      .single();

    if (creditError) {
      if (creditError.code === '23505') {
        const { data: raced } = await adminClient
          .from('multichain_deposit_credits')
          .select('id, transaction_id, amount')
          .eq('chain_environment', chainEnvironment)
          .eq('network', dep.network)
          .eq('tx_hash', dep.txHash)
          .eq('log_index', dep.logIndex)
          .maybeSingle();
        await adminClient.from('transactions').delete().eq('id', txRow.id);
        return {
          credited: false,
          alreadyCredited: true,
          creditId: raced?.id,
          transactionId: raced?.transaction_id ?? undefined,
          amount: raced?.amount != null ? parseFloat(String(raced.amount)) : dep.amount,
        };
      }
      console.error('[MultichainDeposit] credit insert failed:', creditError);
      await adminClient.from('transactions').delete().eq('id', txRow.id);
      return { credited: false };
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
      return { credited: false };
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

    return {
      credited: true,
      creditId: creditRow?.id,
      transactionId: txRow.id,
      amount: dep.amount,
    };
  }

  /**
   * Frontend notifies a WalletConnect / Reown transfer tx hash for faster credit.
   * Verifies on-chain transfer to the user's custodial deposit address, then credits.
   */
  async notifyDeposit(
    userId: string,
    request: { asset: string; network: string; txHash: string },
    suiteContext: WalletSuiteContext = 'personal'
  ): Promise<{
    success: boolean;
    message: string;
    data?: {
      status: 'pending' | 'credited' | 'failed';
      asset: StablecoinAsset;
      network: DepositNetwork;
      txHash: string;
      amount?: number;
      transactionId?: string;
      creditId?: string;
      errorMessage?: string;
    };
    error?: string;
  }> {
    const asset = request.asset?.toUpperCase();
    const network = request.network?.toUpperCase();
    const txHash = (request.txHash ?? '').trim();

    if (!asset || !network || !txHash) {
      return {
        success: false,
        message: 'asset, network, and txHash are required',
        error: 'Missing required fields',
      };
    }
    if (asset !== 'USDT' && asset !== 'USDC') {
      return { success: false, message: 'asset must be USDT or USDC', error: 'Invalid asset' };
    }
    if (!['ERC20', 'TRC20', 'BEP20', 'SOLANA'].includes(network)) {
      return {
        success: false,
        message: 'network must be ERC20, TRC20, BEP20, or SOLANA',
        error: 'Invalid network',
      };
    }
    if (!multichainWalletService.validateAssetNetwork(asset, network)) {
      return {
        success: false,
        message: 'Invalid pair. USDT: ERC20, TRC20, BEP20. USDC: BEP20, SOLANA.',
        error: 'Invalid asset/network',
      };
    }

    const adminClient = supabaseAdmin || supabase;
    const chainEnvironment = getMultichainNetworkMode();
    const assetTyped = asset as StablecoinAsset;
    const networkTyped = network as DepositNetwork;

    const { data: row } = await adminClient
      .from('wallet_deposit_addresses')
      .select('id, user_id, wallet_id, suite_context, asset, network, address, chain_type, chain_environment')
      .eq('user_id', userId)
      .eq('suite_context', suiteContext)
      .eq('asset', assetTyped)
      .eq('network', networkTyped)
      .eq('chain_environment', chainEnvironment)
      .maybeSingle();

    if (!row) {
      return {
        success: false,
        message: 'Deposit address not found. Create a wallet first.',
        error: 'Address not provisioned',
      };
    }

    const depositRow = row as DepositAddressRow;
    const now = new Date().toISOString();

    const { data: existingNotification } = await adminClient
      .from('multichain_deposit_notifications')
      .select('id, status, amount, error_message, credit_id, transaction_id')
      .eq('user_id', userId)
      .eq('chain_environment', chainEnvironment)
      .eq('network', networkTyped)
      .eq('tx_hash', txHash)
      .maybeSingle();

    // Already credited earlier — return without overwriting.
    if (existingNotification?.status === 'credited') {
      return {
        success: true,
        message: 'Deposit already credited',
        data: {
          status: 'credited',
          asset: assetTyped,
          network: networkTyped,
          txHash,
          amount:
            existingNotification.amount != null
              ? parseFloat(String(existingNotification.amount))
              : undefined,
          transactionId: existingNotification.transaction_id ?? undefined,
          creditId: existingNotification.credit_id ?? undefined,
        },
      };
    }

    let notification = existingNotification;
    if (notification) {
      const { data: updated, error: updateError } = await adminClient
        .from('multichain_deposit_notifications')
        .update({
          status: 'pending',
          error_message: null,
          updated_at: now,
        })
        .eq('id', notification.id)
        .select('id, status, amount, error_message, credit_id, transaction_id')
        .single();
      if (updateError || !updated) {
        return {
          success: false,
          message: 'Failed to update deposit notification',
          error: updateError?.message ?? 'Update failed',
        };
      }
      notification = updated;
    } else {
      const { data: inserted, error: insertError } = await adminClient
        .from('multichain_deposit_notifications')
        .insert({
          user_id: userId,
          wallet_id: depositRow.wallet_id,
          suite_context: suiteContext,
          asset: assetTyped,
          network: networkTyped,
          chain_environment: chainEnvironment,
          tx_hash: txHash,
          status: 'pending',
          updated_at: now,
        })
        .select('id, status, amount, error_message, credit_id, transaction_id')
        .single();
      if (insertError || !inserted) {
        return {
          success: false,
          message: 'Failed to record deposit notification',
          error: insertError?.message ?? 'Insert failed',
        };
      }
      notification = inserted;
    }

    const { data: existingCredit } = await adminClient
      .from('multichain_deposit_credits')
      .select('id, amount, transaction_id')
      .eq('user_id', userId)
      .eq('chain_environment', chainEnvironment)
      .eq('network', networkTyped)
      .eq('tx_hash', txHash)
      .maybeSingle();

    if (existingCredit) {
      await adminClient
        .from('multichain_deposit_notifications')
        .update({
          status: 'credited',
          amount: existingCredit.amount,
          credit_id: existingCredit.id,
          transaction_id: existingCredit.transaction_id,
          error_message: null,
          updated_at: now,
        })
        .eq('id', notification.id);

      return {
        success: true,
        message: 'Deposit already credited',
        data: {
          status: 'credited',
          asset: assetTyped,
          network: networkTyped,
          txHash,
          amount: parseFloat(String(existingCredit.amount)),
          transactionId: existingCredit.transaction_id ?? undefined,
          creditId: existingCredit.id,
        },
      };
    }

    const verification = await this.verifyTxForDeposit(depositRow, txHash, chainEnvironment);

    if (verification.pending) {
      await adminClient
        .from('multichain_deposit_notifications')
        .update({ status: 'pending', error_message: null, updated_at: now })
        .eq('id', notification.id);

      return {
        success: true,
        message: 'Transaction not yet confirmed. Poll GET /api/wallet/deposits/status.',
        data: {
          status: 'pending',
          asset: assetTyped,
          network: networkTyped,
          txHash,
        },
      };
    }

    if (verification.error || !verification.deposit) {
      const errorMessage = verification.error ?? 'No matching deposit transfer found';
      await adminClient
        .from('multichain_deposit_notifications')
        .update({
          status: 'failed',
          error_message: errorMessage,
          updated_at: now,
        })
        .eq('id', notification.id);

      return {
        success: false,
        message: errorMessage,
        error: 'Deposit verification failed',
        data: {
          status: 'failed',
          asset: assetTyped,
          network: networkTyped,
          txHash,
          errorMessage,
        },
      };
    }

    const creditResult = await this.creditDepositDetailed(
      depositRow,
      verification.deposit,
      chainEnvironment
    );

    if (!creditResult.credited && !creditResult.alreadyCredited) {
      const errorMessage = 'Failed to credit deposit';
      await adminClient
        .from('multichain_deposit_notifications')
        .update({
          status: 'failed',
          error_message: errorMessage,
          updated_at: now,
        })
        .eq('id', notification.id);

      return {
        success: false,
        message: errorMessage,
        error: 'Credit failed',
        data: {
          status: 'failed',
          asset: assetTyped,
          network: networkTyped,
          txHash,
          errorMessage,
        },
      };
    }

    await adminClient
      .from('multichain_deposit_notifications')
      .update({
        status: 'credited',
        amount: creditResult.amount ?? verification.deposit.amount,
        credit_id: creditResult.creditId ?? null,
        transaction_id: creditResult.transactionId ?? null,
        error_message: null,
        updated_at: now,
      })
      .eq('id', notification.id);

    return {
      success: true,
      message: creditResult.alreadyCredited ? 'Deposit already credited' : 'Deposit credited',
      data: {
        status: 'credited',
        asset: assetTyped,
        network: networkTyped,
        txHash,
        amount: creditResult.amount ?? verification.deposit.amount,
        transactionId: creditResult.transactionId,
        creditId: creditResult.creditId,
      },
    };
  }

  /**
   * Status for a notified (or already credited) multichain deposit tx hash.
   * Re-attempts verification when still pending.
   */
  async getDepositStatus(
    userId: string,
    txHashRaw: string,
    networkRaw?: string
  ): Promise<{
    success: boolean;
    message: string;
    data?: {
      status: 'pending' | 'credited' | 'failed' | 'not_found';
      asset?: StablecoinAsset;
      network?: DepositNetwork;
      txHash: string;
      amount?: number;
      transactionId?: string;
      creditId?: string;
      errorMessage?: string;
    };
    error?: string;
  }> {
    const txHash = (txHashRaw ?? '').trim();
    if (!txHash) {
      return {
        success: false,
        message: 'Query param txHash is required',
        error: 'Missing txHash',
      };
    }

    const adminClient = supabaseAdmin || supabase;
    const chainEnvironment = getMultichainNetworkMode();
    const networkFilter = networkRaw ? networkRaw.toUpperCase() : undefined;

    let notifyQuery = adminClient
      .from('multichain_deposit_notifications')
      .select(
        'id, asset, network, status, amount, error_message, credit_id, transaction_id, tx_hash, suite_context'
      )
      .eq('user_id', userId)
      .eq('chain_environment', chainEnvironment)
      .eq('tx_hash', txHash)
      .order('created_at', { ascending: false })
      .limit(1);

    if (networkFilter) {
      notifyQuery = notifyQuery.eq('network', networkFilter);
    }

    const { data: notifications } = await notifyQuery;
    const notification = notifications?.[0];

    let creditQuery = adminClient
      .from('multichain_deposit_credits')
      .select('id, asset, network, amount, transaction_id, tx_hash')
      .eq('user_id', userId)
      .eq('chain_environment', chainEnvironment)
      .eq('tx_hash', txHash)
      .limit(1);

    if (networkFilter) {
      creditQuery = creditQuery.eq('network', networkFilter);
    }

    const { data: credits } = await creditQuery;
    const credit = credits?.[0];

    if (credit) {
      if (notification && notification.status !== 'credited') {
        await adminClient
          .from('multichain_deposit_notifications')
          .update({
            status: 'credited',
            amount: credit.amount,
            credit_id: credit.id,
            transaction_id: credit.transaction_id,
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', notification.id);
      }

      return {
        success: true,
        message: 'Deposit credited',
        data: {
          status: 'credited',
          asset: credit.asset as StablecoinAsset,
          network: credit.network as DepositNetwork,
          txHash,
          amount: parseFloat(String(credit.amount)),
          transactionId: credit.transaction_id ?? undefined,
          creditId: credit.id,
        },
      };
    }

    if (!notification) {
      return {
        success: true,
        message: 'No deposit notification found for this transaction',
        data: { status: 'not_found', txHash },
      };
    }

    if (notification.status === 'failed') {
      return {
        success: true,
        message: notification.error_message ?? 'Deposit verification failed',
        data: {
          status: 'failed',
          asset: notification.asset as StablecoinAsset,
          network: notification.network as DepositNetwork,
          txHash,
          errorMessage: notification.error_message ?? undefined,
        },
      };
    }

    // Pending: re-attempt verify + credit (same as notify).
    const suiteContext =
      notification.suite_context === 'business' ? 'business' : 'personal';
    const retry = await this.notifyDeposit(
      userId,
      {
        asset: notification.asset,
        network: notification.network,
        txHash,
      },
      suiteContext
    );

    if (retry.data) {
      return {
        success: true,
        message: retry.message,
        data: {
          status: retry.data.status,
          asset: retry.data.asset,
          network: retry.data.network,
          txHash: retry.data.txHash,
          amount: retry.data.amount,
          transactionId: retry.data.transactionId,
          creditId: retry.data.creditId,
          errorMessage: retry.data.errorMessage,
        },
      };
    }

    return {
      success: true,
      message: 'Deposit pending confirmation',
      data: {
        status: 'pending',
        asset: notification.asset as StablecoinAsset,
        network: notification.network as DepositNetwork,
        txHash,
      },
    };
  }

  private async verifyTxForDeposit(
    row: DepositAddressRow,
    txHash: string,
    chainEnvironment: MultichainNetworkMode
  ): Promise<{ deposit?: DetectedDeposit; pending?: boolean; error?: string }> {
    const tokenConfigs = getTokenMonitorConfigs(chainEnvironment);
    const token = this.tokenConfigFor(tokenConfigs, row.asset, row.network);
    if (!token) {
      return { error: `No token config for ${row.asset}/${row.network}` };
    }

    const rpc = getMultichainRpcConfig(chainEnvironment);

    if (row.chain_type === 'evm') {
      return this.verifyEvmTx(getEvmRpcForNetwork(row.network, rpc), row, token, txHash);
    }
    if (row.chain_type === 'tron') {
      return this.verifyTronTx(row, token, rpc.tron, txHash);
    }
    if (row.chain_type === 'solana') {
      return this.verifySolanaTx(row, token, rpc.solana, txHash);
    }
    return { error: `Unsupported chain type ${row.chain_type}` };
  }

  private async verifyEvmTx(
    rpcUrl: string,
    row: DepositAddressRow,
    token: TokenMonitorConfig,
    txHash: string
  ): Promise<{ deposit?: DetectedDeposit; pending?: boolean; error?: string }> {
    if (!token.evmContract) return { error: 'Missing EVM token contract' };

    const provider = new JsonRpcProvider(rpcUrl);
    let receipt;
    try {
      receipt = await provider.getTransactionReceipt(txHash);
    } catch {
      return { error: 'Failed to fetch transaction receipt' };
    }

    if (!receipt) {
      try {
        const tx = await provider.getTransaction(txHash);
        if (tx) return { pending: true };
      } catch {
        // fall through
      }
      return { pending: true };
    }

    if (receipt.status === 0) {
      return { error: 'Transaction reverted' };
    }

    const iface = new Interface(['event Transfer(address indexed from, address indexed to, uint256 value)']);
    const toAddress = getAddress(row.address);
    const contract = token.evmContract.toLowerCase();

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== contract) continue;
      if ((log.topics[0] ?? '').toLowerCase() !== TRANSFER_TOPIC.toLowerCase()) continue;
      try {
        const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
        if (!parsed) continue;
        const to = getAddress(parsed.args[1] as string);
        if (to !== toAddress) continue;
        const value = parsed.args[2] as bigint;
        const amount = Number(value) / 10 ** token.decimals;
        if (amount <= 0) continue;
        return {
          deposit: {
            asset: row.asset,
            network: row.network,
            txHash: receipt.hash,
            logIndex: log.index,
            amount,
            fromAddress: parsed.args[0] as string,
            toAddress: row.address,
          },
        };
      } catch {
        // skip unparseable log
      }
    }

    return { error: 'No matching token transfer to your deposit address in this transaction' };
  }

  private async verifyTronTx(
    row: DepositAddressRow,
    token: TokenMonitorConfig,
    tronApiBase: string,
    txHash: string
  ): Promise<{ deposit?: DetectedDeposit; pending?: boolean; error?: string }> {
    if (!token.tronContract) return { error: 'Missing TRC-20 token contract' };

    const headers: Record<string, string> = { Accept: 'application/json' };
    const apiKey = process.env.TRONGRID_API_KEY || process.env.TRON_PRO_API_KEY;
    if (apiKey) headers['TRON-PRO-API-KEY'] = apiKey;

    const url = new URL(`${tronApiBase}/v1/accounts/${row.address}/transactions/trc20`);
    url.searchParams.set('only_to', 'true');
    url.searchParams.set('limit', '50');
    url.searchParams.set('contract_address', token.tronContract);

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) {
      return { error: `TronGrid ${res.status}: ${await res.text()}` };
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

    const match = (body.data ?? []).find(
      (tx) => tx.transaction_id === txHash && tx.to === row.address
    );

    if (!match) {
      // Tx may not be indexed yet
      return { pending: true };
    }

    const raw = BigInt(match.value || '0');
    const amount = Number(raw) / 10 ** (match.token_info?.decimals ?? token.decimals);
    if (amount <= 0) {
      return { error: 'Transfer amount is zero' };
    }

    return {
      deposit: {
        asset: row.asset,
        network: row.network,
        txHash,
        logIndex: 0,
        amount,
        fromAddress: match.from,
        toAddress: row.address,
      },
    };
  }

  private async verifySolanaTx(
    row: DepositAddressRow,
    token: TokenMonitorConfig,
    solanaRpc: string,
    txHash: string
  ): Promise<{ deposit?: DetectedDeposit; pending?: boolean; error?: string }> {
    if (!token.solanaMint) return { error: 'Missing Solana mint' };

    const connection = new Connection(solanaRpc, 'confirmed');
    const mint = new PublicKey(token.solanaMint);

    let tx;
    try {
      tx = await connection.getParsedTransaction(txHash, {
        maxSupportedTransactionVersion: 0,
      });
    } catch {
      return { error: 'Failed to fetch Solana transaction' };
    }

    if (!tx) {
      return { pending: true };
    }
    if (tx.meta?.err) {
      return { error: 'Solana transaction failed' };
    }

    const pre = tx.meta?.preTokenBalances ?? [];
    const post = tx.meta?.postTokenBalances ?? [];

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

      return {
        deposit: {
          asset: row.asset,
          network: row.network,
          txHash,
          logIndex: postBal.accountIndex,
          amount: delta,
          toAddress: row.address,
        },
      };
    }

    return { error: 'No matching token transfer to your deposit address in this transaction' };
  }
}

export const multichainDepositMonitorService = new MultichainDepositMonitorService();
