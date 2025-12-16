/**
 * XRPL Wallet Service
 * Handles XRPL blockchain operations for wallets
 */

import { Client, Wallet, xrpToDrops, dropsToXrp, Payment } from 'xrpl';
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

  /**
   * Get issuer address for a given network
   */
  private getIssuerForNetwork(network: 'testnet' | 'mainnet', token: 'USDT' | 'USDC'): string {
    if (token === 'USDT') {
      return network === 'mainnet'
        ? 'rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B' // Tether (USDT) on mainnet
        : 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY'; // Testnet issuer
    } else {
      return network === 'mainnet'
        ? 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY' // Circle (USDC) on mainnet
        : 'rPEPPER7kfTD9w2To4CQk6UCfuHM9c6GDY'; // Testnet issuer
    }
  }

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
   * Generate a new XRPL wallet (address + secret)
   * Returns both address and secret for storage
   */
  async generateWallet(): Promise<{
    address: string;
    secret: string;
  }> {
    try {
      const wallet = Wallet.generate();
      // The wallet object has a seed property that contains the secret
      // We need to access it properly - Wallet.generate() returns a Wallet object
      // The seed is the secret that can be used with Wallet.fromSeed()
      const secret = wallet.seed || wallet.classicAddress || '';
      
      if (!secret) {
        throw new Error('Failed to extract wallet secret');
      }
      
      return {
        address: wallet.address,
        secret: secret,
      };
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
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-wallet.service.ts:73',message:'getBalance: Entry',data:{xrplAddress},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      // Log network and address for debugging funded account issues
      console.log('[DEBUG] getBalance: Querying XRPL', {
        network: this.XRPL_NETWORK,
        server: this.XRPL_SERVER,
        address: xrplAddress,
        note: 'If user funded but account not found, check network mismatch (testnet vs mainnet)',
      });
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
        const balance = dropsToXrp(dropsStr);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-wallet.service.ts:93',message:'getBalance: Success',data:{xrplAddress,balance},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        return balance;
      } catch (error) {
        await client.disconnect();
        // #region agent log
        const errorData = error instanceof Error ? {message:error.message,stack:error.stack} : {error:String(error)};
        const errorObj = error as any;
        const errorDetails = {errorData,hasData:!!errorObj?.data,dataError:errorObj?.data?.error,dataErrorCode:errorObj?.data?.error_code,dataErrorMessage:errorObj?.data?.error_message};
        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-wallet.service.ts:96',message:'getBalance: Inner catch',data:{xrplAddress,errorDetails},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        // If account doesn't exist, return 0
        const isAccountNotFound = (error instanceof Error && (error.message.includes('actNotFound') || error.message.includes('Account not found'))) || 
          (error as any)?.data?.error === 'actNotFound' || 
          ((error as any)?.data?.error_message === 'accountNotFound' || (error as any)?.data?.error_message === 'Account not found.') ||
          (error as any)?.data?.error_code === 19;
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-wallet.service.ts:103',message:'getBalance: Checking accountNotFound',data:{xrplAddress,isAccountNotFound},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        if (isAccountNotFound) {
          // Account doesn't exist yet - check the other network in case of mismatch
          const otherNetwork = this.XRPL_NETWORK === 'mainnet' ? 'testnet' : 'mainnet';
          const otherServer = otherNetwork === 'mainnet' 
            ? 'wss://xrplcluster.com'
            : 'wss://s.altnet.rippletest.net:51233';
          
          console.log('[WARNING] Account not found on configured network, checking other network', {
            configuredNetwork: this.XRPL_NETWORK,
            checkingNetwork: otherNetwork,
            address: xrplAddress,
          });
          
          // Try the other network
          try {
            const otherClient = new Client(otherServer);
            await otherClient.connect();
            try {
              const otherAccountInfo = await otherClient.request({
                command: 'account_info',
                account: xrplAddress,
                ledger_index: 'validated',
              });
              await otherClient.disconnect();
              
              const otherBalanceDrops = otherAccountInfo.result.account_data.Balance;
              const otherBalance = dropsToXrp(String(otherBalanceDrops));
              
              console.log('[CRITICAL] Network mismatch detected!', {
                address: xrplAddress,
                configuredNetwork: this.XRPL_NETWORK,
                actualNetwork: otherNetwork,
                balance: otherBalance,
                action: `Set XRPL_NETWORK=${otherNetwork} in environment variables to fix this permanently`,
                note: 'Returning balance from correct network, but please update environment variable',
              });
              
              // Return the balance from the correct network so user sees their funds
              // But log the mismatch so it can be fixed
              return otherBalance;
            } catch (otherError) {
              await otherClient.disconnect();
              // Account not found on either network
              console.log('[INFO] Account not found on either network', {
                address: xrplAddress,
                testnet: this.XRPL_NETWORK === 'testnet' ? 'not found' : 'not checked',
                mainnet: this.XRPL_NETWORK === 'mainnet' ? 'not found' : 'not found',
                note: 'This is expected for new wallets that haven\'t been funded yet',
              });
            }
          } catch (checkError) {
            console.log('[DEBUG] Could not check other network', {
              address: xrplAddress,
              error: checkError instanceof Error ? checkError.message : String(checkError),
            });
          }
          
          // Account doesn't exist yet - this is expected for new wallets, return 0 silently
          return 0;
        }
        // Log error details for Render debugging only for unexpected errors
        console.log('[DEBUG] getBalance inner catch (unexpected error):', {
          xrplAddress,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorData: errorObj?.data,
        });
        throw error;
      }
    } catch (error) {
      // #region agent log
      const errorData = error instanceof Error ? {message:error.message,stack:error.stack} : {error:String(error)};
      const errorObj = error as any;
      const errorDetails = {errorData,hasData:!!errorObj?.data,dataError:errorObj?.data?.error,dataErrorCode:errorObj?.data?.error_code,dataErrorMessage:errorObj?.data?.error_message};
      const isAccountNotFound = (error instanceof Error && error.message.includes('actNotFound')) || 
        errorObj?.data?.error === 'actNotFound' || 
        errorObj?.data?.error_message === 'accountNotFound' ||
        errorObj?.data?.error_code === 19;
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-wallet.service.ts:110',message:'getBalance: Outer catch',data:{xrplAddress,errorDetails,isAccountNotFound},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      // Only log if it's not an expected account not found error
      if (!isAccountNotFound) {
        console.error('Error getting XRPL balance:', error);
        console.log('[DEBUG] getBalance outer catch (unexpected error):', {
          xrplAddress,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorData: errorObj?.data,
        });
      }
      // Account not found errors are expected for new wallets - suppress logging
      // Fallback to 0 if there's an error
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
    currency: 'XRP' | 'USDT' | 'USDC'
  ): Promise<{
    transaction: any;
    transactionBlob: string;
    instructions: string;
  }> {
    try {
      let paymentTx: Payment | any;

      if (currency === 'XRP') {
        // XRP Payment
        paymentTx = {
          TransactionType: 'Payment',
          Destination: destinationAddress,
          Amount: xrpToDrops(amount.toString()),
        };
      } else {
        // Token Payment (USDT or USDC)
        const issuer = currency === 'USDT' ? this.USDT_ISSUER : this.USDC_ISSUER;
        paymentTx = {
          TransactionType: 'Payment',
          Destination: destinationAddress,
          Amount: {
            currency: 'USD', // XRPL uses 'USD' for both USDT and USDC
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

        // Submit the signed transaction
        const result = await client.submitAndWait(txToSubmit);

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
    fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-wallet.service.ts:376',message:'createWithdrawalTransaction: Entry',data:{fromAddress,toAddress,amountXrp,hasSecret:!!walletSecret,network:this.XRPL_NETWORK},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    if (!walletSecret) {
      throw new Error('Wallet secret required for withdrawal');
    }

    const client = new Client(this.XRPL_SERVER);
    
    try {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-wallet.service.ts:389',message:'createWithdrawalTransaction: Connecting to XRPL',data:{server:this.XRPL_SERVER,network:this.XRPL_NETWORK},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      await client.connect();
      const wallet = Wallet.fromSeed(walletSecret);
      
      const payment: any = {
        TransactionType: 'Payment',
        Account: fromAddress,
        Destination: toAddress,
        Amount: xrpToDrops(amountXrp.toString()),
      };

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-wallet.service.ts:399',message:'createWithdrawalTransaction: Preparing transaction',data:{fromAddress,toAddress,amountXrp},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      const prepared = await client.autofill(payment);
      const signed = wallet.sign(prepared);
      
      // Validate that destination is different from source
      if (fromAddress === toAddress) {
        throw new Error('Cannot withdraw to the same address. Please provide a different destination address.');
      }

      // #region agent log
      console.log('[DEBUG] createWithdrawalTransaction: Submitting to XRPL', {fromAddress,toAddress,amountXrp});
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-wallet.service.ts:402',message:'createWithdrawalTransaction: Submitting to XRPL',data:{fromAddress,toAddress,amountXrp},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      // Submit transaction and wait for validation (with timeout)
      let result: any;
      try {
        result = await Promise.race([
          client.submitAndWait(signed.tx_blob),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Transaction submission timeout after 30 seconds')), 30000)
          )
        ]) as any;
      } catch (submitError) {
        // #region agent log
        const errorDetails = submitError instanceof Error ? {message:submitError.message,stack:submitError.stack} : {error:String(submitError)};
        const errorObj = submitError as any;
        const fullErrorDetails = {
          ...errorDetails,
          hasData: !!errorObj?.data,
          dataError: errorObj?.data?.error,
          dataErrorCode: errorObj?.data?.error_code,
          dataErrorMessage: errorObj?.data?.error_message,
          dataResult: errorObj?.result,
          dataResultCode: errorObj?.result?.engine_result_code,
          dataResultMessage: errorObj?.result?.engine_result_message,
        };
        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-wallet.service.ts:430',message:'createWithdrawalTransaction: submitAndWait error',data:{fromAddress,toAddress,amountXrp,fullErrorDetails},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        console.error('[ERROR] createWithdrawalTransaction: submitAndWait failed', {
          fromAddress,
          toAddress,
          amountXrp,
          error: submitError instanceof Error ? submitError.message : String(submitError),
          errorDetails: fullErrorDetails,
        });
        throw submitError;
      }

      // #region agent log
      console.log('[DEBUG] createWithdrawalTransaction: Got result from XRPL', {hasResult:!!result,hasHash:!!result?.result?.hash,txResult:result?.result?.meta?.TransactionResult});
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-wallet.service.ts:410',message:'createWithdrawalTransaction: Got result from XRPL',data:{hasResult:!!result,hasHash:!!result?.result?.hash,txResult:result?.result?.meta?.TransactionResult},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      // Check transaction result
      const txResult = typeof result.result.meta === 'object' && result.result.meta !== null
        ? (result.result.meta as any).TransactionResult
        : null;
      
      if (txResult !== 'tesSUCCESS') {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-wallet.service.ts:415',message:'createWithdrawalTransaction: Transaction failed on XRPL',data:{txResult,fromAddress,toAddress,amountXrp},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        
        // Provide user-friendly error messages for common XRPL errors
        let errorMessage = `Transaction failed on XRPL: ${txResult}`;
        if (txResult === 'tecUNFUNDED_PAYMENT') {
          errorMessage = `Insufficient funds. Your account must maintain a 1 XRP reserve, plus transaction fees. The withdrawal amount exceeds your available balance.`;
        } else if (txResult === 'tecNO_DST') {
          errorMessage = `Destination account does not exist. Please check the destination address.`;
        } else if (txResult === 'tecDST_TAG_NEEDED') {
          errorMessage = `Destination tag required for this address. Please include a destination tag.`;
        } else if (txResult === 'tecPATH_DRY') {
          errorMessage = `No payment path found. Unable to process this payment.`;
        } else if (txResult === 'tecPATH_PARTIAL') {
          errorMessage = `Partial payment path found. Unable to complete the full payment amount.`;
        }
        
        throw new Error(errorMessage);
      }

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-wallet.service.ts:419',message:'createWithdrawalTransaction: Success, returning hash',data:{hash:result.result.hash},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      return result.result.hash;
    } catch (error) {
      // #region agent log
      console.log('[DEBUG] createWithdrawalTransaction: Error caught', {error:error instanceof Error ? error.message : String(error),fromAddress,toAddress,amountXrp});
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-wallet.service.ts:420',message:'createWithdrawalTransaction: Error caught',data:{error:error instanceof Error ? error.message : String(error),fromAddress,toAddress,amountXrp},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      console.error('Error creating withdrawal transaction:', {
        error: error instanceof Error ? error.message : String(error),
        fromAddress,
        toAddress,
        amountXrp,
      });
      // Re-throw error instead of returning placeholder
      throw error;
    } finally {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-wallet.service.ts:430',message:'createWithdrawalTransaction: Disconnecting client',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
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
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-wallet.service.ts:345',message:'getTokenBalance: Entry',data:{xrplAddress,currency,issuer},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      // Log network and address for debugging funded account issues
      console.log('[DEBUG] getTokenBalance: Querying XRPL', {
        network: this.XRPL_NETWORK,
        server: this.XRPL_SERVER,
        address: xrplAddress,
        currency,
        issuer,
        note: 'If user funded but account not found, check network mismatch (testnet vs mainnet)',
      });
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
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-wallet.service.ts:365',message:'getTokenBalance: No trust line found on configured network',data:{xrplAddress,currency,issuer,linesCount:lines.length,network:this.XRPL_NETWORK},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          
          // Account exists but no trust line found - might be network mismatch
          // Check other network if we suspect mismatch (only for USD tokens)
          if (currency === 'USD' && (issuer === this.USDT_ISSUER || issuer === this.USDC_ISSUER)) {
            const otherNetwork = this.XRPL_NETWORK === 'mainnet' ? 'testnet' : 'mainnet';
            const otherServer = otherNetwork === 'mainnet' 
              ? 'wss://xrplcluster.com'
              : 'wss://s.altnet.rippletest.net:51233';
            
            // Determine the correct issuer for the other network
            const isUSDT = issuer === this.USDT_ISSUER;
            const otherIssuer = isUSDT 
              ? this.getIssuerForNetwork(otherNetwork, 'USDT')
              : this.getIssuerForNetwork(otherNetwork, 'USDC');
            
            console.log('[WARNING] No trust line found on configured network, checking other network for potential mismatch', {
              configuredNetwork: this.XRPL_NETWORK,
              checkingNetwork: otherNetwork,
              address: xrplAddress,
              currency,
              configuredIssuer: issuer,
              otherNetworkIssuer: otherIssuer,
            });
            
            try {
              const otherClient = new Client(otherServer);
              await otherClient.connect();
              try {
                // Check if account exists on other network
                await otherClient.request({
                  command: 'account_info',
                  account: xrplAddress,
                  ledger_index: 'validated',
                });
                
                // Account exists on other network - check token balance
                const otherAccountLines = await otherClient.request({
                  command: 'account_lines',
                  account: xrplAddress,
                  ledger_index: 'validated',
                });
                
                await otherClient.disconnect();
                
                const otherLines = otherAccountLines.result.lines || [];
                const otherTrustLine = otherLines.find((line: any) => 
                  line.currency === currency && line.account === otherIssuer
                );
                
                if (otherTrustLine) {
                  const otherBalance = Math.max(0, parseFloat(otherTrustLine.balance || '0'));
                  
                  console.log('[CRITICAL] Network mismatch detected (token balance)! Account exists on both networks, using other network balance', {
                    address: xrplAddress,
                    currency,
                    configuredIssuer: issuer,
                    actualIssuer: otherIssuer,
                    configuredNetwork: this.XRPL_NETWORK,
                    actualNetwork: otherNetwork,
                    balance: otherBalance,
                    action: `Set XRPL_NETWORK=${otherNetwork} in environment variables to fix this permanently`,
                    note: 'Account exists on both networks, but token balance found on other network',
                  });
                  
                  return otherBalance;
                }
              } catch (otherError) {
                await otherClient.disconnect();
                // Continue and return 0 if other network check fails
              }
            } catch (checkError) {
              // Continue and return 0 if check fails
            }
          }
          
          // No trust line found, return 0
          return 0;
        }

        // Balance is returned as a string, convert to number
        // Negative balance means the account owes tokens (shouldn't happen for user wallets)
        const balance = parseFloat(trustLine.balance || '0');
        const finalBalance = Math.max(0, balance); // Return 0 if negative
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-wallet.service.ts:372',message:'getTokenBalance: Success',data:{xrplAddress,currency,issuer,finalBalance},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        return finalBalance;
      } catch (error) {
        await client.disconnect();
        // #region agent log
        const errorData = error instanceof Error ? {message:error.message,stack:error.stack} : {error:String(error)};
        const errorObj = error as any;
        const errorDetails = {errorData,hasData:!!errorObj?.data,dataError:errorObj?.data?.error,dataErrorCode:errorObj?.data?.error_code,dataErrorMessage:errorObj?.data?.error_message};
        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-wallet.service.ts:376',message:'getTokenBalance: Inner catch',data:{xrplAddress,currency,issuer,errorDetails},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        // If account doesn't exist, return 0
        const isAccountNotFound = (error instanceof Error && (error.message.includes('actNotFound') || error.message.includes('Account not found') || error.message.includes('accountNotFound'))) || 
          (error as any)?.data?.error === 'actNotFound' || 
          ((error as any)?.data?.error_message === 'accountNotFound' || (error as any)?.data?.error_message === 'Account not found.') ||
          (error as any)?.data?.error_code === 19;
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-wallet.service.ts:382',message:'getTokenBalance: Checking accountNotFound',data:{xrplAddress,currency,issuer,isAccountNotFound},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        if (isAccountNotFound) {
          // Account doesn't exist yet - check the other network in case of mismatch
          const otherNetwork = this.XRPL_NETWORK === 'mainnet' ? 'testnet' : 'mainnet';
          const otherServer = otherNetwork === 'mainnet' 
            ? 'wss://xrplcluster.com'
            : 'wss://s.altnet.rippletest.net:51233';
          
          // Determine the correct issuer for the other network
          // If we're checking for USD currency, determine if it's USDT or USDC based on the issuer
          let otherIssuer = issuer;
          if (currency === 'USD') {
            // Determine token type from issuer address
            const isUSDT = issuer === this.USDT_ISSUER;
            const isUSDC = issuer === this.USDC_ISSUER;
            if (isUSDT || isUSDC) {
              // Get the correct issuer for the other network
              otherIssuer = isUSDT 
                ? this.getIssuerForNetwork(otherNetwork, 'USDT')
                : this.getIssuerForNetwork(otherNetwork, 'USDC');
            }
          }
          
          console.log('[WARNING] Account not found on configured network (token balance), checking other network', {
            configuredNetwork: this.XRPL_NETWORK,
            checkingNetwork: otherNetwork,
            address: xrplAddress,
            currency,
            configuredIssuer: issuer,
            otherNetworkIssuer: otherIssuer,
          });
          
          // Try the other network
          try {
            const otherClient = new Client(otherServer);
            await otherClient.connect();
            try {
              // First check if account exists on other network
              await otherClient.request({
                command: 'account_info',
                account: xrplAddress,
                ledger_index: 'validated',
              });
              
              // Account exists, now check token balance
              const otherAccountLines = await otherClient.request({
                command: 'account_lines',
                account: xrplAddress,
                ledger_index: 'validated',
              });
              
              await otherClient.disconnect();
              
              // Find the trust line for this currency and issuer (using correct issuer for other network)
              const lines = otherAccountLines.result.lines || [];
              const trustLine = lines.find((line: any) => 
                line.currency === currency && line.account === otherIssuer
              );
              
              const otherBalance = trustLine ? Math.max(0, parseFloat(trustLine.balance || '0')) : 0;
              
              console.log('[CRITICAL] Network mismatch detected (token balance)!', {
                address: xrplAddress,
                currency,
                configuredIssuer: issuer,
                actualIssuer: otherIssuer,
                configuredNetwork: this.XRPL_NETWORK,
                actualNetwork: otherNetwork,
                balance: otherBalance,
                hasTrustLine: !!trustLine,
                action: `Set XRPL_NETWORK=${otherNetwork} in environment variables to fix this permanently`,
                note: 'Returning balance from correct network, but please update environment variable',
              });
              
              // Return the balance from the correct network
              return otherBalance;
            } catch (otherError) {
              await otherClient.disconnect();
              // Account not found on either network or no token balance
              const isOtherAccountNotFound = (otherError instanceof Error && (otherError.message.includes('actNotFound') || otherError.message.includes('Account not found'))) || 
                (otherError as any)?.data?.error === 'actNotFound' || 
                ((otherError as any)?.data?.error_message === 'accountNotFound' || (otherError as any)?.data?.error_message === 'Account not found.') ||
                (otherError as any)?.data?.error_code === 19;
              
              console.log('[INFO] Account check on other network', {
                address: xrplAddress,
                currency,
                issuer,
                otherNetwork,
                accountNotFound: isOtherAccountNotFound,
                error: otherError instanceof Error ? otherError.message : String(otherError),
                note: isOtherAccountNotFound 
                  ? 'Account not found on either network' 
                  : 'Account found but no trust line or other error',
              });
            }
          } catch (checkError) {
            console.log('[DEBUG] Could not check other network (token balance)', {
              address: xrplAddress,
              currency,
              issuer,
              error: checkError instanceof Error ? checkError.message : String(checkError),
            });
          }
          
          // Account doesn't exist yet - this is expected for new wallets, return 0 silently
          return 0;
        }
        // Log error details for Render debugging only for unexpected errors
        console.log('[DEBUG] getTokenBalance inner catch (unexpected error):', {
          xrplAddress,
          currency,
          issuer,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorData: errorObj?.data,
        });
        throw error;
      }
    } catch (error) {
      // #region agent log
      const errorData = error instanceof Error ? {message:error.message,stack:error.stack} : {error:String(error)};
      const errorObj = error as any;
      const errorDetails = {errorData,hasData:!!errorObj?.data,dataError:errorObj?.data?.error,dataErrorCode:errorObj?.data?.error_code,dataErrorMessage:errorObj?.data?.error_message};
      const isAccountNotFound = (error instanceof Error && error.message.includes('actNotFound')) || 
        errorObj?.data?.error === 'actNotFound' || 
        errorObj?.data?.error_message === 'accountNotFound' ||
        errorObj?.data?.error_code === 19;
      fetch('http://127.0.0.1:7243/ingest/5849700e-dd46-4089-94c8-9789cbf9aa00',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'xrpl-wallet.service.ts:390',message:'getTokenBalance: Outer catch',data:{xrplAddress,currency,issuer,errorDetails,isAccountNotFound},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      // Only log if it's not an expected account not found error
      if (!isAccountNotFound) {
        console.error(`Error getting ${currency} balance:`, error);
        console.log('[DEBUG] getTokenBalance outer catch (unexpected error):', {
          xrplAddress,
          currency,
          issuer,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorData: errorObj?.data,
        });
      }
      // Account not found errors are expected for new wallets - suppress logging
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
        this.getBalance(xrplAddress).catch(err => {
          console.error('[XRPL] Error getting XRP balance:', err);
          return 0; // Return 0 for individual failures, but continue
        }),
        this.getUSDTBalance(xrplAddress).catch(err => {
          console.error('[XRPL] Error getting USDT balance:', err);
          return 0;
        }),
        this.getUSDCBalance(xrplAddress).catch(err => {
          console.error('[XRPL] Error getting USDC balance:', err);
          return 0;
        }),
      ]);

      console.log('[XRPL] getAllBalances result:', {
        xrplAddress,
        xrp,
        usdt,
        usdc,
        network: this.XRPL_NETWORK,
      });

      return {
        xrp,
        usdt,
        usdc,
      };
    } catch (error) {
      console.error('[XRPL] Critical error getting all balances:', {
        error: error instanceof Error ? error.message : String(error),
        xrplAddress,
        network: this.XRPL_NETWORK,
      });
      // Still return zeros but log the error for debugging
      return {
        xrp: 0,
        usdt: 0,
        usdc: 0,
      };
    }
  }
}

export const xrplWalletService = new XRPLWalletService();


