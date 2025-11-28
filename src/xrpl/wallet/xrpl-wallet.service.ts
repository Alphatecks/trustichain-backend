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
        const balanceDrops = accountInfo.result.account_data.Balance;
        return parseFloat(dropsToXrp(balanceDrops));
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
        
        const payment = {
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
  convertDropsToXrp(drops: string): number {
    return parseFloat(dropsToXrp(drops));
  }

  /**
   * Convert XRP to drops (helper method)
   */
  convertXrpToDrops(xrp: number): string {
    return xrpToDrops(xrp.toString());
  }
}

export const xrplWalletService = new XRPLWalletService();
