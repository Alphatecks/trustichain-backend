# MetaMask Wallet Connect Flow - How It Works

This document explains how the MetaMask wallet connection and funding flow works in TrustiChain Backend.

## Overview

The flow consists of **3 main steps**:
1. **Connect Wallet** - Link MetaMask wallet address to user account
2. **Fund Wallet** - Prepare transaction for signing (when user wants to deposit)
3. **Submit Signed Transaction** - Submit the signed transaction to XRPL

---

## Step 1: Connect MetaMask Wallet

**Purpose:** Link the user's MetaMask wallet address to their TrustiChain account. This does NOT fund the wallet - it just establishes the connection.

### API Endpoint
```
POST /api/wallet/connect
```

### Request
```json
{
  "walletAddress": "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH"
}
```

### What Happens Behind the Scenes

1. **Validates XRPL Address Format**
   ```typescript
   // Checks: starts with 'r', 25-35 characters
   if (!walletAddress.startsWith('r') || walletAddress.length < 25 || walletAddress.length > 35) {
     return { success: false, message: 'Invalid XRPL wallet address format' };
   }
   ```

2. **Checks if Address is Already in Use**
   ```typescript
   // Queries database to ensure no other user has this address
   const existingWallet = await supabase
     .from('wallets')
     .select('user_id')
     .eq('xrpl_address', walletAddress)
     .maybeSingle();
   
   if (existingWallet && existingWallet.user_id !== userId) {
     return { success: false, message: 'Address already in use' };
   }
   ```

3. **Creates or Updates Wallet Record**
   ```typescript
   // If new wallet: Creates record in database
   await supabase.from('wallets').insert({
     user_id: userId,
     xrpl_address: walletAddress,
     balance_xrp: 0,
     balance_usdt: 0,
     balance_usdc: 0,
   });
   
   // If existing wallet: Updates the address
   await supabase.from('wallets')
     .update({ xrpl_address: walletAddress })
     .eq('user_id', userId);
   ```

### Response
```json
{
  "success": true,
  "message": "MetaMask wallet connected successfully. You can now fund your wallet from this connected wallet.",
  "data": {
    "walletAddress": "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH"
  }
}
```

### Frontend Flow
```javascript
// 1. User clicks "Connect MetaMask"
const accounts = await window.ethereum.request({ 
  method: 'eth_requestAccounts' 
});

// 2. Get XRPL address from MetaMask (via XRPL Snap)
// IMPORTANT: Make sure you're getting the XRPL address, not the Ethereum address!
const xrplAddressResponse = await window.ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId: 'npm:@xrpl/snap',
    request: { method: 'getAddress' }
  }
});

// Extract the XRPL address from the response
// The response format may vary, so handle different formats:
let xrplAddress;
if (typeof xrplAddressResponse === 'string') {
  xrplAddress = xrplAddressResponse;
} else if (xrplAddressResponse?.address) {
  xrplAddress = xrplAddressResponse.address;
} else if (xrplAddressResponse?.account) {
  xrplAddress = xrplAddressResponse.account;
} else {
  throw new Error('Could not extract XRPL address from MetaMask response');
}

// Validate the address format before sending
if (!xrplAddress || !xrplAddress.startsWith('r') || xrplAddress.length < 25 || xrplAddress.length > 35) {
  console.error('Invalid XRPL address received:', xrplAddress);
  throw new Error('Invalid XRPL address format. Make sure you are getting the XRPL address from MetaMask XRPL Snap, not the Ethereum address.');
}

// Trim any whitespace
xrplAddress = xrplAddress.trim();

// 3. Send to backend
const response = await fetch('/api/wallet/connect', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ walletAddress: xrplAddress })
});

const result = await response.json();
if (!result.success) {
  console.error('Connect wallet error:', result.message);
  throw new Error(result.message);
}
```

### Common Issues and Solutions

**Issue: "Invalid XRPL wallet address format" error**

**Possible Causes:**
1. **Sending Ethereum address instead of XRPL address**
   - ❌ Wrong: `0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb` (Ethereum)
   - ✅ Correct: `rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH` (XRPL)

2. **Whitespace in address**
   - Solution: Always trim the address: `address.trim()`

3. **Wrong response format from MetaMask**
   - The XRPL Snap might return the address in different formats
   - Check the actual response structure and extract the address correctly

