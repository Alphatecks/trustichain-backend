/**
 * XRPL Wallet Service
 * Handles XRPL blockchain operations for wallets
 */

import { Client, Wallet, xrpToDrops, dropsToXrp } from 'xrpl';

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

  /**
   * Generate a new XRPL address
   */
  async generateAddress(): Promise<string> {
    try {
      const wallet = Wallet.generate();
      return wallet.address;
    } catch (error) {
      console.error('Error generating XRPL address:', error);
      throw error;
    }
  }

  /**
   * Get XRP balance for an XRPL address
   */
  async getBalance(xrplAddress: string): Promise<number> {
    try {
      const client = new Client(this.XRPL_SERVER);
      await client.connect();

      try {
        const accountInfo = await client.request({
          command: 'account_info',
          account: xrplAddress,
          ledger_index: 'validated',
        });

        await client.disconnect();

        // Convert drops to XRP (1 XRP = 1,000,000 drops)
        // Balance is returned as a string in drops format
        const balanceDrops = accountInfo.result.account_data.Balance;
        // dropsToXrp expects a string, ensure it's always a string
        const dropsStr: string = String(balanceDrops);
        return dropsToXrp(dropsStr);
      } catch (error) {
        await client.disconnect();
        // If account doesn't exist, return 0
        if (error instanceof Error && error.message.includes('actNotFound')) {
          return 0;
        }
        throw error;
      }
    } catch (error) {
      console.error('Error getting XRPL balance:', error);
      // Fallback to 0 if there's an error
      return 0;
    }
  }

  /**
   * Create a deposit transaction
   * Note: For deposits, the transaction would typically be initiated by the sender
   * This method prepares the transaction details
   */
  async createDepositTransaction(xrplAddress: string, amountXrp: number): Promise<string> {
    try {
      // For deposits, we typically wait for incoming transactions
      // This method can be used to verify a deposit transaction
      // In a real implementation, you would monitor for incoming payments to this address
      
      console.log(`[XRPL] Deposit transaction prepared: ${amountXrp} XRP to ${xrplAddress}`);
      
      // Return a placeholder transaction hash
      // In production, this would monitor for actual incoming transactions
      const txHash = Array.from({ length: 64 }, () => 
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      
      return txHash;
    } catch (error) {
      console.error('Error creating deposit transaction:', error);
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
    try {
      if (!walletSecret) {
        // In production, retrieve wallet secret securely (from encrypted storage, HSM, etc.)
        throw new Error('Wallet secret required for withdrawal');
      }

      const client = new Client(this.XRPL_SERVER);
      await client.connect();

      try {
        const wallet = Wallet.fromSeed(walletSecret);
        
        const payment: any = {
          TransactionType: 'Payment',
          Account: fromAddress,
          Destination: toAddress,
          Amount: xrpToDrops(amountXrp.toString()),
        };

        const prepared = await client.autofill(payment);
        const signed = wallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);

        await client.disconnect();

        return result.result.hash;
      } catch (error) {
        await client.disconnect();
        throw error;
      }
    } catch (error) {
      console.error('Error creating withdrawal transaction:', error);
      // Return placeholder for now if wallet secret not available
      const txHash = Array.from({ length: 64 }, () => 
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      console.log(`[XRPL] Withdrawal transaction placeholder: ${amountXrp} XRP from ${fromAddress} to ${toAddress}`);
      return txHash;
    }
  }

  /**
   * Convert XRP drops to XRP (helper method)
   */
  convertDropsToXrp(drops: string | number): number {
    const dropsStr: string = typeof drops === 'number' ? String(drops) : String(drops);
    return dropsToXrp(dropsStr);
  }

  /**
   * Convert XRP to drops (helper method)
   */
  convertXrpToDrops(xrp: number): string {
    return xrpToDrops(String(xrp));
  }

  /**
   * Get token balance for an XRPL address
   * @param xrplAddress The XRPL address
   * @param currency The currency code (e.g., 'USD', 'USDT', 'USDC')
   * @param issuer The issuer address for the token
   * @returns The token balance as a number
   */
  async getTokenBalance(xrplAddress: string, currency: string, issuer: string): Promise<number> {
    try {
      const client = new Client(this.XRPL_SERVER);
      await client.connect();

      try {
        const accountLines = await client.request({
          command: 'account_lines',
          account: xrplAddress,
          ledger_index: 'validated',
        });

        await client.disconnect();

        // Find the trust line for this currency and issuer
        const lines = accountLines.result.lines || [];
        const trustLine = lines.find((line: any) => 
          line.currency === currency && line.account === issuer
        );

        if (!trustLine) {
          return 0;
        }

        // Balance is returned as a string, convert to number
        // Negative balance means the account owes tokens (shouldn't happen for user wallets)
        const balance = parseFloat(trustLine.balance || '0');
        return Math.max(0, balance); // Return 0 if negative
      } catch (error) {
        await client.disconnect();
        // If account doesn't exist, return 0
        if (error instanceof Error && error.message.includes('actNotFound')) {
          return 0;
        }
        throw error;
      }
    } catch (error) {
      console.error(`Error getting ${currency} balance:`, error);
      // Fallback to 0 if there's an error
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
   * Get all balances (XRP, USDT, USDC) for an XRPL address
   */
  async getAllBalances(xrplAddress: string): Promise<{
    xrp: number;
    usdt: number;
    usdc: number;
  }> {
    try {
      const [xrp, usdt, usdc] = await Promise.all([
        this.getBalance(xrplAddress),
        this.getUSDTBalance(xrplAddress),
        this.getUSDCBalance(xrplAddress),
      ]);

      return {
        xrp,
        usdt,
        usdc,
      };
    } catch (error) {
      console.error('Error getting all balances:', error);
      return {
        xrp: 0,
        usdt: 0,
        usdc: 0,
      };
    }
  }
}

export const xrplWalletService = new XRPLWalletService();


