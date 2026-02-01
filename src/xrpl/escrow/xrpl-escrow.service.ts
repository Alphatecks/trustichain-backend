/**
 * XRPL Escrow Service
 * Handles XRPL escrow operations (EscrowCreate, EscrowFinish, EscrowCancel)
 */

import { Client, xrpToDrops, dropsToXrp } from 'xrpl';
import { Wallet } from 'xrpl/dist/npm/Wallet';

// XRPL network/server config (top-level for guaranteed logging)
const XRPL_NETWORK = process.env.XRPL_NETWORK || 'testnet';
const XRPL_SERVER = XRPL_NETWORK === 'mainnet'
  ? 'wss://xrplcluster.com'
  : 'wss://s.altnet.rippletest.net:51233';
console.log('[XRPL] Using network:', XRPL_NETWORK);
console.log('[XRPL] Using server:', XRPL_SERVER);

export class XRPLEscrowService {
  private readonly XRPL_NETWORK = XRPL_NETWORK;
  private readonly XRPL_SERVER = XRPL_SERVER;

  constructor() {
    console.log('[XRPL] Using network:', this.XRPL_NETWORK);
    console.log('[XRPL] Using server:', this.XRPL_SERVER);
  }

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
        throw new Error('Wallet secret required for XRPL EscrowCreate. For user escrows, use prepareEscrowCreateTransaction + XUMM instead of createEscrow().');
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
        const wallet = Wallet.fromSeed(trimmedSecret);
        if (wallet.classicAddress !== params.fromAddress) {
          throw new Error('Provided secret does not match the fromAddress');
        }

