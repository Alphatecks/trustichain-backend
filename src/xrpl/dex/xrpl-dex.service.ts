/**
 * XRPL DEX Service
 * Handles decentralized exchange operations on XRPL
 */

import { Client, xrpToDrops, dropsToXrp } from 'xrpl';
import * as keypairs from 'ripple-keypairs';

export interface DEXSwapQuote {
  fromAmount: number;
  toAmount: number;
  rate: number;
  minAmount: number; // Minimum amount user will receive (slippage protection)
  estimatedFee: number; // Estimated XRPL transaction fee
}

export interface DEXSwapExecutionResult {
  success: boolean;
  txHash?: string;
  actualFromAmount?: number;
  actualToAmount?: number;
  error?: string;
}

export class XRPLDEXService {
  private readonly XRPL_NETWORK = process.env.XRPL_NETWORK || 'testnet';
  private readonly XRPL_SERVER = this.XRPL_NETWORK === 'mainnet'
    ? 'wss://xrplcluster.com'
    : 'wss://s.altnet.rippletest.net:51233';
  
  // Issuer addresses (same as in xrpl-wallet.service.ts)
  private readonly USDT_ISSUER = this.XRPL_NETWORK === 'mainnet'
    ? 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B' // Tether USDT mainnet
    : 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY'; // Testnet
  
  private readonly USDC_ISSUER = this.XRPL_NETWORK === 'mainnet'
    ? 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY' // Circle USDC mainnet
    : 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY'; // Testnet

  /**
   * Get issuer address for a currency
   */
  private getIssuer(currency: 'USDT' | 'USDC'): string {
    return currency === 'USDT' ? this.USDT_ISSUER : this.USDC_ISSUER;
  }

  /**
   * Check if user has trust line for a token
   */
  async hasTrustLine(
    xrplAddress: string,
    currency: 'USDT' | 'USDC'
  ): Promise<boolean> {
    const client = new Client(this.XRPL_SERVER);
    try {
      await client.connect();
      
      const issuer = this.getIssuer(currency);
      const accountLines = await (client as any).request({
        command: 'account_lines',
        account: xrplAddress,
        ledger_index: 'validated',
        peer: issuer,
      });

      await client.disconnect();

      const lines = accountLines.result.lines || [];
      return lines.length > 0 && (parseFloat(lines[0].balance) !== 0 || parseFloat(lines[0].limit) > 0);
    } catch (error) {
      await client.disconnect();
      console.error(`Error checking trust line for ${currency}:`, error);
      return false;
    }
  }

