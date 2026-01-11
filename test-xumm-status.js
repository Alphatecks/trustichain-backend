/**
 * Test script to check XUMM deposit status
 * This simulates checking the status of XUMM deposits without needing Xaman app
 * 
 * Usage:
 * 1. Make sure your backend is running
 * 2. Set AUTH_TOKEN and optionally TRANSACTION_ID
 * 3. Run: node test-xumm-status.js
 */

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'YOUR_AUTH_TOKEN_HERE';
const TRANSACTION_ID = process.env.TRANSACTION_ID || null;

async function testXUMMStatus() {
  console.log('🔍 Testing XUMM Deposit Status Detection\n');
  console.log(`API URL: ${BASE_URL}`);
  console.log(`Auth Token: ${AUTH_TOKEN.substring(0, 20)}...\n`);

  try {
    // Step 1: Get user's transactions to find pending XUMM deposits
    console.log('📋 Step 1: Fetching user transactions...');
    const transactionsRes = await fetch(`${BASE_URL}/api/wallet/transactions`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!transactionsRes.ok) {
      throw new Error(`Failed to fetch transactions: ${transactionsRes.status} ${transactionsRes.statusText}`);
    }

    const transactionsData = await transactionsRes.json();
    console.log(`✅ Found ${transactionsData.data?.transactions?.length || 0} transactions\n`);

    // Find pending XUMM deposits
    const pendingXUMMDeposits = (transactionsData.data?.transactions || []).filter(tx => 
      tx.type === 'deposit' && 
      tx.status === 'pending' && 
      tx.description?.includes('XUMM_UUID')
    );

    console.log(`📊 Found ${pendingXUMMDeposits.length} pending XUMM deposits:\n`);
    pendingXUMMDeposits.forEach((tx, idx) => {
      const uuidMatch = tx.description?.match(/XUMM_UUID:([a-f0-9-]+)/i);
      console.log(`  ${idx + 1}. Transaction ID: ${tx.id}`);
      console.log(`     Amount: ${tx.amount.xrp} XRP ($${tx.amount.usd})`);
      console.log(`     XUMM UUID: ${uuidMatch ? uuidMatch[1] : 'Not found'}`);
      console.log(`     Created: ${tx.createdAt}\n`);
    });

    // Step 2: Test status endpoint for each pending transaction
    const testTransactionId = TRANSACTION_ID || (pendingXUMMDeposits[0]?.id);
    
    if (!testTransactionId) {
      console.log('⚠️  No pending XUMM deposits found. Create one first by calling POST /api/wallet/fund');
      return;
    }

    console.log(`\n🔍 Step 2: Checking status for transaction: ${testTransactionId}\n`);
    
    const statusRes = await fetch(`${BASE_URL}/api/wallet/fund/status?transactionId=${testTransactionId}`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!statusRes.ok) {
      const errorText = await statusRes.text();
      throw new Error(`Failed to check status: ${statusRes.status} ${statusRes.statusText}\n${errorText}`);
    }

    const statusData = await statusRes.json();
    console.log('📊 Status Response:');
    console.log(JSON.stringify(statusData, null, 2));
    console.log('\n');

    // Step 3: Check balance
    console.log('💰 Step 3: Checking wallet balance...\n');
    const balanceRes = await fetch(`${BASE_URL}/api/wallet/balance`, {
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (balanceRes.ok) {
      const balanceData = await balanceRes.json();
      console.log('📊 Balance Response:');
      console.log(JSON.stringify(balanceData, null, 2));
    }

    console.log('\n✅ Test complete! Check the debug log at: .cursor/debug.log\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// Run the test
testXUMMStatus();

















