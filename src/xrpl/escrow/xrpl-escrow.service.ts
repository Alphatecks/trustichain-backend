/**
 * XRPL Escrow Service
 * Handles XRPL escrow operations (EscrowCreate, EscrowFinish, EscrowCancel)
 */

import { Client, Wallet, xrpToDrops, dropsToXrp } from 'xrpl';

export class XRPLEscrowService {
  private readonly XRPL_NETWORK = process.env.XRPL_NETWORK || 'testnet';
  private readonly XRPL_SERVER = this.XRPL_NETWORK === 'mainnet'
    ? 'wss://xrplcluster.com'
    : 'wss://s.altnet.rippletest.net:51233';

  /**
   * Create an escrow on XRPL
   * Note: Requires wallet secret key - in production, handle securely
   */
  async createEscrow(params: {
    fromAddress: string;
    toAddress: string;
    amountXrp: number;
    finishAfter?: number; // Unix timestamp
    cancelAfter?: number; // Unix timestamp
    condition?: string; // Crypto-condition
    walletSecret?: string; // Wallet secret for signing
  }): Promise<string> {
    try {
      if (!params.walletSecret) {
        // In production, retrieve wallet secret securely
        console.log(`[XRPL] Escrow creation placeholder: ${params.amountXrp} XRP from ${params.fromAddress} to ${params.toAddress}`);
        const txHash = Array.from({ length: 64 }, () => 
          Math.floor(Math.random() * 16).toString(16)
        ).join('');
        return txHash;
      }

      const client = new Client(this.XRPL_SERVER);
      await client.connect();

      try {
        const wallet = Wallet.fromSeed(params.walletSecret);
        
        const escrowCreate: any = {
          TransactionType: 'EscrowCreate',
          Account: params.fromAddress,
          Destination: params.toAddress,
          Amount: xrpToDrops(params.amountXrp.toString()),
        };

        if (params.finishAfter) {
          escrowCreate.FinishAfter = params.finishAfter;
        }
        if (params.cancelAfter) {
          escrowCreate.CancelAfter = params.cancelAfter;
        }
        if (params.condition) {
          escrowCreate.Condition = params.condition;
        }

        const prepared = await client.autofill(escrowCreate);
        const signed = wallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);

        await client.disconnect();

        return result.result.hash;
      } catch (error) {
        await client.disconnect();
        throw error;
      }
    } catch (error) {
      console.error('Error creating XRPL escrow:', error);
      throw error;
    }
  }

  /**
   * Finish (release) an escrow
   * Note: This requires wallet secret for signing. In production, handle securely.
   * For user-signed transactions, use prepareEscrowFinishTransaction instead.
   */
  async finishEscrow(params: {
    ownerAddress: string;
    escrowSequence: number;
    condition?: string;
    fulfillment?: string;
    walletSecret?: string;
  }): Promise<string> {
    try {
      if (!params.walletSecret) {
        throw new Error(
          'Wallet secret required to finish escrow. ' +
          'For user-signed transactions, use prepareEscrowFinishTransaction instead.'
        );
      }

      const client = new Client(this.XRPL_SERVER);
      await client.connect();

      try {
        const wallet = Wallet.fromSeed(params.walletSecret);

        // Verify wallet address matches owner
        if (wallet.address !== params.ownerAddress) {
          throw new Error(
            `Wallet address ${wallet.address} does not match owner address ${params.ownerAddress}`
          );
        }

        const escrowFinish: any = {
          TransactionType: 'EscrowFinish',
          Account: params.ownerAddress,
          Owner: params.ownerAddress,
          OfferSequence: params.escrowSequence,
        };

        // Add condition and fulfillment if provided
        if (params.condition) {
          escrowFinish.Condition = params.condition;
        }
        if (params.fulfillment) {
          escrowFinish.Fulfillment = params.fulfillment;
        }

        console.log('[XRPL] Preparing EscrowFinish transaction:', {
          ownerAddress: params.ownerAddress,
          escrowSequence: params.escrowSequence,
          hasCondition: !!params.condition,
          hasFulfillment: !!params.fulfillment,
        });

        const prepared = await client.autofill(escrowFinish);
        const signed = wallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);

        await client.disconnect();

        const txHash = result.result.hash;
        const txResult = result.result.meta?.TransactionResult;

        console.log('[XRPL] EscrowFinish transaction submitted:', {
          txHash,
          txResult,
          escrowSequence: params.escrowSequence,
        });

        if (txResult !== 'tesSUCCESS') {
          throw new Error(
            `EscrowFinish transaction failed with result: ${txResult}. ` +
            `Transaction hash: ${txHash}`
          );
        }

        return txHash;
      } catch (error) {
        await client.disconnect();
        throw error;
      }
    } catch (error) {
      console.error('[XRPL] Error finishing escrow:', error);
      throw error;
    }
  }

  /**
   * Prepare an unsigned EscrowFinish transaction for user signing
   * Returns transaction object that can be sent to XUMM/MetaMask for signing
   */
  async prepareEscrowFinishTransaction(params: {
    ownerAddress: string;
    escrowSequence: number;
    condition?: string;
    fulfillment?: string;
  }): Promise<{
    transaction: any;
    transactionBlob: string;
    instructions: string;
  }> {
    try {
      const escrowFinish: any = {
        TransactionType: 'EscrowFinish',
        Account: params.ownerAddress,
        Owner: params.ownerAddress,
        OfferSequence: params.escrowSequence,
      };

      if (params.condition) {
        escrowFinish.Condition = params.condition;
      }
      if (params.fulfillment) {
        escrowFinish.Fulfillment = params.fulfillment;
      }

      // Serialize to transaction blob (unsigned)
      // Note: User's wallet (Xaman/Xumm) will autofill Account, Sequence, Fee, etc.
      const txBlob = JSON.stringify(escrowFinish);

      return {
        transaction: escrowFinish,
        transactionBlob: txBlob,
        instructions: `Please sign this EscrowFinish transaction in your XRPL wallet to release escrow sequence ${params.escrowSequence}`,
      };
    } catch (error) {
      console.error('Error preparing EscrowFinish transaction:', error);
      throw error;
    }
  }

  /**
   * Cancel an escrow
   */
  async cancelEscrow(params: {
    ownerAddress: string;
    escrowSequence: number;
  }): Promise<string> {
    try {
      // In production, use xrpl.js EscrowCancel transaction
      // const escrowCancel = {
      //   TransactionType: 'EscrowCancel',
      //   Account: params.ownerAddress,
      //   Owner: params.ownerAddress,
      //   OfferSequence: params.escrowSequence,
      // };

      // Placeholder
      const txHash = Array.from({ length: 64 }, () => 
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      
      console.log(`[XRPL] Cancelling escrow: sequence ${params.escrowSequence}`);
      return txHash;
    } catch (error) {
      console.error('Error cancelling XRPL escrow:', error);
      throw error;
    }
  }

  /**
   * Get escrow details from XRPL by transaction hash
   * Returns escrow sequence number and details needed for EscrowFinish
   */
  async getEscrowDetailsByTxHash(
    txHash: string,
    ownerAddress: string
  ): Promise<{
    sequence: number;
    amount: number;
    destination: string;
    finishAfter?: number;
    cancelAfter?: number;
    condition?: string;
  } | null> {
    try {
      const client = new Client(this.XRPL_SERVER);
      await client.connect();

      try {
        // First, get the transaction details to find the sequence number
        const txResponse = await client.request({
          command: 'tx',
          transaction: txHash,
        });

        if (!txResponse || !txResponse.result) {
          console.error('[XRPL] Transaction not found:', txHash);
          return null;
        }

        const txResult = txResponse.result;
        const escrowSequence = txResult.Sequence;

        if (!escrowSequence) {
          console.error('[XRPL] No sequence found in transaction:', txHash);
          return null;
        }

        // Verify this is an EscrowCreate transaction
        if (txResult.TransactionType !== 'EscrowCreate') {
          console.error('[XRPL] Transaction is not EscrowCreate:', txResult.TransactionType);
          return null;
        }

        // Get escrow details from account_objects to verify it still exists
        const accountObjectsResponse = await client.request({
          command: 'account_objects',
          account: ownerAddress,
          type: 'escrow',
        });

        // Find the escrow object matching this sequence
        const escrowObjects = accountObjectsResponse.result.account_objects || [];
        const escrowObject = escrowObjects.find(
          (obj: any) => obj.PreviousTxnID === txHash || obj.Sequence === escrowSequence
        );

        if (!escrowObject) {
          console.warn('[XRPL] Escrow object not found, but transaction exists. Escrow may have been finished or cancelled.');
          // Return details from transaction even if escrow object not found
          // (escrow might have been finished/cancelled but we can still get sequence)
          return {
            sequence: escrowSequence,
            amount: parseFloat(dropsToXrp(txResult.Amount || '0')),
            destination: txResult.Destination || '',
            finishAfter: txResult.FinishAfter ? (txResult.FinishAfter as number) : undefined,
            cancelAfter: txResult.CancelAfter ? (txResult.CancelAfter as number) : undefined,
            condition: txResult.Condition || undefined,
          };
        }

        // Extract amount from escrow object (it's in drops)
        const amountDrops = escrowObject.Amount || '0';
        const amount = parseFloat(dropsToXrp(amountDrops));

        return {
          sequence: escrowSequence,
          amount,
          destination: escrowObject.Destination || '',
          finishAfter: escrowObject.FinishAfter ? (escrowObject.FinishAfter as number) : undefined,
          cancelAfter: escrowObject.CancelAfter ? (escrowObject.CancelAfter as number) : undefined,
          condition: escrowObject.Condition || undefined,
        };
      } catch (error) {
        console.error('[XRPL] Error querying escrow details:', error);
        throw error;
      } finally {
        await client.disconnect();
      }
    } catch (error) {
      console.error('Error getting escrow details:', error);
      throw error;
    }
  }

  /**
   * Get escrow details from XRPL by sequence number
   * Legacy method - prefer getEscrowDetailsByTxHash
   */
  async getEscrowDetails(escrowSequence: number, ownerAddress: string): Promise<{
    amount: number;
    destination: string;
    finishAfter?: number;
    cancelAfter?: number;
    condition?: string;
  } | null> {
    try {
      const client = new Client(this.XRPL_SERVER);
      await client.connect();

      try {
        const response = await client.request({
          command: 'account_objects',
          account: ownerAddress,
          type: 'escrow',
        });

        const escrowObjects = response.result.account_objects || [];
        const escrowObject = escrowObjects.find(
          (obj: any) => obj.Sequence === escrowSequence
        );

        if (!escrowObject) {
          return null;
        }

        const amountDrops = escrowObject.Amount || '0';
        const amount = parseFloat(dropsToXrp(amountDrops));

        return {
          amount,
          destination: escrowObject.Destination || '',
          finishAfter: escrowObject.FinishAfter ? (escrowObject.FinishAfter as number) : undefined,
          cancelAfter: escrowObject.CancelAfter ? (escrowObject.CancelAfter as number) : undefined,
          condition: escrowObject.Condition || undefined,
        };
      } catch (error) {
        console.error('[XRPL] Error querying escrow details:', error);
        throw error;
      } finally {
        await client.disconnect();
      }
    } catch (error) {
      console.error('Error getting escrow details:', error);
      return null;
    }
  }
}

export const xrplEscrowService = new XRPLEscrowService();