  /**
   * Get current price from DEX orderbook
   */
  async getDEXPrice(
    fromCurrency: 'XRP' | 'USDT' | 'USDC',
    toCurrency: 'XRP' | 'USDT' | 'USDC',
    amount: number
  ): Promise<{
    success: boolean;
    data?: DEXSwapQuote;
    error?: string;
  }> {
    const client = new Client(this.XRPL_SERVER);
    
    try {
      await client.connect();

      // Handle token-to-token swaps (route through XRP)
      if (fromCurrency !== 'XRP' && toCurrency !== 'XRP') {
        const fromIssuer = this.getIssuer(fromCurrency as 'USDT' | 'USDC');
        const toIssuer = this.getIssuer(toCurrency as 'USDT' | 'USDC');
        
        // Step 1: fromCurrency -> XRP
        const step1 = await (client as any).request({
          command: 'book_offers',
          taker_gets: { currency: 'XRP' },
          taker_pays: {
            currency: 'USD',
            issuer: fromIssuer,
          },
          limit: 10,
        });

        if (!step1.result.offers || step1.result.offers.length === 0) {
          await client.disconnect();
          return {
            success: false,
            error: `No liquidity available for ${fromCurrency}/XRP`,
          };
        }

        // Calculate XRP amount from available offers
        // Step 1: fromCurrency -> XRP, so TakerPays is token (object), TakerGets is XRP (drops string)
        let remainingAmount = amount;
        let totalXrp = 0;
        for (const offer of step1.result.offers) {
          const takerPays = offer.TakerPays;
          const takerGets = offer.TakerGets;
          const offerAmount = typeof takerPays === 'string' ? parseFloat(takerPays) : parseFloat((takerPays as any).value);
          // TakerGets should be XRP (string in drops) when converting from token to XRP
          let offerXrp = 0;
          if (typeof takerGets === 'string') {
            const dropsStr: string = String(takerGets);
            offerXrp = parseFloat((dropsToXrp as any)(dropsStr));
          }
          const rate = offerXrp / offerAmount;
          
          if (remainingAmount <= offerAmount) {
            totalXrp += remainingAmount * rate;
            remainingAmount = 0;
            break;
          } else {
            totalXrp += offerXrp;
            remainingAmount -= offerAmount;
          }
        }

        if (remainingAmount > 0) {
          await client.disconnect();
          return {
            success: false,
            error: `Insufficient liquidity for ${fromCurrency}/XRP. Available: ${amount - remainingAmount}`,
          };
        }

        // Step 2: XRP -> toCurrency
        const step2 = await (client as any).request({
          command: 'book_offers',
          taker_gets: {
            currency: 'USD',
            issuer: toIssuer,
          },
          taker_pays: { currency: 'XRP' },
          limit: 10,
        });

        if (!step2.result.offers || step2.result.offers.length === 0) {
          await client.disconnect();
          return {
            success: false,
            error: `No liquidity available for XRP/${toCurrency}`,
          };
        }

        // Calculate token amount from available offers
        // Step 2: XRP -> toCurrency, so TakerPays is XRP (drops string), TakerGets is token (object)
        let remainingXrp = totalXrp;
        let totalTokens = 0;
        for (const offer of step2.result.offers) {
          const takerPays = offer.TakerPays;
          const takerGets = offer.TakerGets;
          // TakerPays should be XRP (string in drops) when converting from XRP to token
          let offerXrp = 0;
          if (typeof takerPays === 'string') {
            const dropsStr: string = String(takerPays);
            offerXrp = parseFloat((dropsToXrp as any)(dropsStr));
          }
          const offerTokens = typeof takerGets === 'string' ? parseFloat(takerGets) : parseFloat((takerGets as any).value);
          const rate = offerTokens / offerXrp;
          
          if (remainingXrp <= offerXrp) {
            totalTokens += remainingXrp * rate;
            remainingXrp = 0;
            break;
          } else {
            totalTokens += offerTokens;
            remainingXrp -= offerXrp;
          }
        }

        if (remainingXrp > 0) {
          await client.disconnect();
          return {
            success: false,
            error: `Insufficient liquidity for XRP/${toCurrency}. Available: ${totalXrp - remainingXrp} XRP`,
          };
        }

        await client.disconnect();

        return {
          success: true,
          data: {
            fromAmount: amount,
            toAmount: totalTokens,
            rate: totalTokens / amount,
            minAmount: totalTokens * 0.95, // 5% slippage tolerance
            estimatedFee: 0.000012, // XRPL transaction fee
          },
        };
      }

      // Build orderbook query for direct swaps (XRP <-> Token)
      let takerGets: any;
      let takerPays: any;

      if (fromCurrency === 'XRP' && toCurrency !== 'XRP') {
        // Buying token with XRP
        const issuer = this.getIssuer(toCurrency as 'USDT' | 'USDC');
        takerGets = {
          currency: 'USD',
          issuer: issuer,
        };
        takerPays = {
          currency: 'XRP',
        };
      } else if (fromCurrency !== 'XRP' && toCurrency === 'XRP') {
        // Selling token for XRP
        const issuer = this.getIssuer(fromCurrency as 'USDT' | 'USDC');
        takerGets = {
          currency: 'XRP',
        };
        takerPays = {
          currency: 'USD',
          issuer: issuer,
        };
      } else {
        await client.disconnect();
        return {
          success: false,
          error: 'XRP to XRP swap not supported',
        };
      }

      // Query orderbook
      const orderbook = await (client as any).request({
        command: 'book_offers',
        taker_gets: takerGets,
        taker_pays: takerPays,
        limit: 20, // Get more offers for better price calculation
      });

      await client.disconnect();

      if (!orderbook.result.offers || orderbook.result.offers.length === 0) {
        return {
          success: false,
          error: `No liquidity available for ${fromCurrency}/${toCurrency}`,
        };
      }

      // Calculate price from available offers (walk the orderbook)
      let remainingAmount = amount;
      let totalReceived = 0;

      for (const offer of orderbook.result.offers) {
        const takerPays = offer.TakerPays;
        const takerGets = offer.TakerGets;
        
        if (fromCurrency === 'XRP') {
          // Buying token: paying XRP, receiving token
          // TakerPays is XRP (string in drops), TakerGets is token (object)
          let offerXrp = 0;
          if (typeof takerPays === 'string') {
            const dropsStr: string = String(takerPays);
            offerXrp = parseFloat((dropsToXrp as any)(dropsStr));
          }
          const offerTokens = typeof takerGets === 'string' ? parseFloat(takerGets) : parseFloat((takerGets as any).value);
          const rate = offerTokens / offerXrp;

          if (remainingAmount <= offerXrp) {
            totalReceived += remainingAmount * rate;
            remainingAmount = 0;
            break;
          } else {
            totalReceived += offerTokens;
            remainingAmount -= offerXrp;
          }
        } else {
          // Selling token: paying token, receiving XRP
          // TakerPays is token (object), TakerGets is XRP (string in drops)
          const offerTokens = typeof takerPays === 'string' ? parseFloat(takerPays) : parseFloat((takerPays as any).value);
          let offerXrp = 0;
          if (typeof takerGets === 'string') {
            const dropsStr: string = String(takerGets);
            offerXrp = parseFloat((dropsToXrp as any)(dropsStr));
          }
          const rate = offerXrp / offerTokens;

          if (remainingAmount <= offerTokens) {
            totalReceived += remainingAmount * rate;
            remainingAmount = 0;
            break;
          } else {
            totalReceived += offerXrp;
            remainingAmount -= offerTokens;
          }
        }
      }

      if (remainingAmount > 0) {
        return {
          success: false,
          error: `Insufficient liquidity. Available: ${amount - remainingAmount} ${fromCurrency}`,
        };
      }

      return {
        success: true,
        data: {
          fromAmount: amount,
          toAmount: totalReceived,
          rate: totalReceived / amount,
          minAmount: totalReceived * 0.95, // 5% slippage tolerance
          estimatedFee: 0.000012, // XRPL transaction fee
        },
      };
    } catch (error) {
      await client.disconnect();
      console.error('Error getting DEX price:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get DEX price',
      };
    }
  }