**Debugging Steps:**
```javascript
// Log the raw response to see what MetaMask returns
const xrplAddressResponse = await window.ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId: 'npm:@xrpl/snap',
    request: { method: 'getAddress' }
  }
});

console.log('MetaMask XRPL Snap Response:', {
  raw: xrplAddressResponse,
  type: typeof xrplAddressResponse,
  keys: typeof xrplAddressResponse === 'object' ? Object.keys(xrplAddressResponse) : null,
  stringified: JSON.stringify(xrplAddressResponse),
});
```

---

## Step 2: Fund Wallet (Prepare Transaction)

**Purpose:** When the user wants to deposit funds, this endpoint prepares a transaction for them to sign in MetaMask.

### API Endpoint
```
POST /api/wallet/fund
```

### Request
```json
{
  "amount": 100,
  "currency": "XRP"
}
```

### What Happens Behind the Scenes

1. **Gets User's Wallet Address**
   ```typescript
   const wallet = await supabase
     .from('wallets')
     .select('xrpl_address')
     .eq('user_id', userId)
     .single();
   
   const destinationAddress = wallet.xrpl_address; // User's connected MetaMask address
   ```

2. **Prepares Payment Transaction**
   ```typescript
   // For XRP
   const paymentTx = {
     TransactionType: 'Payment',
     Destination: destinationAddress, // User's wallet
     Amount: xrpToDrops(amount.toString()), // Convert to drops
   };
   
   // For USDT/USDC
   const paymentTx = {
     TransactionType: 'Payment',
     Destination: destinationAddress,
     Amount: {
       currency: 'USD',
       value: amount.toString(),
       issuer: USDT_ISSUER or USDC_ISSUER,
     },
   };
   ```

3. **Serializes Transaction to Blob**
   ```typescript
   const transactionBlob = encode(paymentTx); // Unsigned transaction blob
   ```

4. **Stores Transaction Record**
   ```typescript
   await supabase.from('transactions').insert({
     user_id: userId,
     transaction_id: transactionId,
     type: 'deposit',
     amount: amount,
     currency: currency,
     status: 'pending',
   });
   ```

### Response (MetaMask/Browser Wallet)
```json
{
  "success": true,
  "message": "Transaction prepared. Please sign with MetaMask (XRPL Snap) for XRP deposit.",
  "data": {
    "transactionId": "550e8400-e29b-41d4-a716-446655440000",
    "amount": {
      "usd": 100.00,
      "xrp": 100.00
    },
    "status": "pending",
    "transactionBlob": "120000228000000024000000012E...",
    "walletType": "metamask",
    "instructions": "Use MetaMask with XRPL Snap to sign XRP transaction"
  }
}
```

### Frontend Flow
```javascript
// 1. User enters amount and clicks "Fund Wallet"
const response = await fetch('/api/wallet/fund', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ amount: 100, currency: 'XRP' })
});

const { data } = await response.json();

// 2. Sign transaction in MetaMask
const signedTx = await window.ethereum.request({
  method: 'wallet_invokeSnap',
  params: {
    snapId: 'npm:@xrpl/snap',
    request: {
      method: 'signTransaction',
      params: {
        transaction: JSON.parse(data.transactionBlob)
      }
    }
  }
});

// 3. Submit signed transaction (Step 3)
```

---

## Step 3: Submit Signed Transaction

**Purpose:** Submit the transaction that was signed in MetaMask to the XRPL network.

### API Endpoint
```
POST /api/wallet/fund/submit
```

### Request
```json
{
  "transactionId": "550e8400-e29b-41d4-a716-446655440000",
  "signedTxBlob": "120000228000000024000000012E00000000000000016140000000000000006468400000000000000A732103AB40A0490F9B7ED8DF29D246BF2D6269820A0EE7742ACDD457BEA7C7D0931EDB74473045022100A7A0..."
}
```

### What Happens Behind the Scenes

1. **Validates Signed Transaction Format**
   ```typescript
   // Checks if it's a valid signed transaction blob
   // Must be hex string (1000+ chars) or transaction object
   if (signedTxBlob.length < 1000 && typeof signedTxBlob === 'string') {
     return { success: false, message: 'Invalid transaction format' };
   }
   ```

2. **Submits to XRPL Network**
   ```typescript
   const client = new Client(xrplServer);
   await client.connect();
   
   const submitResult = await client.submit(signedTxBlob);
   
   if (submitResult.result.engine_result === 'tesSUCCESS') {
     const txHash = submitResult.result.tx_json.hash;
     // Transaction successful!
   }
   ```

3. **Updates Transaction Record**
   ```typescript
   await supabase.from('transactions')
     .update({
       status: 'completed',
       xrpl_tx_hash: txHash,
       completed_at: new Date().toISOString(),
     })
     .eq('transaction_id', transactionId);
   ```

