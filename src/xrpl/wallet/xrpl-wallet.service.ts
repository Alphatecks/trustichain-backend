import * as keypairs from 'ripple-keypairs';
/**
 * XRPL Wallet Service
 * Handles XRPL blockchain operations for wallets
 */

import { Client, xrpToDrops, dropsToXrp } from 'xrpl';
import { Wallet } from 'xrpl/dist/npm/Wallet';
import { looksLikeTransactionId } from '../../utils/transactionValidation';

export class XRPLWalletService {
  private readonly XRPL_NETWORK = process.env.XRPL_NETWORK || 'testnet'; // 'testnet' or 'mainnet'
  private readonly XRPL_SERVER = this.XRPL_NETWORK === 'mainnet'
    ? 'wss://xrplcluster.com'
    : 'wss://s.altnet.rippletest.net:51233';
  
  // USDT and USDC issuer addresses on XRPL
  // Note: On XRPL, both USDT and USDC use "USD" as the currency code, distinguished by issuer address
  // IMPORTANT: Update these issuer addresses based on actual token issuers on your network
  // For mainnet, verify issuer addresses from official sources (Tether, Circle, etc.)
  // For testnet, use testnet issuer addresses or create test tokens
  private readonly USDT_ISSUER = this.XRPL_NETWORK === 'mainnet'
    ? 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B' // Tether (USDT) on mainnet - UPDATE with actual issuer if different
    : 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY'; // Testnet issuer - UPDATE with actual testnet issuer
  
  private readonly USDC_ISSUER = this.XRPL_NETWORK === 'mainnet'
    ? 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY' // Circle (USDC) on mainnet - UPDATE with actual Circle issuer address
    : 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY'; // Testnet issuer - UPDATE with actual testnet issuer