  /**
   * Prepare swap transaction using Payment with pathfinding
   * This creates a Payment transaction that routes through the DEX
   */
  async prepareSwapTransaction(
    userAddress: string,
    fromAmount: number,
    fromCurrency: 'XRP' | 'USDT' | 'USDC',
    toCurrency: 'XRP' | 'USDT' | 'USDC',
    minAmount: number // Minimum amount to receive (slippage protection)
  ): Promise<{
    success: boolean;
    transaction?: any;
    transactionBlob?: string;
    error?: string;
  }> {
    try {
      const client = new Client(this.XRPL_SERVER);
      await client.connect();

      // Build payment transaction
      // Key: When Destination = Account, XRPL treats it as currency conversion
      let payment: any;

      // Set what user wants to receive
      if (toCurrency === 'XRP') {
        payment = {
          TransactionType: 'Payment',
          Account: userAddress,
          Destination: userAddress, // Same address = currency conversion via DEX
          Amount: xrpToDrops(minAmount.toString()),
        };
      } else {
        const issuer = this.getIssuer(toCurrency as 'USDT' | 'USDC');
        payment = {
          TransactionType: 'Payment',
          Account: userAddress,
          Destination: userAddress, // Same address = currency conversion via DEX
          Amount: {
            currency: 'USD',
            value: minAmount.toFixed(6),
            issuer: issuer,
          },
        };
      }

      // Set what user is willing to pay (maximum)
      if (fromCurrency === 'XRP') {
        payment.SendMax = xrpToDrops(fromAmount.toString());
      } else {
        const issuer = this.getIssuer(fromCurrency as 'USDT' | 'USDC');
        payment.SendMax = {
          currency: 'USD',
          value: fromAmount.toFixed(6),
          issuer: issuer,
        };
      }

      // For currency conversion (Account = Destination), we may need explicit paths
      // Construct paths based on currency pair
      // Path structure: [{account: issuer, currency, issuer}, ...]
      
      // If converting between tokens (not XRP), route through XRP
      if (fromCurrency !== 'XRP' && toCurrency !== 'XRP') {
        // Token to token: route through XRP
        const fromIssuer = this.getIssuer(fromCurrency as 'USDT' | 'USDC');
        const toIssuer = this.getIssuer(toCurrency as 'USDT' | 'USDC');
        
        payment.Paths = [
          [
            { account: fromIssuer, currency: 'USD', issuer: fromIssuer },
            { currency: 'XRP' },
            { account: toIssuer, currency: 'USD', issuer: toIssuer },
          ],
        ];
      } else if (fromCurrency === 'XRP' && toCurrency !== 'XRP') {
        // XRP to token: direct path
        const toIssuer = this.getIssuer(toCurrency as 'USDT' | 'USDC');
        payment.Paths = [
          [
            { currency: 'XRP' },
            { account: toIssuer, currency: 'USD', issuer: toIssuer },
          ],
        ];
      } else if (fromCurrency !== 'XRP' && toCurrency === 'XRP') {
        // Token to XRP: direct path
        const fromIssuer = this.getIssuer(fromCurrency as 'USDT' | 'USDC');
        payment.Paths = [
          [
            { account: fromIssuer, currency: 'USD', issuer: fromIssuer },
            { currency: 'XRP' },
          ],
        ];
      }
      // If both are XRP, no paths needed (but this shouldn't happen in a swap)

      // Autofill transaction (this will add missing fields like Fee, Sequence, etc.)
      // Manually fill required fields (Sequence, Fee)
      const accountInfo = await (client as any).request({
        command: 'account_info',
        account: userAddress,
        ledger_index: 'validated',
      });
      (payment as any).Sequence = accountInfo.result.account_data.Sequence;
      (payment as any).Fee = '12'; // Set a default fee (in drops), adjust as needed
      await client.disconnect();

      // Serialize to blob
      const transactionBlob = JSON.stringify(payment);

      return {
        success: true,
        transaction: payment,
        transactionBlob,
      };
    } catch (error) {
      console.error('Error preparing swap transaction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to prepare swap transaction',
      };
    }
  }

