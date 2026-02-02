/**
 * Diagnostic script to check escrow state on XRPL
 * Usage: node check-escrow.js <ownerAddress> <sequence>
 */

const { Client } = require('xrpl');

const XRPL_NETWORK = process.env.XRPL_NETWORK || 'testnet';
const XRPL_SERVER = XRPL_NETWORK === 'mainnet'
  ? 'wss://xrplcluster.com'
  : 'wss://s.altnet.rippletest.net:51233';

async function checkEscrow(ownerAddress, sequence) {
  const client = new Client(XRPL_SERVER);
  
  try {
    await client.connect();
    console.log(`\n[Checking Escrow] Owner: ${ownerAddress}, Sequence: ${sequence}\n`);
    
    // 1. Check account_objects for escrow
    console.log('1. Checking account_objects for escrow...');
    const accountObjectsResponse = await client.request({
      command: 'account_objects',
      account: ownerAddress,
      type: 'escrow',
      ledger_index: 'validated',
    });
    
    const escrows = accountObjectsResponse.result.account_objects || [];
    console.log(`   Found ${escrows.length} escrow(s) for this account`);
    
    // Find escrow by sequence (object sequence, not transaction sequence)
    const escrowByObjectSequence = escrows.find(e => e.Sequence === sequence);
    if (escrowByObjectSequence) {
      console.log('   ✓ Found escrow by object sequence:', {
        Sequence: escrowByObjectSequence.Sequence,
        PreviousTxnID: escrowByObjectSequence.PreviousTxnID,
        Destination: escrowByObjectSequence.Destination,
        Amount: escrowByObjectSequence.Amount,
        FinishAfter: escrowByObjectSequence.FinishAfter,
        CancelAfter: escrowByObjectSequence.CancelAfter,
      });
    } else {
      console.log('   ✗ No escrow found with object sequence:', sequence);
      console.log('   Available object sequences:', escrows.map(e => e.Sequence));
    }
    
    // 2. Check account_tx for EscrowFinish/EscrowCancel
    console.log('\n2. Checking transaction history for EscrowFinish/EscrowCancel...');
    const accountTxResponse = await client.request({
      command: 'account_tx',
      account: ownerAddress,
      ledger_index_min: -1,
      ledger_index_max: -1,
      limit: 100,
    });
    
    const transactions = accountTxResponse.result.transactions || [];
    const finishTxs = transactions.filter(txData => {
      const tx = txData.tx || txData;
      return tx.TransactionType === 'EscrowFinish' && 
             tx.Owner === ownerAddress && 
             tx.OfferSequence === sequence;
    });
    
    const cancelTxs = transactions.filter(txData => {
      const tx = txData.tx || txData;
      return tx.TransactionType === 'EscrowCancel' && 
             tx.Owner === ownerAddress && 
             tx.OfferSequence === sequence;
    });
    
    if (finishTxs.length > 0) {
      console.log(`   ✗ Escrow was already FINISHED ${finishTxs.length} time(s)`);
      finishTxs.forEach((txData, i) => {
        const tx = txData.tx || txData;
        console.log(`   Finish TX ${i + 1}:`, {
          hash: tx.hash,
          Account: tx.Account,
          Owner: tx.Owner,
          OfferSequence: tx.OfferSequence,
        });
      });
    } else if (cancelTxs.length > 0) {
      console.log(`   ✗ Escrow was already CANCELLED ${cancelTxs.length} time(s)`);
    } else {
      console.log('   ✓ No EscrowFinish or EscrowCancel found for this sequence');
    }
    
    // 3. Check if we can find the EscrowCreate transaction
    console.log('\n3. Checking for EscrowCreate transactions...');
    const createTxs = transactions.filter(txData => {
      const tx = txData.tx || txData;
      return tx.TransactionType === 'EscrowCreate' && 
             tx.Account === ownerAddress &&
             tx.Sequence === sequence;
    });
    
    if (createTxs.length > 0) {
      console.log(`   ✓ Found EscrowCreate transaction with sequence ${sequence}`);
      createTxs.forEach((txData, i) => {
        const tx = txData.tx || txData;
        console.log(`   Create TX ${i + 1}:`, {
          hash: tx.hash,
          Account: tx.Account,
          Sequence: tx.Sequence,
          Destination: tx.Destination,
          Amount: tx.Amount,
          FinishAfter: tx.FinishAfter,
        });
      });
    } else {
      console.log(`   ✗ No EscrowCreate found with sequence ${sequence}`);
      console.log('   Note: EscrowFinish uses OfferSequence = EscrowCreate.Sequence');
    }
    
    // 4. Check current ledger time vs FinishAfter
    if (escrowByObjectSequence && escrowByObjectSequence.FinishAfter) {
      console.log('\n4. Checking FinishAfter time...');
      const ledgerResponse = await client.request({
        command: 'ledger',
        ledger_index: 'validated',
      });
      
      const currentLedgerTime = ledgerResponse.result.ledger.close_time;
      const finishAfter = escrowByObjectSequence.FinishAfter;
      const finishAfterPassed = currentLedgerTime >= finishAfter;
      
      console.log('   Current ledger time:', currentLedgerTime);
      console.log('   FinishAfter:', finishAfter);
      console.log('   FinishAfter date:', new Date((finishAfter + 946684800) * 1000).toISOString());
      console.log('   Current date:', new Date((currentLedgerTime + 946684800) * 1000).toISOString());
      console.log('   FinishAfter passed:', finishAfterPassed);
      
      if (!finishAfterPassed) {
        console.log('   ⚠️  WARNING: FinishAfter has not been reached yet!');
        console.log('   Only the Destination can finish before FinishAfter.');
        console.log('   Owner can only finish after FinishAfter has passed.');
      }
    }
    
    await client.disconnect();
    
    console.log('\n[Summary]');
    if (finishTxs.length > 0) {
      console.log('   Status: ALREADY FINISHED');
    } else if (cancelTxs.length > 0) {
      console.log('   Status: ALREADY CANCELLED');
    } else if (!escrowByObjectSequence) {
      console.log('   Status: ESCROW NOT FOUND (may have wrong sequence)');
    } else if (escrowByObjectSequence.FinishAfter && !finishAfterPassed) {
      console.log('   Status: ACTIVE (but FinishAfter not reached - only Destination can finish)');
    } else {
      console.log('   Status: ACTIVE (can be finished)');
    }
    
  } catch (error) {
    console.error('Error:', error);
    await client.disconnect();
  }
}

// Get arguments
const ownerAddress = process.argv[2];
const sequence = parseInt(process.argv[3]);

if (!ownerAddress || !sequence) {
  console.log('Usage: node check-escrow.js <ownerAddress> <sequence>');
  console.log('Example: node check-escrow.js rpMFduUVi93VzZM7gxB3DT9ixHqX7VtQW5 14036786');
  process.exit(1);
}

checkEscrow(ownerAddress, sequence).catch(console.error);