  private readonly RLUSD_ISSUER = this.XRPL_NETWORK === 'mainnet'
    ? (process.env.RLUSD_ISSUER_MAINNET || '') // Must be configured in production
    : (process.env.RLUSD_ISSUER_TESTNET || 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY'); // Testnet fallback

  private readonly XRPL_CONNECT_TIMEOUT_MS = 4_000;
  private readonly XRPL_REQUEST_TIMEOUT_MS = 5_000;
  private sharedClient: Client | null = null;
  private sharedClientConnecting: Promise<Client> | null = null;

  private isAccountNotFound(error: unknown): boolean {
    const errorObj = error as { data?: { error?: string; error_message?: string; error_code?: number }; message?: string };
    const message = error instanceof Error ? error.message : String(errorObj?.message ?? error ?? '');
    return (
      message.includes('actNotFound') ||
      message.includes('Account not found') ||
      message.includes('accountNotFound') ||
      errorObj?.data?.error === 'actNotFound' ||
      errorObj?.data?.error_message === 'accountNotFound' ||
      errorObj?.data?.error_message === 'Account not found.' ||
      errorObj?.data?.error_code === 19
    );
  }

  private async getSharedClient(): Promise<Client> {
    if (this.sharedClient?.isConnected()) {
      return this.sharedClient;
    }
    if (this.sharedClientConnecting) {
      return this.sharedClientConnecting;
    }

    this.sharedClientConnecting = (async () => {
      if (this.sharedClient) {
        try {
          await this.sharedClient.disconnect();
        } catch {
          // Ignore teardown errors; we will open a fresh socket.
        }
        this.sharedClient = null;
      }

      const client = new Client(this.XRPL_SERVER, {
        connectionTimeout: this.XRPL_CONNECT_TIMEOUT_MS,
      });
      await client.connect();
      this.sharedClient = client;
      client.on('disconnected', () => {
        if (this.sharedClient === client) {
          this.sharedClient = null;
        }
      });
      return client;
    })();

    try {
      return await this.sharedClientConnecting;
    } finally {
      this.sharedClientConnecting = null;
    }
  }

  private async requestWithTimeout<T>(
    client: Client,
    request: Record<string, unknown>,
    timeoutMs = this.XRPL_REQUEST_TIMEOUT_MS
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        client.request(request) as Promise<T>,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error('XRPL request timeout')), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Create an unfunded XRPL keypair. Use this on read paths so GET /balance
   * never waits on the testnet faucet.
   */
  generateUnfundedWallet(): { address: string; secret: string } {
    const seed = keypairs.generateSeed();
    const keypair = keypairs.deriveKeypair(seed);
    const address = keypairs.deriveAddress(keypair.publicKey);
    return { address, secret: seed };
  }

  /**
   * Generate a new XRPL address
   */
  async generateAddress(): Promise<string> {
    try {
      // Use testnet faucet for wallet generation if on testnet
      if (this.XRPL_NETWORK === 'testnet') {
        const client = new Client(this.XRPL_SERVER);
        await client.connect();
        const faucetWallet = await (client as any).fundWallet();
        await client.disconnect();
        return faucetWallet.wallet.address;
      } else {
        // For mainnet, generate a wallet using ripple-keypairs
        const seed = keypairs.generateSeed();
        const keypair = keypairs.deriveKeypair(seed);
        const address = keypairs.deriveAddress(keypair.publicKey);
        return address;
      }
    } catch (error) {
      console.error('Error generating XRPL address:', error);
      throw error;
    }
  }

  /**
   * Generate a new XRPL wallet (address + secret)
   * Returns both address and secret for storage
   */
  async generateWallet(): Promise<{
    address: string;
    secret: string;
  }> {
    try {
      if (this.XRPL_NETWORK === 'testnet') {
        const client = new Client(this.XRPL_SERVER);
        await client.connect();
        const faucetWallet = await (client as any).fundWallet();
        await client.disconnect();
        return {
          address: faucetWallet.wallet.address,
          secret: faucetWallet.wallet.seed,
        };
      } else {
        // For mainnet, generate a wallet using ripple-keypairs
        const seed = keypairs.generateSeed();
        const keypair = keypairs.deriveKeypair(seed);
        const address = keypairs.deriveAddress(keypair.publicKey);
        return {
          address,
          secret: seed,
        };
      }
    } catch (error) {
      console.error('Error generating XRPL wallet:', error);
      throw error;
    }
  }

  /**
   * Get XRP balance for an XRPL address
   */
  async getBalance(xrplAddress: string): Promise<number> {
    try {
      const client = await this.getSharedClient();
      const accountInfo = await this.requestWithTimeout<any>(client, {
        command: 'account_info',
        account: xrplAddress,
        ledger_index: 'validated',
      });

      const balanceDrops = accountInfo.result.account_data.Balance;
      const balance = dropsToXrp(String(balanceDrops));
      return typeof balance === 'string' ? parseFloat(balance) : balance;
    } catch (error) {
      if (!this.isAccountNotFound(error)) {
        console.error('Error getting XRPL balance:', error);
      }
      return 0;
    }
  }

  /**
   * Prepare a payment transaction for user signing via Xaman/XUMM
   * Returns unsigned transaction that frontend can send to XUMM for signing
   */
  async preparePaymentTransaction(
    destinationAddress: string,
    amount: number,
    currency: 'XRP' | 'USDT' | 'USDC' | 'RLUSD'
  ): Promise<{
    transaction: any;
    transactionBlob: string;
    instructions: string;
  }> {
    try {
      let paymentTx: any;

      if (currency === 'XRP') {
        // XRP Payment
        paymentTx = {
          TransactionType: 'Payment',
          Destination: destinationAddress,
          Amount: xrpToDrops(amount.toString()),
        };
      } else {
        // Token Payment (USDT, USDC, or RLUSD)
        const issuer = currency === 'USDT'
          ? this.USDT_ISSUER
          : currency === 'USDC'
            ? this.USDC_ISSUER
            : this.RLUSD_ISSUER;
        if (currency === 'RLUSD' && !issuer) {
          throw new Error('RLUSD issuer is not configured. Set RLUSD_ISSUER_MAINNET (and RLUSD_ISSUER_TESTNET for testnet).');
        }
        paymentTx = {
          TransactionType: 'Payment',
          Destination: destinationAddress,
          Amount: {
            currency: 'USD', // XRPL uses 'USD' for USDT/USDC/RLUSD
            value: amount.toString(),
            issuer: issuer,
          },
        };
      }

      // Serialize to transaction blob (unsigned)
      // Note: User's wallet (Xaman/Xumm) will autofill Account, Sequence, Fee, etc.
      const txBlob = JSON.stringify(paymentTx);

      return {
        transaction: paymentTx,
        transactionBlob: txBlob,
        instructions: `Please sign this transaction in your XRPL wallet to send ${amount} ${currency} to ${destinationAddress}`,
      };
    } catch (error) {
      console.error('Error preparing payment transaction:', error);
      throw error;
    }
  }

  /**
   * Submit a signed transaction blob
   * Called after user signs the transaction via XUMM, MetaMask, or other wallets
   */
  async submitSignedTransaction(signedTxBlob: string | object): Promise<{
    hash: string;
    status: string;
    result: any;
  }> {
    try {
      const client = new Client(this.XRPL_SERVER);
      await client.connect();

      try {
        let txToSubmit: any;

        // Early validation: Check for common mistakes (UUID/transaction ID)
        if (typeof signedTxBlob === 'string' && looksLikeTransactionId(signedTxBlob)) {
          throw new Error('Invalid transaction format: You appear to be sending a transaction ID (UUID) instead of the signed transaction blob. Please send the actual signed transaction returned by MetaMask/XRPL Snap.');
        }

        // Handle different input formats
        if (typeof signedTxBlob === 'object') {
          // Already an object (from MetaMask/XRPL Snap)
          // Check if it's wrapped in a response object (e.g., { tx_blob: "...", signedTransaction: {...} })
          if ('tx_blob' in signedTxBlob && typeof (signedTxBlob as any).tx_blob === 'string') {
            // MetaMask/XRPL Snap returns { tx_blob: "hex..." }
            txToSubmit = (signedTxBlob as any).tx_blob;
          } else if ('signedTransaction' in signedTxBlob) {
            // Some wallets wrap it as { signedTransaction: {...} }
            txToSubmit = (signedTxBlob as any).signedTransaction;
          } else if ('transaction' in signedTxBlob) {
            // Some wallets wrap it as { transaction: {...} }
            txToSubmit = (signedTxBlob as any).transaction;
          } else {
            // Direct transaction object
            txToSubmit = signedTxBlob;
          }
        } else if (typeof signedTxBlob === 'string') {
          // Try to parse as JSON first
          try {
            txToSubmit = JSON.parse(signedTxBlob);
          } catch {
            // If parsing fails, check if it's a hex string
            // Hex strings for XRPL are typically long (1000+ chars)
            if (signedTxBlob.length > 100 && /^[0-9A-Fa-f]+$/.test(signedTxBlob)) {
              // It's a hex string - XRPL client can handle this directly
              txToSubmit = signedTxBlob;
            } else {
              // Check if it looks like a transaction ID (UUID)
              if (looksLikeTransactionId(signedTxBlob)) {
                throw new Error('Invalid transaction format: You appear to be sending a transaction ID (UUID) instead of the signed transaction blob. Please send the actual signed transaction returned by MetaMask/XRPL Snap (e.g., { tx_blob: "..." } or the signed transaction object).');
              }
              // Invalid format
              throw new Error(`Invalid transaction format. Expected a signed transaction from MetaMask/XRPL Snap (hex string 1000+ chars or transaction object). Got: ${signedTxBlob.substring(0, 100)}...`);
            }
          }
        } else {
          throw new Error(`Invalid transaction type: ${typeof signedTxBlob}`);
        }

        // Validate transaction structure
        if (typeof txToSubmit === 'string') {
          if (txToSubmit.length < 100) {
            throw new Error(`Transaction hex string appears too short (${txToSubmit.length} characters). Expected 1000+ characters for a valid XRPL transaction blob.`);
          }
          // Additional check: if it's a UUID, reject it
          if (looksLikeTransactionId(txToSubmit)) {
            throw new Error('Invalid transaction format: Detected transaction ID (UUID) in hex string. Please send the actual signed transaction blob from MetaMask/XRPL Snap.');
          }
        }

        if (typeof txToSubmit === 'object' && !txToSubmit.TransactionType) {
          throw new Error('Transaction object missing TransactionType field. Expected a valid XRPL transaction object with TransactionType, Account, and other required fields.');
        }

        // Submit the signed transaction (manual submit and wait for validation)
        let result: any;
        try {
          // Submit transaction
          let submitResult;
          if (typeof txToSubmit === 'string') {
            submitResult = await (client as any).request({
              command: 'submit',
              tx_blob: txToSubmit,
            });
          } else {
            submitResult = await (client as any).request({
              command: 'submit',
              tx_json: txToSubmit,
            });
          }
          // Wait for validation
          let validated = false;
          let txResult: any = null;
          const txHash = submitResult.result.tx_json?.hash || submitResult.result.hash;
          for (let i = 0; i < 20; i++) { // up to ~20 seconds
            await new Promise(res => setTimeout(res, 1000));
            try {
              const txResponse = await (client as any).request({
                command: 'tx',
                transaction: txHash,
                binary: false,
              });
              if (txResponse.result.validated) {
                validated = true;
                txResult = txResponse;
                break;
              }
            } catch {}
          }
          if (!validated) {
            throw new Error('Transaction was not validated within timeout');
          }
          // Emulate submitAndWait result structure
          result = { result: { ...txResult.result, hash: txHash } };
        } catch (submitError) {
          await client.disconnect();
          throw submitError;
        }

        await client.disconnect();

        return {
          hash: result.result.hash,
          status: result.result.meta?.TransactionResult || 'unknown',
          result: result.result,
        };
      } catch (error) {
        await client.disconnect();
        console.error('Error in submitSignedTransaction:', {
          error: error instanceof Error ? error.message : String(error),
          inputType: typeof signedTxBlob,
          inputPreview: typeof signedTxBlob === 'string' 
            ? signedTxBlob.substring(0, 200) 
            : JSON.stringify(signedTxBlob).substring(0, 200),
        });
        throw error;
      }
    } catch (error) {
      console.error('Error submitting signed transaction:', error);
      throw error;
    }
  }

  /**
   * Create a withdrawal transaction
   * Note: Requires wallet secret key - in production, handle securely
   */
  async createWithdrawalTransaction(
    fromAddress: string,
    toAddress: string,
    amountXrp: number,
    walletSecret?: string
  ): Promise<string> {
    // #region agent log
    
    // #endregion
    if (!walletSecret) {
      throw new Error('Wallet secret required for withdrawal');
    }

    // Extra validation: Ensure walletSecret is a valid XRPL seed (starts with 's' and length 29-35)
    if (typeof walletSecret !== 'string' || !/^s[abcdefABCDEF0123456789]{0,}/.test(walletSecret) || walletSecret.length < 20) {
      throw new Error('Invalid XRPL seed format for wallet secret.');
    }

    const client = new Client(this.XRPL_SERVER);
    try {
      await client.connect();
      // Use xrpl.Wallet to sign with a seed
      const wallet = Wallet.fromSeed(walletSecret);
      if (wallet.classicAddress !== fromAddress) {
        throw new Error('Provided secret does not match the fromAddress');
      }
      if (fromAddress === toAddress) {
        throw new Error('Cannot withdraw to the same address. Please provide a different destination address.');
      }
      const accountInfo = await (client as any).request({
        command: 'account_info',
        account: fromAddress,
        ledger_index: 'validated',
      });
      const payment: any = {
        TransactionType: 'Payment',
        Account: fromAddress,
        Destination: toAddress,
        Amount: xrpToDrops(amountXrp.toString()),
        Sequence: accountInfo.result.account_data.Sequence,
        Fee: '12',
      };
      // Sign the payment transaction
      const signed = wallet.sign(payment);
      // Submit the signed transaction using the legacy submit flow
      const submitResult = await (client as any).request({
        command: 'submit',
        tx_blob: signed.tx_blob,
      });
      
      // Check if transaction submission was successful
      const engineResult = submitResult.result.engine_result;
      const engineResultMessage = submitResult.result.engine_result_message || submitResult.result.engine_result_code;
      
      // tesSUCCESS means the transaction was successfully submitted and applied
      // Other codes indicate various failure conditions
      if (engineResult !== 'tesSUCCESS') {
        const errorMessage = engineResultMessage || `Transaction failed with code: ${engineResult}`;
        throw new Error(`XRPL transaction submission failed: ${errorMessage} (${engineResult})`);
      }
      
      const txHash = submitResult.result.tx_json?.hash || submitResult.result.hash;
      if (!txHash) {
        throw new Error('Transaction submitted successfully but no transaction hash was returned');
      }
      
      // Wait for transaction validation (CRITICAL: ensures balance sync gets correct balance)
      // XRPL transactions take 3-5 seconds to validate, so we must wait before returning
      let validated = false;
      for (let i = 0; i < 20; i++) { // Wait up to ~20 seconds
        await new Promise(res => setTimeout(res, 1000)); // Wait 1 second between checks
        try {
          const txResponse = await (client as any).request({
            command: 'tx',
            transaction: txHash,
            binary: false,
          });
          if (txResponse.result.validated) {
            validated = true;
            break;
          }
        } catch (txError) {
          // Transaction not found yet, continue waiting
          continue;
        }
      }
      
      if (!validated) {
        throw new Error('Transaction was submitted but not validated within 20 seconds. The transaction may still be processing.');
      }
      
      return txHash;
    } catch (error) {
      // #region agent log
      console.log('[DEBUG] createWithdrawalTransaction: Error caught', {error:error instanceof Error ? error.message : String(error),fromAddress,toAddress,amountXrp});
      // #endregion
      console.error('Error creating withdrawal transaction:', {
        error: error instanceof Error ? error.message : String(error),
        fromAddress,
        toAddress,
        amountXrp,
      });
      throw error;
    } finally {
      try {
        await client.disconnect();
      } catch (disconnectError) {
        // Ignore disconnect errors
      }
    }
  }

  /**
   * Convert XRP drops to XRP (helper method)
   */
  convertDropsToXrp(drops: string | number): number {
    const dropsStr: string = typeof drops === 'number' ? String(drops) : String(drops);
    const xrp = dropsToXrp(dropsStr);
    return typeof xrp === 'string' ? parseFloat(xrp) : xrp;
  }

  /**
   * Convert XRP to drops (helper method)
   */
  convertXrpToDrops(xrp: number): string {
    return xrpToDrops(String(xrp));
  }

  private tokenBalanceFromLines(lines: any[], currency: string, issuer: string): number {
    const trustLine = (lines || []).find((line: any) =>
      line.currency === currency && line.account === issuer
    );
    if (!trustLine) return 0;
    return Math.max(0, parseFloat(trustLine.balance || '0'));
  }

  /**
   * Get token balance for an XRPL address
   */
  async getTokenBalance(xrplAddress: string, currency: string, issuer: string): Promise<number> {
    if (!issuer) return 0;
    try {
      const client = await this.getSharedClient();
      const accountLines = await this.requestWithTimeout<any>(client, {
        command: 'account_lines',
        account: xrplAddress,
        ledger_index: 'validated',
      });
      return this.tokenBalanceFromLines(accountLines.result.lines || [], currency, issuer);
    } catch (error) {
      if (!this.isAccountNotFound(error)) {
        console.error(`Error getting ${currency} balance:`, error);
      }
      return 0;
    }
  }

  /**
   * Get USDT balance for an XRPL address
   */
  async getUSDTBalance(xrplAddress: string): Promise<number> {
    return this.getTokenBalance(xrplAddress, 'USD', this.USDT_ISSUER);
  }

  /**
   * Get USDC balance for an XRPL address
   */
  async getUSDCBalance(xrplAddress: string): Promise<number> {
    return this.getTokenBalance(xrplAddress, 'USD', this.USDC_ISSUER);
  }

  /**
   * Get RLUSD balance for an XRPL address
   */
  async getRLUSDBalance(xrplAddress: string): Promise<number> {
    if (!this.RLUSD_ISSUER) {
      return 0;
    }
    return this.getTokenBalance(xrplAddress, 'USD', this.RLUSD_ISSUER);
  }

  /**
   * Get all balances (XRP, USDT, USDC, RLUSD) for an XRPL address using one socket.
   */
  async getAllBalances(xrplAddress: string): Promise<{
    xrp: number;
    usdt: number;
    usdc: number;
    rlusd: number;
  }> {
    try {
      const client = await this.getSharedClient();
      const [accountInfo, accountLines] = await Promise.all([
        this.requestWithTimeout<any>(client, {
          command: 'account_info',
          account: xrplAddress,
          ledger_index: 'validated',
        }),
        this.requestWithTimeout<any>(client, {
          command: 'account_lines',
          account: xrplAddress,
          ledger_index: 'validated',
        }),
      ]);

      const balanceDrops = accountInfo.result.account_data.Balance;
      const xrpRaw = dropsToXrp(String(balanceDrops));
      const xrp = typeof xrpRaw === 'string' ? parseFloat(xrpRaw) : xrpRaw;
      const lines = accountLines.result.lines || [];

      return {
        xrp,
        usdt: this.tokenBalanceFromLines(lines, 'USD', this.USDT_ISSUER),
        usdc: this.tokenBalanceFromLines(lines, 'USD', this.USDC_ISSUER),
        rlusd: this.RLUSD_ISSUER ? this.tokenBalanceFromLines(lines, 'USD', this.RLUSD_ISSUER) : 0,
      };
    } catch (error) {
      if (this.isAccountNotFound(error)) {
        return { xrp: 0, usdt: 0, usdc: 0, rlusd: 0 };
      }
      console.error('[XRPL] Error getting all balances:', {
        error: error instanceof Error ? error.message : String(error),
        xrplAddress,
        network: this.XRPL_NETWORK,
      });
      throw error;
    }
  }
}

export const xrplWalletService = new XRPLWalletService();