  /**
   * Execute swap transaction (for custodial wallets with stored secrets)
   */
  async executeSwap(
    userAddress: string,
    walletSecret: string,
    fromAmount: number,
    fromCurrency: 'XRP' | 'USDT' | 'USDC',
    toCurrency: 'XRP' | 'USDT' | 'USDC',
    minAmount: number
  ): Promise<DEXSwapExecutionResult> {
    try {
      const prepareResult = await this.prepareSwapTransaction(
        userAddress,
        fromAmount,
        fromCurrency,
        toCurrency,
        minAmount
      );

      if (!prepareResult.success || !prepareResult.transaction) {
        return {
          success: false,
          error: prepareResult.error || 'Failed to prepare transaction',
        };
      }

      const client = new Client(this.XRPL_SERVER);
      await client.connect();

      // Sign transaction
      // Use ripple-keypairs for signing
      const keypair = keypairs.deriveKeypair(walletSecret);
      const fromDerivedAddress = keypairs.deriveAddress(keypair.publicKey);
      if (fromDerivedAddress !== userAddress) {
        throw new Error('Provided secret does not match the userAddress');
      }
      // Sign transaction
      const txJSON = JSON.stringify(prepareResult.transaction);
      const signed = keypairs.sign(txJSON, walletSecret);
      // Submit transaction
      const result = await (client as any).request({
        command: 'submit',
        tx_blob: signed,
      });
      await client.disconnect();

      // Check transaction result
      const swapMeta = result.result.meta;
      let txResult: string | undefined;
      if (swapMeta && typeof swapMeta === 'object' && 'TransactionResult' in swapMeta) {
        txResult = (swapMeta as any).TransactionResult;
      }
      
      if (txResult !== 'tesSUCCESS') {
        return {
          success: false,
          error: `Transaction failed: ${txResult || 'Unknown error'}`,
        };
      }

      // Get actual amounts from transaction result
      let actualFromAmount = fromAmount;
      let actualToAmount = minAmount;

      if (swapMeta && typeof swapMeta === 'object' && 'DeliveredAmount' in swapMeta) {
        const delivered = (swapMeta as any).DeliveredAmount;
        if (typeof delivered === 'string') {
          const deliveredStr: string = String(delivered);
          actualToAmount = parseFloat((dropsToXrp as any)(deliveredStr));
        } else if (delivered && typeof delivered === 'object' && 'value' in delivered) {
          actualToAmount = parseFloat(String(delivered.value));
        }
      }

      return {
        success: true,
        txHash: result.result.hash,
        actualFromAmount,
        actualToAmount,
      };
    } catch (error) {
      console.error('Error executing swap:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute swap',
      };
    }
  }