4. **Updates Wallet Balance**
   ```typescript
   // Syncs balance from XRPL ledger
   const xrplBalance = await xrplWalletService.getBalance(walletAddress);
   
   await supabase.from('wallets')
     .update({
       balance_xrp: xrplBalance,
       updated_at: new Date().toISOString(),
     })
     .eq('user_id', userId);
   ```

### Response
```json
{
  "success": true,
  "message": "Deposit transaction submitted successfully",
  "data": {
    "transactionId": "550e8400-e29b-41d4-a716-446655440000",
    "xrplTxHash": "A1B2C3D4E5F6789012345678901234567890ABCDEF1234567890ABCDEF123456",
    "status": "completed"
  }
}
```

### Frontend Flow
```javascript
// Submit the signed transaction from MetaMask
const response = await fetch('/api/wallet/fund/submit', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    transactionId: data.transactionId,
    signedTxBlob: signedTx.tx_blob || signedTx // MetaMask returns signed transaction
  })
});

const result = await response.json();
// Transaction is now on XRPL!
```

---

## Complete Flow Diagram

```
┌─────────────┐
│   Frontend  │
└──────┬──────┘
       │
       │ 1. User clicks "Connect MetaMask"
       │    → MetaMask popup → User connects
       │    → Get XRPL address from MetaMask
       │
       ▼
┌─────────────────────────────────────┐
│  POST /api/wallet/connect           │
│  { walletAddress: "r..." }          │
└──────┬──────────────────────────────┘
       │
       │ Backend: Validates address, saves to database
       │
       ▼
┌─────────────────────────────────────┐
│  Response: { success: true, ... }  │
└──────┬──────────────────────────────┘
       │
       │ Wallet is now connected!
       │
       │ 2. User wants to fund → Enters amount
       │
       ▼
┌─────────────────────────────────────┐
│  POST /api/wallet/fund              │
│  { amount: 100, currency: "XRP" }  │
└──────┬──────────────────────────────┘
       │
       │ Backend: Prepares unsigned transaction
       │
       ▼
┌─────────────────────────────────────┐
│  Response: { transactionBlob: ... }│
└──────┬──────────────────────────────┘
       │
       │ 3. Frontend: Sign in MetaMask
       │
       ▼
┌─────────────────────────────────────┐
│  MetaMask Sign Transaction          │
│  → Returns signed transaction       │
└──────┬──────────────────────────────┘
       │
       │ 4. Submit signed transaction
       │
       ▼
┌─────────────────────────────────────┐
│  POST /api/wallet/fund/submit       │
│  { transactionId, signedTxBlob }   │
└──────┬──────────────────────────────┘
       │
       │ Backend: Submits to XRPL, updates balance
       │
       ▼
┌─────────────────────────────────────┐
│  Response: { xrplTxHash: "..." }   │
│  ✅ Transaction complete!           │
└─────────────────────────────────────┘
```

---

## Key Points

1. **Connect is Separate from Fund**
   - Connecting wallet just links the address to the account
   - Funding happens separately when user wants to deposit

2. **User Always Signs in MetaMask**
   - Backend prepares unsigned transactions
   - User signs in MetaMask (XRPL Snap)
   - Backend submits signed transaction to XRPL

3. **Security**
   - Address validation prevents invalid addresses
   - Address uniqueness check prevents duplicate connections
   - User must sign all transactions (non-custodial)

4. **Transaction Flow**
   - Prepare → Sign (MetaMask) → Submit → Complete

---

## Error Handling

### Invalid Address
```json
{
  "success": false,
  "message": "Invalid XRPL wallet address format",
  "error": "Invalid wallet address format"
}
```

### Address Already in Use
```json
{
  "success": false,
  "message": "This wallet address is already connected to another account",
  "error": "Wallet address already in use"
}
```

### Invalid Signed Transaction
```json
{
  "success": false,
  "message": "Invalid signed transaction format",
  "error": "Invalid transaction format"
}
```

---

## Code Locations

- **Connect Wallet Service:** `src/services/wallet/wallet.service.ts` (line 278-399)
- **Connect Wallet Controller:** `src/controllers/wallet.controller.ts` (line 308-329)
- **Connect Wallet Route:** `src/routes/wallet.routes.ts` (line 93-95)
- **Fund Wallet Service:** `src/services/wallet/wallet.service.ts` (line 1270+)
- **Submit Transaction Service:** `src/services/wallet/wallet.service.ts` (line 1700+)
- **XRPL Transaction Prep:** `src/xrpl/wallet/xrpl-wallet.service.ts` (line 236-282)

