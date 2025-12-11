# Test Instructions: XUMM Deposit Issue (Without Xaman)

## Quick Test Steps

### Prerequisites
1. Backend server running (`npm run dev`)
2. Auth token for API calls
3. At least one existing pending XUMM deposit transaction (or create one)

### Step 1: Run the Test Script

```bash
# Set your auth token
export AUTH_TOKEN="your_auth_token_here"

# Optionally set a specific transaction ID
export TRANSACTION_ID="transaction-uuid-here"

# Set API URL if different from default
export API_URL="http://localhost:3000"

# Run the test
node test-xumm-status.js
```

### Step 2: Check Debug Logs

After running the test, check the debug log:

```bash
cat .cursor/debug.log | jq '.'  # If you have jq installed
# OR
cat .cursor/debug.log
```

### Step 3: Analyze Results

Look for these log entries:
- `getXUMMPayloadStatus: Received XUMM payload status` - Shows what XUMM returned
- `getXUMMPayloadStatus: Checking if transaction needs processing` - Shows if transaction will be processed
- `getXUMMPayloadStatus: Returning status without processing` - Shows why transaction wasn't processed

### Expected Bug Pattern

If the bug exists, you'll see in logs:
- `signed: true`
- `submit: true` (XUMM auto-submitted)
- `hasHex: false` (no hex because already submitted)
- `hasTxid: true` (transaction hash exists)
- `willProcess: false` (transaction skipped!)
- `reason: 'No hex or not signed'`

This means the transaction is on XRPL but the database was never updated!

## Manual API Test (Alternative)

If you prefer to test manually:

```bash
# 1. Get transactions
curl -X GET "http://localhost:3000/api/wallet/transactions" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. Check status for a pending XUMM transaction
curl -X GET "http://localhost:3000/api/wallet/fund/status?transactionId=TRANSACTION_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Check balance
curl -X GET "http://localhost:3000/api/wallet/balance" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## What to Report

After testing, report:
1. Did the test script find any pending XUMM deposits?
2. What did the status endpoint return?
3. What do the debug logs show? (especially the "Checking if transaction needs processing" entry)
4. Did the balance update?