  /**
   * Ensure trust line exists for a token
   * Returns true if trust line exists or was created, false otherwise
   */
  async ensureTrustLine(
    userAddress: string,
    walletSecret: string,
    currency: 'USDT' | 'USDC',
    limit: string = '1000000' // Default trust line limit
  ): Promise<{
    success: boolean;
    created: boolean;
    error?: string;
  }> {
    try {
      // Check if trust line already exists
      const hasTrust = await this.hasTrustLine(userAddress, currency);
      if (hasTrust) {
        return {
          success: true,
          created: false,
        };
      }

      // Create trust line
      const client = new Client(this.XRPL_SERVER);
      await client.connect();

      const issuer = this.getIssuer(currency);
      // Use ripple-keypairs for signing
      const keypair = keypairs.deriveKeypair(walletSecret);
      const fromDerivedAddress = keypairs.deriveAddress(keypair.publicKey);
      if (fromDerivedAddress !== userAddress) {
        throw new Error('Provided secret does not match the userAddress');
      }
      const trustSet: any = {
        TransactionType: 'TrustSet',
        Account: userAddress,
        LimitAmount: {
          currency: 'USD',
          issuer: issuer,
          value: limit,
        },
      };
      // Manually fill required fields (Sequence, Fee)
      const accountInfo = await (client as any).request({
        command: 'account_info',
        account: userAddress,
        ledger_index: 'validated',
      });
      trustSet.Sequence = accountInfo.result.account_data.Sequence;
      trustSet.Fee = '12'; // Set a default fee (in drops), adjust as needed
      // Sign transaction
      const txJSON = JSON.stringify(trustSet);
      const signed = keypairs.sign(txJSON, walletSecret);
      // Submit transaction
      const trustResult = await (client as any).request({
        command: 'submit',
        tx_blob: signed,
      });
      await client.disconnect();

      const trustMeta = trustResult.result.meta;
      let txResult: string | undefined;
      if (trustMeta && typeof trustMeta === 'object' && 'TransactionResult' in trustMeta) {
        txResult = (trustMeta as any).TransactionResult;
      }
      if (txResult !== 'tesSUCCESS') {
        return {
          success: false,
          created: false,
          error: `Failed to create trust line: ${txResult}`,
        };
      }

      return {
        success: true,
        created: true,
      };
    } catch (error) {
      console.error(`Error ensuring trust line for ${currency}:`, error);
      return {
        success: false,
        created: false,
        error: error instanceof Error ? error.message : 'Failed to create trust line',
      };
    }
  }
}

// Export singleton instance
export const xrplDexService = new XRPLDEXService();

