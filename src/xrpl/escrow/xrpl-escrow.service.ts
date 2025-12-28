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
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-escrow.service.ts:27',message:'createEscrow: Entry',data:{fromAddress:params.fromAddress,toAddress:params.toAddress,amountXrp:params.amountXrp,hasWalletSecret:!!params.walletSecret,network:this.XRPL_NETWORK},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      if (!params.walletSecret) {
        // In all environments, a real wallet secret is required.
        // User-facing escrows should use the XUMM-based user-signed EscrowCreate flow instead.
        throw new Error(
          'Wallet secret required for XRPL EscrowCreate. ' +
          'For user escrows, use prepareEscrowCreateTransaction + XUMM instead of createEscrow().'
        );
      }

      const client = new Client(this.XRPL_SERVER);
      await client.connect();

      try {
        // #region agent log
        const logDataC = {location:'xrpl-escrow.service.ts:43',message:'createEscrow: About to call Wallet.fromSeed',data:{secretLength:params.walletSecret?.length,secretFirst5:params.walletSecret?.substring(0,5),secretLast5:params.walletSecret?.substring(params.walletSecret.length-5),secretTrimmedLength:params.walletSecret?.trim().length,hasWhitespace:/\s/.test(params.walletSecret),secretCharCodes:params.walletSecret?.substring(0,10).split('').map(c=>c.charCodeAt(0))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'};
        console.log('[DEBUG]', JSON.stringify(logDataC));
        console.error('[DEBUG]', JSON.stringify(logDataC)); // Also log to stderr
        try {
          const fs = require('fs');
          const path = require('path');
          const logPath = path.join(process.cwd(), 'debug.log');
          fs.appendFileSync(logPath, JSON.stringify(logDataC) + '\n');
        } catch (e) {}
        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logDataC)}).catch(()=>{});
        // #endregion
        
        // Trim secret before using it
        const trimmedSecret = params.walletSecret.trim();
        let wallet;
        try {
          wallet = Wallet.fromSeed(trimmedSecret);
          // #region agent log
          const logSuccess = {location:'xrpl-escrow.service.ts:48',message:'createEscrow: Wallet.fromSeed succeeded',data:{walletAddress:wallet.address},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'};
          console.log('[DEBUG]', JSON.stringify(logSuccess));
          console.error('[DEBUG]', JSON.stringify(logSuccess)); // Also log to stderr
          try {
            const fs = require('fs');
            const path = require('path');
            const logPath = path.join(process.cwd(), 'debug.log');
            fs.appendFileSync(logPath, JSON.stringify(logSuccess) + '\n');
          } catch (e) {}
          fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logSuccess)}).catch(()=>{});
          // #endregion
        } catch (seedError) {
          // #region agent log
          const logError = {location:'xrpl-escrow.service.ts:52',message:'createEscrow: Wallet.fromSeed failed',data:{errorMessage:seedError instanceof Error ? seedError.message : String(seedError),errorName:seedError instanceof Error ? seedError.name : 'Unknown',secretLength:params.walletSecret?.length,trimmedLength:trimmedSecret.length,secretFirst10:params.walletSecret?.substring(0,10),secretLast10:params.walletSecret?.substring(params.walletSecret.length-10),trimmedFirst10:trimmedSecret.substring(0,10),trimmedLast10:trimmedSecret.substring(trimmedSecret.length-10),secretCharCodes:params.walletSecret?.substring(0,15).split('').map(c=>c.charCodeAt(0))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'};
          console.error('[DEBUG ERROR]', JSON.stringify(logError));
          try {
            const fs = require('fs');
            const path = require('path');
            const logPath = path.join(process.cwd(), 'debug.log');
            fs.appendFileSync(logPath, JSON.stringify(logError) + '\n');
          } catch (e) {}
          fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(logError)}).catch(()=>{});
          // #endregion
          throw seedError;
        }
        
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
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-escrow.service.ts:63',message:'createEscrow: Transaction prepared, about to sign',data:{fromAddress:params.fromAddress,toAddress:params.toAddress,amountXrp:params.amountXrp},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        const signed = wallet.sign(prepared);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-escrow.service.ts:66',message:'createEscrow: Transaction signed, about to submit',data:{txBlobLength:signed.tx_blob?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        const result = await client.submitAndWait(signed.tx_blob);

        await client.disconnect();

        const realTxHash = result.result.hash;
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-escrow.service.ts:66',message:'createEscrow: Real XRPL transaction submitted',data:{txHash:realTxHash,isPlaceholder:false,network:this.XRPL_NETWORK,sequence:result.result.Sequence},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        return realTxHash;
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
          escrowSequenceType: typeof params.escrowSequence,
          hasCondition: !!params.condition,
          hasFulfillment: !!params.fulfillment,
        });

        console.log('[XRPL] EscrowFinish transaction before autofill:', JSON.stringify(escrowFinish, null, 2));

        const prepared = await client.autofill(escrowFinish);
        console.log('[XRPL] EscrowFinish transaction after autofill:', JSON.stringify(prepared, null, 2));
        
        const signed = wallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);

        await client.disconnect();

        const txHash = result.result.hash;
        const txResult = (result.result.meta as any)?.TransactionResult;

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
   * Prepare an unsigned EscrowCreate transaction for user signing
   * Returns transaction object that can be sent to XUMM/MetaMask for signing
   */
  async prepareEscrowCreateTransaction(params: {
    fromAddress: string;
    toAddress: string;
    amountXrp: number;
    finishAfter?: number;
    cancelAfter?: number;
    condition?: string;
  }): Promise<{
    transaction: any;
    transactionBlob: string;
    instructions: string;
  }> {
    try {
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

      // Serialize to transaction blob (unsigned)
      // Note: User's wallet (Xaman/Xumm) will autofill Account, Sequence, Fee, etc.
      const txBlob = JSON.stringify(escrowCreate);

      return {
        transaction: escrowCreate,
        transactionBlob: txBlob,
        instructions: `Please sign this EscrowCreate transaction in your XRPL wallet to create escrow for ${params.amountXrp} XRP to ${params.toAddress}`,
      };
    } catch (error) {
      console.error('Error preparing EscrowCreate transaction:', error);
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
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-escrow.service.ts:253',message:'getEscrowDetailsByTxHash: Entry',data:{txHash,txHashLength:txHash.length,ownerAddress,network:this.XRPL_NETWORK,isValidFormat:/^[a-f0-9]{64}$/i.test(txHash)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      const client = new Client(this.XRPL_SERVER);
      await client.connect();

      try {
        // First, try to get the transaction details to find the sequence number
        let txResponse: any;
        try {
          txResponse = await client.request({
            command: 'tx',
            transaction: txHash,
          });
        } catch (requestError: any) {
          const errorData = requestError?.data;
          const errorCode = errorData?.error;

          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-escrow.service.ts:txCatch',message:'getEscrowDetailsByTxHash: tx query threw error',data:{txHash,error:errorCode,errorData,network:this.XRPL_NETWORK},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion

          // Handle common "txnNotFound" error gracefully by letting caller
          // fall back to alternative lookup strategies (e.g., account_objects).
          if (errorCode === 'txnNotFound') {
            console.error('[XRPL] Transaction not found (txnNotFound):', txHash);
            return null;
          }

          // For other errors, rethrow so callers can handle appropriately
          throw requestError;
        }

        // #region agent log
        const txResponseAny = txResponse as any;
        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-escrow.service.ts:264',message:'getEscrowDetailsByTxHash: XRPL tx query response',data:{txHash,hasResult:!!txResponseAny?.result,error:txResponseAny?.result?.error,errorCode:txResponseAny?.result?.error_code,errorMessage:txResponseAny?.result?.error_message,network:this.XRPL_NETWORK},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion

        if (!txResponse || !txResponse.result) {
          console.error('[XRPL] Transaction not found:', txHash);
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-escrow.service.ts:266',message:'getEscrowDetailsByTxHash: Transaction not found - trying fallback',data:{txHash,network:this.XRPL_NETWORK,reason:'txResponse or result is null'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
          
          // Cannot proceed without transaction hash - EscrowFinish requires transaction sequence
          // The escrow object sequence is different from the transaction sequence needed for OfferSequence
          console.warn('[XRPL] Transaction not found and cannot determine transaction sequence. EscrowFinish requires the transaction sequence from EscrowCreate, which cannot be determined without a valid transaction hash.');
          
          return null;
        }

        const txResult = txResponse.result as any;
        const escrowSequence = txResult.Sequence as number;

        console.log('[XRPL] Transaction details from tx command:', {
          txHash,
          transactionType: txResult.TransactionType,
          sequence: escrowSequence,
          account: txResult.Account,
          destination: txResult.Destination,
          amount: txResult.Amount,
        });

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

        // Find the escrow object matching this transaction hash
        const escrowObjects = accountObjectsResponse.result.account_objects || [];
        console.log(`[XRPL] Found ${escrowObjects.length} escrow objects for account ${ownerAddress}`);
        
        // Match by PreviousTxnID (the transaction hash that created the escrow)
        const escrowObject = escrowObjects.find(
          (obj: any) => (obj as any).PreviousTxnID === txHash
        ) as any;

        if (!escrowObject) {
          console.warn('[XRPL] Escrow object not found in account_objects. Available escrows:', escrowObjects.map((obj: any) => ({
            PreviousTxnID: (obj as any).PreviousTxnID,
            Sequence: (obj as any).Sequence,
            Destination: (obj as any).Destination,
          })));
          console.warn('[XRPL] Looking for escrow with PreviousTxnID:', txHash);
          console.warn('[XRPL] Escrow object not found - escrow may have been finished or cancelled, or transaction hash mismatch');
          // Don't return details if escrow object doesn't exist - we can't finish what doesn't exist
          return null;
        }

        console.log('[XRPL] Found matching escrow object:', {
          PreviousTxnID: (escrowObject as any).PreviousTxnID,
          ObjectSequence: (escrowObject as any).Sequence,
          TransactionSequence: escrowSequence,
          Destination: (escrowObject as any).Destination,
          Amount: (escrowObject as any).Amount,
        });

        // Extract amount from escrow object (it's in drops)
        const escrowAmount = (escrowObject as any).Amount;
        // dropsToXrp expects a string, ensure it's always a string
        const amountDropsStr: string = escrowAmount ? String(escrowAmount) : '0';
        const amount = parseFloat((dropsToXrp as any)(amountDropsStr));

        // IMPORTANT: For EscrowFinish, OfferSequence must match the Sequence from the original EscrowCreate transaction
        // This is the account sequence number from the EscrowCreate transaction, NOT the escrow object sequence
        // The escrow object has its own sequence, but EscrowFinish requires the transaction sequence

        return {
          sequence: escrowSequence, // Use transaction sequence (account sequence from EscrowCreate), not escrow object sequence
          amount,
          destination: (escrowObject as any).Destination || '',
          finishAfter: (escrowObject as any).FinishAfter ? ((escrowObject as any).FinishAfter as number) : undefined,
          cancelAfter: (escrowObject as any).CancelAfter ? ((escrowObject as any).CancelAfter as number) : undefined,
          condition: (escrowObject as any).Condition || undefined,
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
          (obj: any) => (obj as any).Sequence === escrowSequence
        ) as any;

        if (!escrowObject) {
          return null;
        }

        const escrowAmount = (escrowObject as any).Amount;
        // dropsToXrp expects a string, ensure it's always a string  
        const amountDrops: string = escrowAmount != null ? String(escrowAmount) : '0';
        const amount = parseFloat((dropsToXrp as any)(amountDrops));

        return {
          amount,
          destination: (escrowObject as any).Destination || '',
          finishAfter: (escrowObject as any).FinishAfter ? ((escrowObject as any).FinishAfter as number) : undefined,
          cancelAfter: (escrowObject as any).CancelAfter ? ((escrowObject as any).CancelAfter as number) : undefined,
          condition: (escrowObject as any).Condition || undefined,
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