        const escrowCreate: any = {
          TransactionType: 'EscrowCreate',
          Account: wallet.classicAddress,
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

        // Manually fill required fields (Sequence, Fee)
        const accountInfo = await (client as any).request({
          command: 'account_info',
          account: wallet.classicAddress,
          ledger_index: 'validated',
        });
        escrowCreate.Sequence = accountInfo.result.account_data.Sequence;
        escrowCreate.Fee = '12'; // Set a default fee (in drops), adjust as needed

        // Sign transaction using xrpl.Wallet
        const { tx_blob } = wallet.sign(escrowCreate);

        // Submit transaction
        const submitResult = await (client as any).request({
          command: 'submit',
          tx_blob,
        });
        
        // Check if transaction was successful
        // XRPL submit response can have status in different places:
        // - submitResult.result.engine_result or submitResult.result.engine_result_code
        // - submitResult.result.tx_json.meta.TransactionResult (after validation)
        const engineResult = submitResult.result.engine_result || submitResult.result.engine_result_code;
        const txResult = submitResult.result.tx_json?.meta?.TransactionResult;
        
        // Wait for validation (simplified, production should poll for tx result)
        const realTxHash = submitResult.result.tx_json?.hash || submitResult.result.hash;
        
        console.log('[XRPL Escrow Create] Submit result:', {
          engineResult,
          txResult,
          txHash: realTxHash,
          hasHash: !!realTxHash,
          fullResult: JSON.stringify(submitResult.result, null, 2).substring(0, 500),
        });
        
        // Check for transaction failure
        // tec* codes are temporary failures, ter* are retryable, tesSUCCESS is success
        if (engineResult && !engineResult.startsWith('tes') && engineResult !== 'terQUEUED') {
          await client.disconnect();
          throw new Error(`Escrow creation transaction failed: ${engineResult}. This usually means the account doesn't have enough XRP to cover the escrow amount and transaction fee.`);
        }
        
        // If we have a validated transaction result, check it
        if (txResult && txResult !== 'tesSUCCESS') {
          await client.disconnect();
          throw new Error(`Escrow creation transaction failed: ${txResult}. The escrow was not created on XRPL.`);
        }
        
        await client.disconnect();
        
        if (!realTxHash) {
          throw new Error('Transaction submitted but no hash returned. Transaction may have failed.');
        }
        
        console.log('[XRPL Escrow Create] Transaction successful, returning hash:', realTxHash);
        
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
   * Verify that an escrow exists on XRPL before attempting to finish it
   * Returns escrow details if found, null if not found or already finished/cancelled
   */
  async verifyEscrowExists(params: {
    ownerAddress: string;
    escrowSequence: number;
    finisherAddress?: string;
    expectedTxHash?: string;
  }): Promise<{
    exists: boolean;
    escrowObject?: any;
    finishAfter?: number;
    cancelAfter?: number;
    condition?: string;
    destination?: string;
    alreadyFinished?: boolean;
    alreadyCancelled?: boolean;
    error?: string;
  }> {
    const client = new Client(this.XRPL_SERVER);
    await client.connect();

    try {
      const finisherAddress = params.finisherAddress || params.ownerAddress;

      // Query account_objects to find escrow
      const accountObjectsResponse = await (client as any).request({
        command: 'account_objects',
        account: params.ownerAddress,
        type: 'escrow',
      });

      const escrowObjects = accountObjectsResponse.result.account_objects || [];
      console.log(`[XRPL Escrow Verification] Found ${escrowObjects.length} escrow objects for owner ${params.ownerAddress}`);

      // Find escrow by matching the transaction sequence
      // We need to check account_tx to find which escrow object corresponds to the sequence
      // The OfferSequence in EscrowFinish must match the Sequence from EscrowCreate transaction
      let matchingEscrow: any = null;

      // First, try to find by PreviousTxnID if we have the expected transaction hash
      if (params.expectedTxHash) {
        matchingEscrow = escrowObjects.find(
          (obj: any) => (obj as any).PreviousTxnID === params.expectedTxHash && (obj as any).Account === params.ownerAddress
        ) as any;
        
        if (matchingEscrow) {
          console.log('[XRPL Escrow Verification] Found escrow by PreviousTxnID:', {
            PreviousTxnID: (matchingEscrow as any).PreviousTxnID,
            ObjectSequence: (matchingEscrow as any).Sequence,
            TransactionSequence: params.escrowSequence,
          });

          // CRITICAL: Verify that the sequence matches the actual EscrowCreate transaction sequence
          // The OfferSequence in EscrowFinish must match the Sequence from EscrowCreate, not the object sequence
          try {
            const txResponse = await (client as any).request({
              command: 'tx',
              transaction: params.expectedTxHash,
            });

            if (txResponse.result) {
              const txResult = txResponse.result as any;
              // Extract sequence from transaction - try multiple paths
              const actualTxSequence = 
                txResult.tx_json?.Sequence || 
                txResult.Sequence || 
                txResult.tx?.Sequence ||
                null;

              if (actualTxSequence !== null) {
                console.log('[XRPL Escrow Verification] EscrowCreate transaction sequence:', {
                  expectedSequence: params.escrowSequence,
                  actualTxSequence: actualTxSequence,
                  objectSequence: (matchingEscrow as any).Sequence,
                  matches: actualTxSequence === params.escrowSequence,
                });

                // Verify the sequence matches
                if (actualTxSequence !== params.escrowSequence) {
                  return {
                    exists: false,
                    error: `Sequence mismatch: The provided sequence ${params.escrowSequence} does not match the EscrowCreate transaction sequence ${actualTxSequence}. Use the transaction sequence (${actualTxSequence}) as OfferSequence in EscrowFinish.`,
                  };
                }
              } else {
                console.warn('[XRPL Escrow Verification] Could not extract sequence from EscrowCreate transaction');
              }
            }
          } catch (txError: any) {
            const errorCode = txError?.data?.error;
            if (errorCode === 'txnNotFound') {
              console.warn('[XRPL Escrow Verification] EscrowCreate transaction not found by hash, cannot verify sequence');
            } else {
              console.warn('[XRPL Escrow Verification] Error looking up EscrowCreate transaction:', txError);
            }
            // Continue with verification but log warning
          }
        }
      }

      // If not found by PreviousTxnID, we need to verify the sequence matches
      // by checking transaction history to find which escrow object was created with this sequence
      if (!matchingEscrow) {
        try {
          const accountTxResponse = await (client as any).request({
            command: 'account_tx',
            account: params.ownerAddress,
            ledger_index_min: -1,
            ledger_index_max: -1,
            limit: 200,
          });

          const transactions = accountTxResponse.result.transactions || [];
          
          // Find the EscrowCreate transaction with the matching sequence
          const createTx = transactions.find((txData: any) => {
            const tx = txData.tx || txData;
            return (tx as any).TransactionType === 'EscrowCreate' &&
                   (tx as any).Account === params.ownerAddress &&
                   (tx as any).Sequence === params.escrowSequence;
          });

          if (createTx) {
            const tx = (createTx as any).tx || createTx;
            const createTxHash = (tx as any).hash || (createTx as any).hash;
            
            // Now find the escrow object with this PreviousTxnID
            matchingEscrow = escrowObjects.find(
              (obj: any) => (obj as any).PreviousTxnID === createTxHash && (obj as any).Account === params.ownerAddress
            ) as any;

            if (matchingEscrow) {
              console.log('[XRPL Escrow Verification] Found escrow by transaction sequence:', {
                PreviousTxnID: (matchingEscrow as any).PreviousTxnID,
                ObjectSequence: (matchingEscrow as any).Sequence,
                TransactionSequence: params.escrowSequence,
              });
            }
          }
        } catch (txError) {
          console.warn('[XRPL Escrow Verification] Could not check transaction history:', txError);
        }
      }

      // Check if escrow was already finished or cancelled
      if (!matchingEscrow) {
        try {
          const accountTxResponse = await (client as any).request({
            command: 'account_tx',
            account: params.ownerAddress,
            ledger_index_min: -1,
            ledger_index_max: -1,
            limit: 200,
          });

          const transactions = accountTxResponse.result.transactions || [];
          
          const finishTx = transactions.find((txData: any) => {
            const tx = txData.tx || txData;
            return (tx as any).TransactionType === 'EscrowFinish' &&
                   (tx as any).Owner === params.ownerAddress &&
                   (tx as any).OfferSequence === params.escrowSequence;
          });

          const cancelTx = transactions.find((txData: any) => {
            const tx = txData.tx || txData;
            return (tx as any).TransactionType === 'EscrowCancel' &&
                   (tx as any).Owner === params.ownerAddress &&
                   (tx as any).OfferSequence === params.escrowSequence;
          });

          if (finishTx) {
            return {
              exists: false,
              alreadyFinished: true,
              error: `Escrow with sequence ${params.escrowSequence} for owner ${params.ownerAddress} has already been finished`,
            };
          }

          if (cancelTx) {
            return {
              exists: false,
              alreadyCancelled: true,
              error: `Escrow with sequence ${params.escrowSequence} for owner ${params.ownerAddress} has already been cancelled`,
            };
          }
        } catch (txError) {
          console.warn('[XRPL Escrow Verification] Could not check if escrow was finished/cancelled:', txError);
        }

        return {
          exists: false,
          error: `Escrow not found with sequence ${params.escrowSequence} for owner ${params.ownerAddress}. The escrow may not exist or the sequence number is incorrect.`,
        };
      }

      // Verify permissions: check FinishAfter if finisher is Owner
      const finishAfter = (matchingEscrow as any).FinishAfter ? ((matchingEscrow as any).FinishAfter as number) : undefined;
      const cancelAfter = (matchingEscrow as any).CancelAfter ? ((matchingEscrow as any).CancelAfter as number) : undefined;
      const condition = (matchingEscrow as any).Condition || undefined;
      const destination = (matchingEscrow as any).Destination || undefined;

      // If Owner is trying to finish before FinishAfter, they don't have permission
      if (finishAfter && finisherAddress === params.ownerAddress) {
        try {
          const ledgerResponse = await (client as any).request({
            command: 'ledger',
            ledger_index: 'validated',
          });
          const currentLedgerTime = ledgerResponse.result.ledger.close_time;
          
          if (currentLedgerTime < finishAfter) {
            return {
              exists: true,
              escrowObject: matchingEscrow,
              finishAfter,
              cancelAfter,
              condition,
              destination,
              error: `Insufficient permissions: FinishAfter time (${new Date((finishAfter + 946684800) * 1000).toISOString()}) not reached. Only the destination can finish before this time.`,
            };
          }
        } catch (ledgerError) {
          console.warn('[XRPL Escrow Verification] Could not check ledger time:', ledgerError);
        }
      }

      return {
        exists: true,
        escrowObject: matchingEscrow,
        finishAfter,
        cancelAfter,
        condition,
        destination,
      };
    } catch (error) {
      console.error('[XRPL Escrow Verification] Error verifying escrow:', error);
      return {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error verifying escrow',
      };
    } finally {
      await client.disconnect();
    }
  }

  /**
   * Finish (release) an escrow
   * Note: This requires wallet secret for signing. In production, handle securely.
   * For user-signed transactions, use prepareEscrowFinishTransaction instead.
   * 
   * @param params.ownerAddress - The original owner address from EscrowCreate (always required)
   * @param params.escrowSequence - The sequence number from EscrowCreate transaction
   * @param params.finisherAddress - The address finishing the escrow (Owner or Destination). Defaults to ownerAddress
   * @param params.condition - Optional condition if escrow was created with one
   * @param params.fulfillment - Optional fulfillment if escrow has a condition
   * @param params.walletSecret - Secret of the finisher (Owner or Destination)
   * @param params.expectedTxHash - Optional transaction hash to help verify escrow exists
   */
  async finishEscrow(params: {
    ownerAddress: string;
    escrowSequence: number;
    finisherAddress?: string; // Who is finishing (Owner or Destination). Defaults to ownerAddress
    condition?: string;
    fulfillment?: string;
    walletSecret?: string;
    expectedTxHash?: string; // Optional: transaction hash to help verify escrow
  }): Promise<string> {
    try {
      if (!params.walletSecret) {
        throw new Error('Wallet secret required to finish escrow. For user-signed transactions, use prepareEscrowFinishTransaction instead.');
      }

      const client = new Client(this.XRPL_SERVER);
      await client.connect();

      try {
        const trimmedSecret = params.walletSecret.trim();
        const wallet = Wallet.fromSeed(trimmedSecret);
        
        // Determine who is finishing: Owner or Destination
        const finisherAddress = params.finisherAddress || params.ownerAddress;
        
        if (wallet.classicAddress !== finisherAddress) {
          throw new Error(
            `Wallet address ${wallet.classicAddress} does not match finisher address ${finisherAddress}`
          );
        }

        // Verify escrow exists before attempting to finish
        console.log('[XRPL Escrow Finish] Verifying escrow exists before finishing:', {
          ownerAddress: params.ownerAddress,
          finisherAddress,
          escrowSequence: params.escrowSequence,
          expectedTxHash: params.expectedTxHash,
        });

        const verification = await this.verifyEscrowExists({
          ownerAddress: params.ownerAddress,
          escrowSequence: params.escrowSequence,
          finisherAddress,
          expectedTxHash: params.expectedTxHash,
        });

        if (!verification.exists) {
          if (verification.alreadyFinished) {
            throw new Error(`Escrow with sequence ${params.escrowSequence} for owner ${params.ownerAddress} has already been finished.`);
          }
          if (verification.alreadyCancelled) {
            throw new Error(`Escrow with sequence ${params.escrowSequence} for owner ${params.ownerAddress} has already been cancelled.`);
          }
          throw new Error(verification.error || `Escrow not found with sequence ${params.escrowSequence} for owner ${params.ownerAddress}. The sequence number may be incorrect.`);
        }

        if (verification.error) {
          throw new Error(verification.error);
        }

        // Use condition from verification if not provided
        const conditionToUse = params.condition || verification.condition;

        // COMPREHENSIVE VERIFICATION: Multiple checks before submitting
        let actualTxSequence: number | null = null;
        let verificationDetails: any = {};

        if (params.expectedTxHash) {
          try {
            // Verification 1: Query EscrowCreate transaction directly
            console.log('[XRPL Escrow Finish] Verification Step 1: Querying EscrowCreate transaction directly...');
            const txResponse = await (client as any).request({
              command: 'tx',
              transaction: params.expectedTxHash,
            });

            if (txResponse.result) {
              const txResult = txResponse.result as any;
              actualTxSequence = 
                txResult.tx_json?.Sequence || 
                txResult.Sequence || 
                txResult.tx?.Sequence ||
                null;

              const txAccount = txResult.tx_json?.Account || txResult.Account || txResult.tx?.Account;
              const txDestination = txResult.tx_json?.Destination || txResult.Destination || txResult.tx?.Destination;
              const txAmount = txResult.tx_json?.Amount || txResult.Amount || txResult.tx?.Amount;
              const txFinishAfter = txResult.tx_json?.FinishAfter || txResult.FinishAfter || txResult.tx?.FinishAfter;
              const txCondition = txResult.tx_json?.Condition || txResult.Condition || txResult.tx?.Condition;

              verificationDetails.escrowCreateTx = {
                sequence: actualTxSequence,
                account: txAccount,
                destination: txDestination,
                amount: txAmount,
                finishAfter: txFinishAfter,
                condition: txCondition,
                hash: params.expectedTxHash,
              };

              console.log('[XRPL Escrow Finish] EscrowCreate transaction details:', verificationDetails.escrowCreateTx);

              if (actualTxSequence !== null && actualTxSequence !== params.escrowSequence) {
                await client.disconnect();
                throw new Error(
                  `Sequence mismatch: The provided sequence ${params.escrowSequence} does not match the EscrowCreate transaction sequence ${actualTxSequence}. Use the transaction sequence (${actualTxSequence}) as OfferSequence in EscrowFinish.`
                );
              }

              // Verify Account matches Owner
              if (txAccount && txAccount !== params.ownerAddress) {
                console.error('[XRPL Escrow Finish] CRITICAL: EscrowCreate Account does not match Owner!', {
                  escrowCreateAccount: txAccount,
                  ownerAddress: params.ownerAddress,
                });
                await client.disconnect();
                throw new Error(
                  `EscrowCreate transaction Account (${txAccount}) does not match Owner address (${params.ownerAddress}). This is a critical mismatch.`
                );
              }
            }
          } catch (txError: any) {
            const errorCode = txError?.data?.error;
            if (errorCode !== 'txnNotFound') {
              console.warn('[XRPL Escrow Finish] Could not verify sequence from EscrowCreate transaction:', txError);
            }
            // Continue if transaction not found, but log warning
          }

          // Verification 2: Check for multiple escrows with similar sequences
          try {
            console.log('[XRPL Escrow Finish] Verification Step 2: Checking for multiple escrows with similar sequences...');
            const accountObjectsResponse = await (client as any).request({
              command: 'account_objects',
              account: params.ownerAddress,
              type: 'escrow',
            });

            const escrowObjects = accountObjectsResponse.result.account_objects || [];
            
            // Find all escrows that might match
            const potentialMatches = escrowObjects.filter((obj: any) => {
              const objSequence = (obj as any).Sequence;
              // Check if object sequence is close to our sequence (within 10)
              return Math.abs(objSequence - params.escrowSequence) <= 10;
            });

            verificationDetails.potentialMatches = potentialMatches.map((obj: any) => ({
              objectSequence: (obj as any).Sequence,
              previousTxnID: (obj as any).PreviousTxnID,
              destination: (obj as any).Destination,
              amount: (obj as any).Amount,
              finishAfter: (obj as any).FinishAfter,
            }));

            console.log('[XRPL Escrow Finish] Escrows with similar sequences:', {
              targetSequence: params.escrowSequence,
              potentialMatches: verificationDetails.potentialMatches,
            });

            // Check if there are multiple escrows with the exact same sequence (shouldn't happen, but check)
            const exactMatches = escrowObjects.filter((obj: any) => {
              return (obj as any).Sequence === params.escrowSequence;
            });

            if (exactMatches.length > 1) {
              console.error('[XRPL Escrow Finish] WARNING: Multiple escrow objects found with same sequence!', {
                sequence: params.escrowSequence,
                count: exactMatches.length,
                escrows: exactMatches.map((obj: any) => ({
                  previousTxnID: (obj as any).PreviousTxnID,
                  destination: (obj as any).Destination,
                })),
              });
            }
          } catch (objError) {
            console.warn('[XRPL Escrow Finish] Could not check for multiple escrows:', objError);
          }

          // Verification 3: Verify escrow object state matches expectations
          try {
            console.log('[XRPL Escrow Finish] Verification Step 3: Verifying escrow object state...');
            if (verification.escrowObject) {
              const escrowObj = verification.escrowObject as any;
              
              verificationDetails.escrowObject = {
                objectSequence: escrowObj.Sequence,
                previousTxnID: escrowObj.PreviousTxnID,
                account: escrowObj.Account,
                destination: escrowObj.Destination,
                amount: escrowObj.Amount,
                finishAfter: escrowObj.FinishAfter,
                cancelAfter: escrowObj.CancelAfter,
                condition: escrowObj.Condition,
                ledgerIndex: escrowObj.LedgerIndex,
              };

              // Verify PreviousTxnID matches expected hash
              if (escrowObj.PreviousTxnID !== params.expectedTxHash) {
                console.error('[XRPL Escrow Finish] CRITICAL: Escrow object PreviousTxnID mismatch!', {
                  expected: params.expectedTxHash,
                  actual: escrowObj.PreviousTxnID,
                });
              }

              // Verify Account matches Owner
              if (escrowObj.Account !== params.ownerAddress) {
                console.error('[XRPL Escrow Finish] CRITICAL: Escrow object Account mismatch!', {
                  expected: params.ownerAddress,
                  actual: escrowObj.Account,
                });
                await client.disconnect();
                throw new Error(
                  `Escrow object Account (${escrowObj.Account}) does not match Owner address (${params.ownerAddress}).`
                );
              }

              // Verify Destination matches finisher (if finisher is destination)
              if (finisherAddress !== params.ownerAddress && escrowObj.Destination !== finisherAddress) {
                console.error('[XRPL Escrow Finish] CRITICAL: Escrow object Destination mismatch!', {
                  expected: finisherAddress,
                  actual: escrowObj.Destination,
                });
                await client.disconnect();
                throw new Error(
                  `Escrow object Destination (${escrowObj.Destination}) does not match finisher address (${finisherAddress}).`
                );
              }

              console.log('[XRPL Escrow Finish] Escrow object state verified:', verificationDetails.escrowObject);
            }
          } catch (objStateError) {
            console.warn('[XRPL Escrow Finish] Could not verify escrow object state:', objStateError);
          }

          // Verification 4: Check account_tx to see if escrow was already finished/cancelled
          try {
            console.log('[XRPL Escrow Finish] Verification Step 4: Checking transaction history...');
            const accountTxResponse = await (client as any).request({
              command: 'account_tx',
              account: params.ownerAddress,
              ledger_index_min: -1,
              ledger_index_max: -1,
              limit: 100,
            });

            const transactions = accountTxResponse.result.transactions || [];
            
            // Find EscrowFinish transactions with this sequence
            const finishTxs = transactions.filter((txData: any) => {
              const tx = txData.tx || txData;
              return (tx as any).TransactionType === 'EscrowFinish' &&
                     (tx as any).Owner === params.ownerAddress &&
                     (tx as any).OfferSequence === params.escrowSequence;
            });

            // Find EscrowCancel transactions with this sequence
            const cancelTxs = transactions.filter((txData: any) => {
              const tx = txData.tx || txData;
              return (tx as any).TransactionType === 'EscrowCancel' &&
                     (tx as any).Owner === params.ownerAddress &&
                     (tx as any).OfferSequence === params.escrowSequence;
            });

            verificationDetails.transactionHistory = {
              finishTransactions: finishTxs.length,
              cancelTransactions: cancelTxs.length,
              finishTxHashes: finishTxs.map((txData: any) => {
                const tx = txData.tx || txData;
                return (tx as any).hash || txData.hash;
              }),
            };

            if (finishTxs.length > 0) {
              console.error('[XRPL Escrow Finish] CRITICAL: Escrow was already finished!', {
                finishTxHashes: verificationDetails.transactionHistory.finishTxHashes,
              });
              await client.disconnect();
              throw new Error(
                `Escrow with sequence ${params.escrowSequence} has already been finished. Transaction hashes: ${verificationDetails.transactionHistory.finishTxHashes.join(', ')}`
              );
            }

            if (cancelTxs.length > 0) {
              console.error('[XRPL Escrow Finish] CRITICAL: Escrow was already cancelled!');
              await client.disconnect();
              throw new Error(
                `Escrow with sequence ${params.escrowSequence} has already been cancelled.`
              );
            }

            console.log('[XRPL Escrow Finish] Transaction history check passed:', verificationDetails.transactionHistory);
          } catch (historyError) {
            console.warn('[XRPL Escrow Finish] Could not check transaction history:', historyError);
          }

          // Verification 5: Verify escrow object exists on validated ledger
          try {
            console.log('[XRPL Escrow Finish] Verification Step 5: Verifying escrow object exists on validated ledger...');
            if (verification.escrowObject && params.expectedTxHash) {
              const escrowObj = verification.escrowObject as any;
              // LedgerIndex might be in different fields: LedgerIndex, index, or not present
              const ledgerIndex = escrowObj.LedgerIndex || escrowObj.index || escrowObj.ledger_index;

              // Query account_objects with ledger_index: 'validated' to ensure we're getting validated data
              const validatedObjectsResponse = await (client as any).request({
                command: 'account_objects',
                account: params.ownerAddress,
                type: 'escrow',
                ledger_index: 'validated',
              });

              const validatedEscrows = validatedObjectsResponse.result.account_objects || [];
              // Find by PreviousTxnID (most reliable) or by LedgerIndex if available
              const validatedEscrow = validatedEscrows.find(
                (obj: any) => (obj as any).PreviousTxnID === params.expectedTxHash ||
                             (ledgerIndex && ((obj as any).LedgerIndex === ledgerIndex || (obj as any).index === ledgerIndex))
              ) as any;

              if (!validatedEscrow) {
                console.error('[XRPL Escrow Finish] CRITICAL: Escrow object not found on validated ledger!', {
                  ledgerIndex: ledgerIndex || 'not found',
                  expectedTxHash: params.expectedTxHash,
                  validatedEscrowsCount: validatedEscrows.length,
                  escrowObjectKeys: Object.keys(escrowObj),
                });
                await client.disconnect();
                throw new Error(
                  `Escrow object not found on validated ledger. The escrow may not be fully validated yet. Try waiting a few seconds and retry. PreviousTxnID: ${params.expectedTxHash}`
                );
              }

              verificationDetails.validatedLedgerCheck = {
                found: true,
                ledgerIndex: (validatedEscrow as any).LedgerIndex || (validatedEscrow as any).index,
                previousTxnID: (validatedEscrow as any).PreviousTxnID,
                validatedLedgerIndex: validatedObjectsResponse.result.ledger_index,
              };

              console.log('[XRPL Escrow Finish] Escrow object verified on validated ledger:', verificationDetails.validatedLedgerCheck);
            }
          } catch (ledgerError) {
            console.warn('[XRPL Escrow Finish] Could not verify escrow on validated ledger:', ledgerError);
          }

          // Verification 6: Check destination account flags and restrictions
          try {
            console.log('[XRPL Escrow Finish] Verification Step 6: Checking destination account flags and restrictions...');
            const accountInfoResponse = await (client as any).request({
              command: 'account_info',
              account: finisherAddress,
              ledger_index: 'validated',
            });

            if (accountInfoResponse.result) {
              const accountData = accountInfoResponse.result.account_data;
              const flags = accountData.Flags || 0;
              const sequence = accountData.Sequence;
              const balance = accountData.Balance;

              verificationDetails.destinationAccount = {
                address: finisherAddress,
                sequence,
                balance: balance ? parseFloat((dropsToXrp as any)(String(balance))) : 0,
                flags,
                flagsHex: '0x' + flags.toString(16),
                // Check for common flags that might prevent transactions
                hasDisableMaster: (flags & 0x00100000) !== 0, // asfDisableMaster
                hasRequireAuth: (flags & 0x00040000) !== 0, // asfRequireAuth
                hasRequireDestTag: (flags & 0x00020000) !== 0, // asfRequireDestTag
                hasDisallowXRP: (flags & 0x00080000) !== 0, // asfDisallowXRP
                hasGlobalFreeze: (flags & 0x00400000) !== 0, // asfGlobalFreeze
                hasNoFreeze: (flags & 0x00200000) !== 0, // asfNoFreeze
              };

              console.log('[XRPL Escrow Finish] Destination account info:', verificationDetails.destinationAccount);

              // Check if account has enough balance for transaction fee
              const minBalance = 10000000; // 10 XRP reserve (in drops)
              if (parseInt(String(balance)) < minBalance + 12000) { // 12 drops for fee
                console.warn('[XRPL Escrow Finish] WARNING: Destination account may not have enough balance for transaction fee', {
                  balance: verificationDetails.destinationAccount.balance,
                  minRequired: (minBalance + 12000) / 1000000,
                });
              }

              // Check for flags that might prevent transactions
              if (verificationDetails.destinationAccount.hasDisableMaster) {
                console.warn('[XRPL Escrow Finish] WARNING: Destination account has DisableMaster flag set');
              }
              if (verificationDetails.destinationAccount.hasGlobalFreeze) {
                console.error('[XRPL Escrow Finish] CRITICAL: Destination account has GlobalFreeze flag set!');
                await client.disconnect();
                throw new Error('Destination account has GlobalFreeze flag set, cannot finish escrow');
              }
            }
          } catch (accountError: any) {
            const errorCode = accountError?.data?.error;
            if (errorCode === 'actNotFound') {
              console.error('[XRPL Escrow Finish] CRITICAL: Destination account not found on XRPL!', {
                finisherAddress,
              });
              await client.disconnect();
              throw new Error(`Destination account ${finisherAddress} not found on XRPL`);
            }
            console.warn('[XRPL Escrow Finish] Could not check destination account info:', accountError);
          }

          // Verification 7: Check if escrow was recently created (validation delay check)
          try {
            console.log('[XRPL Escrow Finish] Verification Step 7: Checking escrow validation status...');
            if (verificationDetails.escrowCreateTx && verificationDetails.escrowCreateTx.hash) {
              // Get the latest validated ledger
              const ledgerResponse = await (client as any).request({
                command: 'ledger',
                ledger_index: 'validated',
              });

              const currentLedgerIndex = ledgerResponse.result.ledger_index;
              const currentLedgerTime = ledgerResponse.result.ledger.close_time;

              // Get the EscrowCreate transaction to find which ledger it was validated in
              const createTxResponse = await (client as any).request({
                command: 'tx',
                transaction: verificationDetails.escrowCreateTx.hash,
              });

              if (createTxResponse.result) {
                const createLedgerIndex = createTxResponse.result.ledger_index;
                let ledgersSinceCreation = currentLedgerIndex - createLedgerIndex;

                verificationDetails.validationStatus = {
                  createLedgerIndex,
                  currentLedgerIndex,
                  ledgersSinceCreation,
                  currentLedgerTime,
                  createLedgerTime: createTxResponse.result.close_time_iso,
                  isRecentlyCreated: ledgersSinceCreation < 10,
                };

                console.log('[XRPL Escrow Finish] Escrow validation status:', verificationDetails.validationStatus);

                // XRPL requires escrows to be validated for at least a few ledgers before they can be finished
                // This is a known limitation - escrows need time to be fully indexed
                // If escrow is too recent, poll and wait until it's ready
                if (ledgersSinceCreation < 5) {
                  console.log('[XRPL Escrow Finish] Escrow is too recent, waiting for validation...', {
                    ledgersSinceCreation,
                    requiredLedgers: 5,
                  });

                  const maxWaitTime = 30000; // 30 seconds max wait
                  const pollInterval = 2000; // Poll every 2 seconds
                  const startTime = Date.now();
                  let ready = false;
                  let attempts = 0;
                  const maxAttempts = Math.ceil(maxWaitTime / pollInterval);

                  while (!ready && (Date.now() - startTime) < maxWaitTime) {
                    attempts++;
                    console.log(`[XRPL Escrow Finish] Polling attempt ${attempts}/${maxAttempts} - waiting for escrow validation...`);

                    // Wait before polling
                    await new Promise(resolve => setTimeout(resolve, pollInterval));

                    try {
                      // Check current ledger and recalculate ledgersSinceCreation
                      const currentLedgerResponse = await (client as any).request({
                        command: 'ledger',
                        ledger_index: 'validated',
                      });

                      const newCurrentLedgerIndex = currentLedgerResponse.result.ledger_index;
                      ledgersSinceCreation = newCurrentLedgerIndex - createLedgerIndex;

                      console.log('[XRPL Escrow Finish] Polling check:', {
                        attempt: attempts,
                        currentLedgerIndex: newCurrentLedgerIndex,
                        createLedgerIndex,
                        ledgersSinceCreation,
                        required: 5,
                        ready: ledgersSinceCreation >= 5,
                      });

                      if (ledgersSinceCreation >= 5) {
                        ready = true;
                        verificationDetails.validationStatus = {
                          ...verificationDetails.validationStatus,
                          currentLedgerIndex: newCurrentLedgerIndex,
                          ledgersSinceCreation,
                          waitedForValidation: true,
                          waitTimeMs: Date.now() - startTime,
                          pollingAttempts: attempts,
                        };
                        console.log('[XRPL Escrow Finish] Escrow is now ready after waiting:', {
                          waitTimeMs: Date.now() - startTime,
                          pollingAttempts: attempts,
                          finalLedgersSinceCreation: ledgersSinceCreation,
                        });
                      }
                    } catch (pollError) {
                      console.warn('[XRPL Escrow Finish] Error during polling, will retry:', pollError);
                      // Continue polling
                    }
                  }

                  if (!ready) {
                    const waitTime = Date.now() - startTime;
                    const errorMessage = `Escrow validation timeout: Waited ${Math.round(waitTime / 1000)} seconds but escrow is still not ready (only ${ledgersSinceCreation} ledger(s) since creation). XRPL requires escrows to be validated for at least 5 ledgers before they can be finished. Please try again in a few moments.`;
                    console.error('[XRPL Escrow Finish] CRITICAL:', errorMessage);
                    await client.disconnect();
                    throw new Error(errorMessage);
                  }
                }
              }
            }
          } catch (validationError) {
            console.warn('[XRPL Escrow Finish] Could not check escrow validation status:', validationError);
          }
        }

        console.log('[XRPL Escrow Finish] All verifications passed, proceeding with transaction:', {
          ownerAddress: params.ownerAddress,
          finisherAddress,
          escrowSequence: params.escrowSequence,
          actualTxSequence: actualTxSequence || 'not verified',
          hasCondition: !!conditionToUse,
          finishAfter: verification.finishAfter,
          objectSequence: verification.escrowObject ? (verification.escrowObject as any).Sequence : 'unknown',
          verificationDetails: JSON.stringify(verificationDetails, null, 2).substring(0, 2000), // First 2000 chars
        });

        // EscrowFinish transaction structure:
        // - Account: The account submitting the transaction (Owner or Destination)
        // - Owner: The original owner address from EscrowCreate (always required)
        // - OfferSequence: The sequence from EscrowCreate transaction
        const escrowFinish: any = {
          TransactionType: 'EscrowFinish',
          Account: wallet.classicAddress, // Who is submitting (Owner or Destination)
          Owner: params.ownerAddress, // Original owner from EscrowCreate (always required)
          OfferSequence: params.escrowSequence,
        };

        // Add condition and fulfillment if provided
        if (conditionToUse) {
          escrowFinish.Condition = conditionToUse;
        }
        if (params.fulfillment) {
          escrowFinish.Fulfillment = params.fulfillment;
        }

        console.log('[XRPL] Preparing EscrowFinish transaction:', {
          ownerAddress: params.ownerAddress,
          finisherAddress: finisherAddress,
          escrowSequence: params.escrowSequence,
          escrowSequenceType: typeof params.escrowSequence,
          hasCondition: !!params.condition,
          hasFulfillment: !!params.fulfillment,
          isFinishingAsDestination: finisherAddress !== params.ownerAddress,
        });

        console.log('[XRPL] EscrowFinish transaction before autofill:', JSON.stringify(escrowFinish, null, 2));

        // Manually fill required fields (Sequence, Fee)
        const accountInfo = await (client as any).request({
          command: 'account_info',
          account: wallet.classicAddress,
          ledger_index: 'validated',
        });
        escrowFinish.Sequence = accountInfo.result.account_data.Sequence;
        escrowFinish.Fee = '12'; // Set a default fee (in drops), adjust as needed

        // Sign transaction using xrpl.Wallet
        const { tx_blob } = wallet.sign(escrowFinish);

        // Submit transaction
        const submitResult = await (client as any).request({
          command: 'submit',
          tx_blob,
        });
        
        // Check if transaction was successful
        const engineResult = submitResult.result.engine_result || submitResult.result.engine_result_code;
        const txResult = submitResult.result.tx_json?.meta?.TransactionResult;
        const txHash = submitResult.result.tx_json?.hash || submitResult.result.hash;
        
        console.log('[XRPL Escrow Finish] Submit result:', {
          engineResult,
          txResult,
          txHash,
          hasHash: !!txHash,
          ownerAddress: params.ownerAddress,
          finisherAddress: params.finisherAddress || params.ownerAddress,
          escrowSequence: params.escrowSequence,
        });
        
        // Check for transaction failure
        if (engineResult && !engineResult.startsWith('tes') && engineResult !== 'terQUEUED') {
          let errorMessage = `EscrowFinish transaction failed: ${engineResult}. The escrow was not released.`;
          
          // Provide more specific error messages for common error codes
          if (engineResult === 'tecNO_PERMISSION') {
            errorMessage = `EscrowFinish transaction failed: tecNO_PERMISSION. No permission to finish escrow with sequence ${params.escrowSequence} for owner ${params.ownerAddress}. This usually means: (1) The sequence number doesn't match any escrow created by the owner, (2) The FinishAfter time hasn't been reached and the finisher doesn't have permission, or (3) The escrow has already been finished or cancelled.`;
          } else if (engineResult === 'tecNO_ENTRY') {
            errorMessage = `EscrowFinish transaction failed: tecNO_ENTRY. Escrow with sequence ${params.escrowSequence} for owner ${params.ownerAddress} not found. The escrow may have already been finished or cancelled, or the sequence number is incorrect.`;
          }
          
          console.error('[XRPL Escrow Finish] Transaction failed:', {
            engineResult,
            txResult,
            txHash,
            ownerAddress: params.ownerAddress,
            finisherAddress: params.finisherAddress || params.ownerAddress,
            escrowSequence: params.escrowSequence,
            errorCode: engineResult,
            fullSubmitResult: JSON.stringify(submitResult.result, null, 2).substring(0, 1000),
          });
          await client.disconnect();
          throw new Error(errorMessage);
        }
        
        // If we have a validated transaction result, check it
        if (txResult && txResult !== 'tesSUCCESS') {
          console.error('[XRPL Escrow Finish] Transaction validation failed:', {
            engineResult,
            txResult,
            txHash,
            ownerAddress: params.ownerAddress,
            finisherAddress: params.finisherAddress || params.ownerAddress,
            escrowSequence: params.escrowSequence,
            errorCode: txResult,
            fullSubmitResult: JSON.stringify(submitResult.result, null, 2).substring(0, 1000),
          });
          await client.disconnect();
          throw new Error(`EscrowFinish transaction failed: ${txResult}. The escrow was not released.`);
        }
        
        await client.disconnect();
        
        if (!txHash) {
          console.error('[XRPL Escrow Finish] No transaction hash returned:', {
            engineResult,
            txResult,
            hasTxJson: !!submitResult.result.tx_json,
            hasHash: !!submitResult.result.hash,
            fullSubmitResult: JSON.stringify(submitResult.result, null, 2).substring(0, 1000),
            ownerAddress: params.ownerAddress,
            finisherAddress: params.finisherAddress || params.ownerAddress,
            escrowSequence: params.escrowSequence,
          });
          await client.disconnect();
          throw new Error('Transaction submitted but no hash returned. Transaction may have failed.');
        }
        
        console.log('[XRPL Escrow Finish] Transaction successful, returning hash:', txHash);
        
        return txHash;
      } catch (error) {
        await client.disconnect();
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[XRPL Escrow Finish] Error in finishEscrow inner try block:', {
          error: errorMessage,
          errorName: error instanceof Error ? error.name : 'Unknown',
          errorStack: error instanceof Error ? error.stack : undefined,
          ownerAddress: params.ownerAddress,
          finisherAddress: params.finisherAddress || params.ownerAddress,
          escrowSequence: params.escrowSequence,
        });
        throw error;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[XRPL] Error finishing escrow (outer catch):', {
        error: errorMessage,
        errorName: error instanceof Error ? error.name : 'Unknown',
        errorStack: error instanceof Error ? error.stack : undefined,
        ownerAddress: params.ownerAddress,
        finisherAddress: params.finisherAddress || params.ownerAddress,
        escrowSequence: params.escrowSequence,
      });
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
   * 
   * @param params.ownerAddress - The original owner address from EscrowCreate (always required for Owner field)
   * @param params.finisherAddress - The address that will sign (Owner or Destination). If not provided, defaults to ownerAddress
   * @param params.escrowSequence - The sequence number from EscrowCreate transaction
   */
  async prepareEscrowFinishTransaction(params: {
    ownerAddress: string;
    finisherAddress?: string; // Who will sign (Owner or Destination). Defaults to ownerAddress
    escrowSequence: number;
    condition?: string;
    fulfillment?: string;
  }): Promise<{
    transaction: any;
    transactionBlob: string;
    instructions: string;
  }> {
    try {
      const finisherAddress = params.finisherAddress || params.ownerAddress;
      
      // EscrowFinish structure:
      // - Account: The account submitting/signing (Owner or Destination)
      // - Owner: The original owner from EscrowCreate (always required)
      const escrowFinish: any = {
        TransactionType: 'EscrowFinish',
        Account: finisherAddress, // Who is signing (will be autofilled by XUMM to match signer)
        Owner: params.ownerAddress, // Original owner from EscrowCreate (always required)
        OfferSequence: params.escrowSequence,
      };

      if (params.condition) {
        escrowFinish.Condition = params.condition;
      }
      if (params.fulfillment) {
        escrowFinish.Fulfillment = params.fulfillment;
      }

      // Serialize to transaction blob (unsigned)
      // Note: User's wallet (Xaman/Xumm) will autofill Account (to match signer), Sequence, Fee, etc.
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
        // First, try to get the transaction details to find the sequence number
        let txResponse: any;
        try {
          txResponse = await (client as any).request({
            command: 'tx',
            transaction: txHash,
          });
        } catch (requestError: any) {
          const errorData = requestError?.data;
          const errorCode = errorData?.error;


        

          // Handle common "txnNotFound" error gracefully by letting caller
          // fall back to alternative lookup strategies (e.g., account_objects).
          if (errorCode === 'txnNotFound') {
            console.error('[XRPL] Transaction not found (txnNotFound):', txHash);
            return null;
          }

          // For other errors, rethrow so callers can handle appropriately
          throw requestError;
        }

     
     

        if (!txResponse || !txResponse.result) {
          console.error('[XRPL] Transaction not found:', txHash);
      
        
          
          // Cannot proceed without transaction hash - EscrowFinish requires transaction sequence
          // The escrow object sequence is different from the transaction sequence needed for OfferSequence
          console.warn('[XRPL] Transaction not found and cannot determine transaction sequence. EscrowFinish requires the transaction sequence from EscrowCreate, which cannot be determined without a valid transaction hash.');
          
          return null;
        }

        // Add detailed logging to capture actual response structure
        console.log('[XRPL] Raw txResponse structure:', {
          hasResult: !!txResponse.result,
          resultKeys: txResponse.result ? Object.keys(txResponse.result) : [],
          resultType: typeof txResponse.result,
          hasSequence: !!(txResponse.result as any)?.Sequence,
          hasTx: !!(txResponse.result as any)?.tx,
          fullResult: JSON.stringify(txResponse.result, null, 2).substring(0, 500), // First 500 chars for debugging
        });

        const txResult = txResponse.result as any;
        
        // The XRPL tx command returns transaction data in tx_json field
        // Try multiple possible paths for Sequence with defensive parsing
        // The correct path is usually tx_json.Sequence for the tx command
        let escrowSequence = 
          txResult.tx_json?.Sequence || 
          txResult.Sequence || 
          txResult.tx?.Sequence || 
          (txResponse.result as any).tx?.Sequence ||
          null;

        // Log which path was used for debugging
        let sequenceSource = 'unknown';
        if (txResult.tx_json?.Sequence) {
          sequenceSource = 'tx_json.Sequence';
        } else if (txResult.Sequence) {
          sequenceSource = 'txResult.Sequence';
        } else if (txResult.tx?.Sequence) {
          sequenceSource = 'txResult.tx.Sequence';
        } else if ((txResponse.result as any).tx?.Sequence) {
          sequenceSource = 'txResponse.result.tx.Sequence';
        }

        // Try multiple paths for other transaction fields
        const transactionType = 
          txResult.tx_json?.TransactionType || 
          txResult.TransactionType || 
          txResult.tx?.TransactionType ||
          null;
        
        const account = 
          txResult.tx_json?.Account || 
          txResult.Account || 
          txResult.tx?.Account ||
          null;
        
        const destination = 
          txResult.tx_json?.Destination || 
          txResult.Destination || 
          txResult.tx?.Destination ||
          null;
        
        const amount = 
          txResult.tx_json?.Amount || 
          txResult.Amount || 
          txResult.tx?.Amount ||
          null;

        console.log('[XRPL] Transaction details from tx command (with fallback parsing):', {
          txHash,
          transactionType,
          sequence: escrowSequence,
          sequenceSource,
          account,
          destination,
          amount,
          parsingPath: {
            sequence: sequenceSource,
            transactionType: txResult.tx_json?.TransactionType ? 'txResult.tx_json.TransactionType' : (txResult.TransactionType ? 'txResult.TransactionType' : (txResult.tx?.TransactionType ? 'txResult.tx.TransactionType' : 'not found')),
          },
        });

        if (!escrowSequence) {
          console.error('[XRPL] No sequence found in transaction after trying all paths:', {
            txHash,
            txResultKeys: Object.keys(txResult || {}),
            txResultHasTx: !!txResult?.tx,
            txResultTxKeys: txResult?.tx ? Object.keys(txResult.tx) : [],
            fullTxResult: JSON.stringify(txResult, null, 2).substring(0, 1000), // First 1000 chars for debugging
          });
          
          // Fallback: Try to get sequence from account_objects by matching PreviousTxnID
          console.log('[XRPL] Attempting fallback: querying account_objects to find sequence by PreviousTxnID');
          try {
            const accountObjectsResponse = await (client as any).request({
              command: 'account_objects',
              account: ownerAddress,
              type: 'escrow',
            });
            
            const escrowObjects = accountObjectsResponse.result.account_objects || [];
            const escrowByTxHash = escrowObjects.find(
              (obj: any) => (obj as any).PreviousTxnID === txHash && (obj as any).Account === ownerAddress
            ) as any;
            
            if (escrowByTxHash) {
              // If we found the escrow object, we still need the transaction sequence
              // Try to get it from account_tx by finding the EscrowCreate transaction
              const accountTxResponse = await (client as any).request({
                command: 'account_tx',
                account: ownerAddress,
                ledger_index_min: -1,
                ledger_index_max: -1,
                limit: 200,
              });
              
              const transactions = accountTxResponse.result.transactions || [];
              const createTx = transactions.find((txData: any) => {
                const tx = txData.tx || txData;
                return (tx as any).TransactionType === 'EscrowCreate' &&
                       ((tx as any).hash === txHash || (txData as any).hash === txHash);
              });
              
              if (createTx) {
                const tx = (createTx as any).tx || createTx;
                escrowSequence = (tx as any).Sequence;
                sequenceSource = 'account_tx fallback';
                console.log('[XRPL] Found sequence via account_tx fallback:', escrowSequence);
              }
            }
          } catch (fallbackError) {
            console.warn('[XRPL] Fallback sequence lookup failed:', fallbackError);
          }
          
          if (!escrowSequence) {
            return null;
          }
        }

        // Verify this is an EscrowCreate transaction
        if (transactionType !== 'EscrowCreate') {
          console.error('[XRPL] Transaction is not EscrowCreate:', transactionType);
          return null;
        }

        // Get escrow details from account_objects to verify it still exists
        const accountObjectsResponse = await (client as any).request({
          command: 'account_objects',
          account: ownerAddress,
          type: 'escrow',
        });

        // Find the escrow object matching this transaction hash and account
        const escrowObjects = accountObjectsResponse.result.account_objects || [];
        console.log(`[XRPL] Found ${escrowObjects.length} escrow objects for account ${ownerAddress}`);

        // Match by PreviousTxnID and Account
        let escrowObject = escrowObjects.find(
          (obj: any) => (obj as any).PreviousTxnID === txHash && (obj as any).Account === ownerAddress
        ) as any;

        if (!escrowObject) {
          // Fallback: try matching by Destination and Amount if PreviousTxnID is missing
          // Use defensively parsed values
          escrowObject = escrowObjects.find(
            (obj: any) =>
              (obj as any).Destination === destination &&
              (obj as any).Amount === amount &&
              (obj as any).Account === ownerAddress
          ) as any;
          if (!escrowObject) {
            console.warn('[XRPL] Escrow object not found in account_objects. Available escrows:', escrowObjects.map((obj: any) => ({
              PreviousTxnID: (obj as any).PreviousTxnID,
              Sequence: (obj as any).Sequence,
              Destination: (obj as any).Destination,
            })));
            console.warn('[XRPL] Looking for escrow with PreviousTxnID:', txHash);
            console.warn('[XRPL] Escrow object not found - escrow may have been finished or cancelled');
            // Check transaction history to see if escrow was finished/cancelled
            try {
              const accountTxResponse = await (client as any).request({
                command: 'account_tx',
                account: ownerAddress,
                ledger_index_min: -1,
                ledger_index_max: -1,
                limit: 100,
              });
              const transactions = accountTxResponse.result.transactions || [];
              // Look for EscrowFinish or EscrowCancel transactions that reference this escrow
              const relatedTx = transactions.find((txData: any) => {
                const tx = txData.tx || txData;
                return ((tx as any).TransactionType === 'EscrowFinish' || (tx as any).TransactionType === 'EscrowCancel') &&
                       (tx as any).Owner === ownerAddress &&
                       (tx as any).OfferSequence === escrowSequence;
              });
              if (relatedTx) {
                const tx = (relatedTx as any).tx || relatedTx;
                const txType = (tx as any).TransactionType;
                console.warn(`[XRPL] Found ${txType} transaction for this escrow. Escrow was already ${txType === 'EscrowFinish' ? 'finished' : 'cancelled'}.`);
                // Return null but we'll handle this in the calling code with a better error message
                return null;
              }
            } catch (historyError) {
              console.warn('[XRPL] Could not check transaction history:', historyError);
            }
            // Escrow object doesn't exist and we couldn't verify it was finished - return null
            // The calling code should handle this with a helpful error message
            return null;
          }
        }

        console.log('[XRPL] Found matching escrow object:', {
          PreviousTxnID: (escrowObject as any).PreviousTxnID,
          ObjectSequence: (escrowObject as any).Sequence,
          TransactionSequence: escrowSequence,
          Destination: (escrowObject as any).Destination,
          Amount: (escrowObject as any).Amount,
        });

        // CRITICAL VALIDATION: Verify the sequence matches the EscrowCreate transaction
        // Double-check by looking up the transaction again to ensure we have the correct sequence
        let verifiedSequence = escrowSequence;
        try {
          const verifyTxResponse = await (client as any).request({
            command: 'tx',
            transaction: txHash,
          });

          if (verifyTxResponse.result) {
            const verifyTxResult = verifyTxResponse.result as any;
            const txSequence = 
              verifyTxResult.tx_json?.Sequence || 
              verifyTxResult.Sequence || 
              verifyTxResult.tx?.Sequence ||
              null;

            if (txSequence !== null) {
              if (txSequence !== escrowSequence) {
                console.error('[XRPL] Sequence mismatch detected:', {
                  extractedSequence: escrowSequence,
                  verifiedTxSequence: txSequence,
                  objectSequence: (escrowObject as any).Sequence,
                });
                // Use the verified transaction sequence
                verifiedSequence = txSequence;
                console.warn('[XRPL] Using verified transaction sequence:', verifiedSequence);
              } else {
                console.log('[XRPL] Sequence verified: matches EscrowCreate transaction');
              }
            }
          }
        } catch (verifyError) {
          console.warn('[XRPL] Could not verify sequence from transaction, using extracted sequence:', verifyError);
        }

        // Extract amount from escrow object (it's in drops)
        const escrowAmountDrops = (escrowObject as any).Amount;
        // dropsToXrp expects a string, ensure it's always a string
        const amountDropsStr: string = escrowAmountDrops ? String(escrowAmountDrops) : '0';
        const escrowAmountXrp = parseFloat((dropsToXrp as any)(amountDropsStr));

        // IMPORTANT: For EscrowFinish, OfferSequence must match the Sequence from the original EscrowCreate transaction
        // This is the account sequence number from the EscrowCreate transaction, NOT the escrow object sequence
        // The escrow object has its own sequence, but EscrowFinish requires the transaction sequence

        console.log('[XRPL] Returning escrow details with verified sequence:', {
          sequence: verifiedSequence,
          objectSequence: (escrowObject as any).Sequence,
          originalExtractedSequence: escrowSequence,
          sequenceSource: verifiedSequence === escrowSequence ? 'original' : 'verified',
        });

        return {
          sequence: verifiedSequence, // Use verified transaction sequence (account sequence from EscrowCreate), not escrow object sequence
          amount: escrowAmountXrp, // Use amount from escrow object (more reliable than transaction amount)
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
   * Get detailed escrow status from XRPL by transaction hash
   * Returns comprehensive status including whether it's active, finished, or cancelled
   */
  async getEscrowStatus(txHash: string, ownerAddress: string): Promise<{
    exists: boolean;
    status: 'active' | 'finished' | 'cancelled' | 'unknown';
    sequence?: number;
    amount?: number;
    destination?: string;
    finishAfter?: number;
    cancelAfter?: number;
    condition?: string;
    finishTxHash?: string;
    cancelTxHash?: string;
    finishedAt?: number; // Unix timestamp
    cancelledAt?: number; // Unix timestamp
    canFinish: boolean;
    canCancel: boolean;
    error?: string;
  }> {
    try {
      const client = new Client(this.XRPL_SERVER);
      await client.connect();

      try {
        // First, try to get the transaction to get the sequence
        let txResponse: any;
        let txSequence: number | null = null;
        
        try {
          txResponse = await (client as any).request({
            command: 'tx',
            transaction: txHash,
          });
          
          if (txResponse.result) {
            txSequence = (txResponse.result as any).Sequence as number;
          }
        } catch (txError) {
          await client.disconnect();
          return {
            exists: false,
            status: 'unknown',
            canFinish: false,
            canCancel: false,
            error: 'Transaction not found on XRPL',
          };
        }

        // Check if escrow object exists
        const accountObjectsResponse = await (client as any).request({
          command: 'account_objects',
          account: ownerAddress,
          type: 'escrow',
        });

        const escrowObjects = accountObjectsResponse.result.account_objects || [];
        const escrowObject = escrowObjects.find(
          (obj: any) => (obj as any).PreviousTxnID === txHash
        ) as any;

        // If escrow object exists, it's still active
        if (escrowObject) {
          const escrowAmount = (escrowObject as any).Amount;
          const amountDropsStr: string = escrowAmount ? String(escrowAmount) : '0';
          const amount = parseFloat((dropsToXrp as any)(amountDropsStr));
          
          const finishAfter = (escrowObject as any).FinishAfter ? ((escrowObject as any).FinishAfter as number) : undefined;
          const cancelAfter = (escrowObject as any).CancelAfter ? ((escrowObject as any).CancelAfter as number) : undefined;
          const now = Math.floor(Date.now() / 1000);
          
          const canFinish = !finishAfter || finishAfter <= now;
          const canCancel = cancelAfter ? cancelAfter <= now : false;

          await client.disconnect();

          return {
            exists: true,
            status: 'active',
            sequence: txSequence || undefined,
            amount,
            destination: (escrowObject as any).Destination || undefined,
            finishAfter,
            cancelAfter,
            condition: (escrowObject as any).Condition || undefined,
            canFinish,
            canCancel,
          };
        }

        // Escrow object doesn't exist - check transaction history
        if (txSequence) {
          const accountTxResponse = await (client as any).request({
            command: 'account_tx',
            account: ownerAddress,
            ledger_index_min: -1,
            ledger_index_max: -1,
            limit: 200,
          });

          const transactions = accountTxResponse.result.transactions || [];
          
          // Find EscrowFinish or EscrowCancel transactions for this escrow
          const finishTx = transactions.find((txData: any) => {
            const tx = txData.tx || txData;
            return (tx as any).TransactionType === 'EscrowFinish' &&
                   (tx as any).Owner === ownerAddress &&
                   (tx as any).OfferSequence === txSequence;
          });

          const cancelTx = transactions.find((txData: any) => {
            const tx = txData.tx || txData;
            return (tx as any).TransactionType === 'EscrowCancel' &&
                   (tx as any).Owner === ownerAddress &&
                   (tx as any).OfferSequence === txSequence;
          });

          await client.disconnect();

          if (finishTx) {
            const txData = finishTx as any;
            const tx = txData.tx || txData;
            // Try to get the date from the transaction metadata
            const date = txData.date || (txData.meta && txData.meta.date) || undefined;
            
            return {
              exists: false,
              status: 'finished',
              sequence: txSequence,
              finishTxHash: (tx as any).hash || txData.hash || undefined,
              finishedAt: date,
              canFinish: false,
              canCancel: false,
            };
          }

          if (cancelTx) {
            const txData = cancelTx as any;
            const tx = txData.tx || txData;
            // Try to get the date from the transaction metadata
            const date = txData.date || (txData.meta && txData.meta.date) || undefined;
            
            return {
              exists: false,
              status: 'cancelled',
              sequence: txSequence,
              cancelTxHash: (tx as any).hash || txData.hash || undefined,
              cancelledAt: date,
              canFinish: false,
              canCancel: false,
            };
          }
        }

        await client.disconnect();

        return {
          exists: false,
          status: 'unknown',
          sequence: txSequence || undefined,
          canFinish: false,
          canCancel: false,
          error: 'Escrow object not found, but no finish/cancel transaction found in recent history',
        };
      } catch (error) {
        await client.disconnect();
        throw error;
      }
    } catch (error) {
      console.error('[XRPL] Error getting escrow status:', error);
      return {
        exists: false,
        status: 'unknown',
        canFinish: false,
        canCancel: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
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
        const response = await (client as any).request({
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






