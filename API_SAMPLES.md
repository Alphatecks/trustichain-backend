# TrustiChain Backend API Samples

This document provides comprehensive API samples for all endpoints in the TrustiChain Backend.

## Authentication

Most endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

---

## Dashboard APIs

### Get Dashboard Summary

**Endpoint:** `GET /api/dashboard/summary`

**Description:** Returns aggregated dashboard data including balance, active escrows, trustiscore, and total escrowed.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```bash
curl -X GET https://your-api.com/api/dashboard/summary \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Dashboard summary retrieved successfully",
  "data": {
    "balance": {
      "xrp": 45234.123456,
      "usdt": 1000.500000,
      "usdc": 500.250000
    },
    "activeEscrows": {
      "count": 3,
      "lockedAmount": 5000.00
    },
    "trustiscore": {
      "score": 75,
      "level": "Gold"
    },
    "totalEscrowed": 25000.00
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "message": "Authorization token required. Please provide a valid Bearer token.",
  "error": "Unauthorized"
}
```

---

## Wallet APIs

### Get Wallet Balance

**Endpoint:** `GET /api/wallet/balance`

**Description:** Returns the current wallet balance in XRP, USDT, and USDC, along with the XRPL address.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```bash
curl -X GET https://your-api.com/api/wallet/balance \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Wallet balance retrieved successfully",
  "data": {
    "balance": {
      "xrp": 45234.123456,
      "usdt": 1000.500000,
      "usdc": 500.250000
    },
    "xrplAddress": "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH"
  }
}
```

### Fund Wallet (Deposit)

**Endpoint:** `POST /api/wallet/fund`

**Description:** Initiates a deposit transaction to fund the wallet.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "amount": 1000,
  "currency": "USD"
}
```

**Request:**
```bash
curl -X POST https://your-api.com/api/wallet/fund \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "currency": "USD"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Wallet funded successfully",
  "data": {
    "transactionId": "550e8400-e29b-41d4-a716-446655440000",
    "amount": {
      "usd": 1000.00,
      "xrp": 1841.62
    },
    "xrplTxHash": "A1B2C3D4E5F6...",
    "status": "processing"
  }
}
```

**Alternative Request (XRP):**
```json
{
  "amount": 1000,
  "currency": "XRP"
}
```

### Withdraw from Wallet

**Endpoint:** `POST /api/wallet/withdraw`

**Description:** Initiates a withdrawal transaction from the wallet to a specified address.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "amount": 500,
  "currency": "USD",
  "destinationAddress": "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH"
}
```

**Request:**
```bash
curl -X POST https://your-api.com/api/wallet/withdraw \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500,
    "currency": "USD",
    "destinationAddress": "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Withdrawal initiated successfully",
  "data": {
    "transactionId": "660e8400-e29b-41d4-a716-446655440000",
    "amount": {
      "usd": 500.00,
      "xrp": 920.81
    },
    "xrplTxHash": "B2C3D4E5F6A7...",
    "status": "processing"
  }
}
```

**Error Response (400 Bad Request - Insufficient Balance):**
```json
{
  "success": false,
  "message": "Insufficient balance",
  "error": "Insufficient balance"
}
```

### Get Swap Quote

**Endpoint:** `POST /api/wallet/swap/quote`

**Description:** Get a quote for swapping between XRP, USDT, and USDC. Can use either internal exchange rates or live XRPL DEX orderbook prices.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body (Internal Quote - Default):**
```json
{
  "amount": 1000,
  "fromCurrency": "XRP",
  "toCurrency": "USDT"
}
```

**Request Body (DEX Quote - Live XRPL Prices):**
```json
{
  "amount": 1000,
  "fromCurrency": "XRP",
  "toCurrency": "USDT",
  "useDEX": true
}
```

**Request:**
```bash
# Internal quote
curl -X POST https://your-api.com/api/wallet/swap/quote \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "fromCurrency": "XRP",
    "toCurrency": "USDT"
  }'

# DEX quote (live prices)
curl -X POST https://your-api.com/api/wallet/swap/quote \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "fromCurrency": "XRP",
    "toCurrency": "USDT",
    "useDEX": true
  }'
```

**Response (200 OK - Internal Quote):**
```json
{
  "success": true,
  "message": "Swap quote calculated successfully",
  "data": {
    "fromCurrency": "XRP",
    "toCurrency": "USDT",
    "fromAmount": 1000,
    "toAmount": 542.123456,
    "rate": 0.542123,
    "usdValue": 542.12,
    "feeUsd": 0.00
  }
}
```

**Response (200 OK - DEX Quote):**
```json
{
  "success": true,
  "message": "DEX swap quote calculated successfully",
  "data": {
    "fromCurrency": "XRP",
    "toCurrency": "USDT",
    "fromAmount": 1000,
    "toAmount": 540.856234,
    "rate": 0.540856,
    "usdValue": 540.86,
    "feeUsd": 0.000006
  }
}
```

**Error Response (400 Bad Request - Insufficient Balance):**
```json
{
  "success": false,
  "message": "Insufficient XRP balance for swap",
  "error": "Insufficient balance"
}
```

**Error Response (400 Bad Request - No Liquidity):**
```json
{
  "success": false,
  "message": "No liquidity available for XRP/USDT",
  "error": "No liquidity available for XRP/USDT"
}
```

---

### Execute Swap

**Endpoint:** `POST /api/wallet/swap`

**Description:** Execute a swap between XRP, USDT, and USDC. Supports both internal (database) swaps and on-chain (XRPL DEX) swaps.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body (Internal Swap - Default):**
```json
{
  "amount": 1000,
  "fromCurrency": "XRP",
  "toCurrency": "USDT",
  "swapType": "internal"
}
```

**Request Body (On-Chain Swap - Real Tokens):**
```json
{
  "amount": 1000,
  "fromCurrency": "XRP",
  "toCurrency": "USDT",
  "swapType": "onchain",
  "slippageTolerance": 5
}
```

**Request:**
```bash
# Internal swap (database only)
curl -X POST https://your-api.com/api/wallet/swap \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "fromCurrency": "XRP",
    "toCurrency": "USDT",
    "swapType": "internal"
  }'

# On-chain swap (real XRPL transaction)
curl -X POST https://your-api.com/api/wallet/swap \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "fromCurrency": "XRP",
    "toCurrency": "USDT",
    "swapType": "onchain",
    "slippageTolerance": 5
  }'
```

**Response (200 OK - Internal Swap Completed):**
```json
{
  "success": true,
  "message": "Swap executed successfully",
  "data": {
    "transactionId": "770e8400-e29b-41d4-a716-446655440000",
    "fromCurrency": "XRP",
    "toCurrency": "USDT",
    "fromAmount": 1000,
    "toAmount": 542.123456,
    "rate": 0.542123,
    "usdValue": 542.12,
    "feeUsd": 0.00,
    "status": "completed",
    "swapType": "internal"
  }
}
```

**Response (200 OK - On-Chain Swap Completed - Custodial Wallet):**
```json
{
  "success": true,
  "message": "On-chain swap executed successfully",
  "data": {
    "transactionId": "880e8400-e29b-41d4-a716-446655440000",
    "fromCurrency": "XRP",
    "toCurrency": "USDT",
    "fromAmount": 1000,
    "toAmount": 540.856234,
    "rate": 0.540856,
    "usdValue": 540.86,
    "feeUsd": 0.000006,
    "status": "completed",
    "swapType": "onchain",
    "xrplTxHash": "A1B2C3D4E5F6789012345678901234567890ABCDEF1234567890ABCDEF1234"
  }
}
```

**Response (200 OK - On-Chain Swap Pending - Non-Custodial Wallet):**
```json
{
  "success": true,
  "message": "Transaction prepared. Please sign in Xaman app.",
  "data": {
    "transactionId": "990e8400-e29b-41d4-a716-446655440000",
    "fromCurrency": "XRP",
    "toCurrency": "USDT",
    "fromAmount": 1000,
    "toAmount": 540.856234,
    "rate": 0.540856,
    "usdValue": 540.86,
    "feeUsd": 0.000006,
    "status": "pending",
    "swapType": "onchain",
    "transactionBlob": "120000220000000024000000012E...",
    "xummUrl": "https://xumm.app/sign/550e8400-e29b-41d4-a716-446655440000",
    "xummUuid": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Response (200 OK - On-Chain Swap Pending - Browser Wallet):**
```json
{
  "success": true,
  "message": "Transaction prepared. Please sign with your XRPL wallet.",
  "data": {
    "transactionId": "aa0e8400-e29b-41d4-a716-446655440000",
    "fromCurrency": "XRP",
    "toCurrency": "USDT",
    "fromAmount": 1000,
    "toAmount": 540.856234,
    "rate": 0.540856,
    "usdValue": 540.86,
    "feeUsd": 0.000006,
    "status": "pending",
    "swapType": "onchain",
    "transactionBlob": "120000220000000024000000012E..."
  }
}
```

**Error Response (400 Bad Request - Insufficient Balance):**
```json
{
  "success": false,
  "message": "Insufficient XRP balance for swap",
  "error": "Insufficient balance"
}
```

**Error Response (400 Bad Request - No Liquidity):**
```json
{
  "success": false,
  "message": "No liquidity available for XRP/USDT",
  "error": "No liquidity available for XRP/USDT"
}
```

**Error Response (400 Bad Request - Trust Line Required):**
```json
{
  "success": false,
  "message": "Trust line required for USDT. Please connect your wallet to create it.",
  "error": "Trust line required"
}
```

**Supported Currency Pairs:**
- `XRP` ↔ `USDT`
- `XRP` ↔ `USDC`
- `USDT` ↔ `USDC` (routes through XRP automatically)
- `USDC` ↔ `USDT` (routes through XRP automatically)

**Swap Type Options:**
- `internal` (default): Fast database-only swap. Tokens are not withdrawable but appear in your wallet balance.
- `onchain`: Real XRPL DEX swap. Tokens are real and can be withdrawn. Requires blockchain confirmation (~3-5 seconds).

**Parameters:**
- `amount` (required): Amount to swap in `fromCurrency`
- `fromCurrency` (required): `'XRP' | 'USDT' | 'USDC'`
- `toCurrency` (required): `'XRP' | 'USDT' | 'USDC'`
- `swapType` (optional): `'internal' | 'onchain'` (default: `'internal'`)
- `slippageTolerance` (optional): Percentage (0-100) for on-chain swaps (default: 5%)

---

### Get Wallet Transactions

**Endpoint:** `GET /api/wallet/transactions?limit=50&offset=0`

**Description:** Returns a paginated list of wallet transactions.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional, default: 50) - Number of transactions to return
- `offset` (optional, default: 0) - Number of transactions to skip

**Request:**
```bash
curl -X GET "https://your-api.com/api/wallet/transactions?limit=20&offset=0" \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Transactions retrieved successfully",
  "data": {
    "transactions": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "type": "deposit",
        "amount": {
          "usd": 1000.00,
          "xrp": 1841.62
        },
        "status": "completed",
        "xrplTxHash": "A1B2C3D4E5F6...",
        "description": "Deposit 1000 USD",
        "createdAt": "2024-01-15T10:30:00Z"
      },
      {
        "id": "660e8400-e29b-41d4-a716-446655440001",
        "type": "withdrawal",
        "amount": {
          "usd": 500.00,
          "xrp": 920.81
        },
        "status": "completed",
        "xrplTxHash": "B2C3D4E5F6A7...",
        "description": "Withdrawal to rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH",
        "createdAt": "2024-01-14T15:20:00Z"
      }
    ],
    "total": 25
  }
}
```

---

## Escrow APIs

### Get Active Escrows

**Endpoint:** `GET /api/escrow/active`

**Description:** Returns the count and total locked amount of active escrows.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```bash
curl -X GET https://your-api.com/api/escrow/active \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Active escrows retrieved successfully",
  "data": {
    "count": 3,
    "lockedAmount": 5000.00
  }
}
```

### Get Total Escrowed

**Endpoint:** `GET /api/escrow/total`

**Description:** Returns the total amount escrowed (all time, all statuses).

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```bash
curl -X GET https://your-api.com/api/escrow/total \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Total escrowed retrieved successfully",
  "data": {
    "totalEscrowed": 25000.00
  }
}
```

### Create Escrow

**Endpoint:** `POST /api/escrow/create`

**Description:** Creates a new escrow transaction with a counterparty.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "counterpartyId": "123e4567-e89b-12d3-a456-426614174000",
  "amount": 1000,
  "currency": "USD",
  "description": "Payment for services rendered"
}
```

**Request:**
```bash
curl -X POST https://your-api.com/api/escrow/create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "counterpartyId": "123e4567-e89b-12d3-a456-426614174000",
    "amount": 1000,
    "currency": "USD",
    "description": "Payment for services rendered"
  }'
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Escrow created successfully",
  "data": {
    "escrowId": "770e8400-e29b-41d4-a716-446655440000",
    "amount": {
      "usd": 1000.00,
      "xrp": 1841.62
    },
    "status": "pending",
    "xrplEscrowId": "C3D4E5F6A7B8..."
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "Counterparty wallet not found",
  "error": "Counterparty wallet not found"
}
```

### Get Escrow List

**Endpoint:** `GET /api/escrow/list?limit=50&offset=0`

**Description:** Returns a paginated list of escrows where the user is initiator or counterparty.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional, default: 50) - Number of escrows to return
- `offset` (optional, default: 0) - Number of escrows to skip

**Request:**
```bash
curl -X GET "https://your-api.com/api/escrow/list?limit=10&offset=0" \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Escrows retrieved successfully",
  "data": {
    "escrows": [
      {
        "id": "770e8400-e29b-41d4-a716-446655440000",
        "counterpartyId": "123e4567-e89b-12d3-a456-426614174000",
        "counterpartyName": "John Doe",
        "amount": {
          "usd": 1000.00,
          "xrp": 1841.62
        },
        "status": "active",
        "description": "Payment for services rendered",
        "xrplEscrowId": "C3D4E5F6A7B8...",
        "createdAt": "2024-01-15T10:00:00Z",
        "updatedAt": "2024-01-15T10:00:00Z",
        "completedAt": null
      }
    ],
    "total": 5
  }
}
```

---

## Dispute APIs

### Create Dispute

**Endpoint:** `POST /api/disputes`

**Description:** Creates a new dispute for an escrow transaction. Requires the user to be either the initiator or counterparty of the escrow.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "escrowId": "770e8400-e29b-41d4-a716-446655440000",
  "disputeCategory": "freelancing",
  "disputeReasonType": "quality_issue",
  "payerXrpWalletAddress": "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH",
  "payerName": "John Doe",
  "payerEmail": "john.doe@example.com",
  "payerPhone": "+1234567890",
  "respondentXrpWalletAddress": "rDKoevwXEsVqaKmfuudtVSrczAPqVs2wSJ",
  "respondentName": "Jane Smith",
  "respondentEmail": "jane.smith@example.com",
  "respondentPhone": "+0987654321",
  "disputeReason": "Service quality did not meet agreed standards",
  "amount": 1000.00,
  "currency": "USD",
  "resolutionPeriod": "14 days",
  "expectedResolutionDate": "2024-02-15T00:00:00Z",
  "description": "The freelancer delivered work that did not meet the specifications outlined in the contract. Multiple revisions were requested but the quality remained subpar.",
  "evidence": [
    {
      "fileUrl": "https://storage.example.com/evidence/contract.pdf",
      "fileName": "contract.pdf",
      "fileType": "application/pdf",
      "fileSize": 245760
    },
    {
      "fileUrl": "https://storage.example.com/evidence/screenshots.zip",
      "fileName": "screenshots.zip",
      "fileType": "application/zip",
      "fileSize": 1024000
    }
  ]
}
```

**Request (cURL):**
```bash
curl -X POST https://your-api.com/api/disputes \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "escrowId": "770e8400-e29b-41d4-a716-446655440000",
    "disputeCategory": "freelancing",
    "disputeReasonType": "quality_issue",
    "payerXrpWalletAddress": "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH",
    "payerName": "John Doe",
    "payerEmail": "john.doe@example.com",
    "payerPhone": "+1234567890",
    "respondentXrpWalletAddress": "rDKoevwXEsVqaKmfuudtVSrczAPqVs2wSJ",
    "respondentName": "Jane Smith",
    "respondentEmail": "jane.smith@example.com",
    "respondentPhone": "+0987654321",
    "disputeReason": "Service quality did not meet agreed standards",
    "amount": 1000.00,
    "currency": "USD",
    "resolutionPeriod": "14 days",
    "expectedResolutionDate": "2024-02-15T00:00:00Z",
    "description": "The freelancer delivered work that did not meet the specifications outlined in the contract. Multiple revisions were requested but the quality remained subpar.",
    "evidence": [
      {
        "fileUrl": "https://storage.example.com/evidence/contract.pdf",
        "fileName": "contract.pdf",
        "fileType": "application/pdf",
        "fileSize": 245760
      }
    ]
  }'
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Dispute created successfully",
  "data": {
    "disputeId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "caseId": "#DSP-2024-001"
  }
}
```

**Error Response (400 Bad Request - Missing Fields):**
```json
{
  "success": false,
  "message": "Escrow ID is required",
  "error": "Escrow ID is required"
}
```

**Error Response (400 Bad Request - Wallet Not Found):**
```json
{
  "success": false,
  "message": "Respondent wallet not found. The respondent must have a registered wallet.",
  "error": "Respondent wallet not found"
}
```

**Error Response (400 Bad Request - Access Denied):**
```json
{
  "success": false,
  "message": "You do not have access to this escrow",
  "error": "Access denied"
}
```

**Request Body Fields:**
- `escrowId` (string, required) - UUID of the escrow this dispute relates to
- `disputeCategory` (string, required) - One of: `freelancing`, `real_estate`, `product_purchase`, `custom`
- `disputeReasonType` (string, required) - One of: `quality_issue`, `delivery_delay`, `payment_dispute`
- `payerXrpWalletAddress` (string, required) - XRPL wallet address of the payer (must match authenticated user's wallet)
- `payerName` (string, optional) - Full name of the payer
- `payerEmail` (string, optional) - Email address of the payer
- `payerPhone` (string, optional) - Phone number of the payer
- `respondentXrpWalletAddress` (string, required) - XRPL wallet address of the respondent
- `respondentName` (string, optional) - Full name of the respondent
- `respondentEmail` (string, optional) - Email address of the respondent
- `respondentPhone` (string, optional) - Phone number of the respondent
- `disputeReason` (string, required) - Brief reason for the dispute
- `amount` (number, required) - Amount in dispute (must be > 0)
- `currency` (string, required) - One of: `USD`, `XRP`
- `resolutionPeriod` (string, optional) - Expected resolution period (e.g., "7 days", "14 days")
- `expectedResolutionDate` (string, optional) - ISO 8601 date string for expected resolution
- `description` (string, required) - Detailed description of the dispute
- `evidence` (array, optional) - Array of evidence items with:
  - `fileUrl` (string, required) - URL to the evidence file
  - `fileName` (string, required) - Name of the file
  - `fileType` (string, optional) - MIME type of the file
  - `fileSize` (number, optional) - Size of the file in bytes

**Minimal Request Example (Required Fields Only):**
```json
{
  "escrowId": "770e8400-e29b-41d4-a716-446655440000",
  "disputeCategory": "freelancing",
  "disputeReasonType": "quality_issue",
  "payerXrpWalletAddress": "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH",
  "respondentXrpWalletAddress": "rDKoevwXEsVqaKmfuudtVSrczAPqVs2wSJ",
  "disputeReason": "Service quality did not meet agreed standards",
  "amount": 1000.00,
  "currency": "USD",
  "description": "The freelancer delivered work that did not meet the specifications outlined in the contract."
}
```

### Upload Evidence File

**Endpoint:** `POST /api/disputes/evidence/upload`

**Description:** Uploads an evidence file for dispute. Returns the file URL that can be used in the Create Dispute request.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**
- `file` (file, required) - The evidence file to upload

**Request (cURL):**
```bash
curl -X POST https://your-api.com/api/disputes/evidence/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/evidence.pdf"
```

**Request (JavaScript/Fetch):**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('https://your-api.com/api/disputes/evidence/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData,
});

const result = await response.json();
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "fileUrl": "https://your-project.supabase.co/storage/v1/object/public/dispute-evidence/user-id/1234567890-abc12345-evidence.pdf",
    "fileName": "evidence.pdf",
    "fileSize": 245760,
    "fileType": "application/pdf"
  }
}
```

**Error Response (400 Bad Request - No File):**
```json
{
  "success": false,
  "message": "No file provided",
  "error": "No file provided"
}
```

**Error Response (400 Bad Request - File Too Large):**
```json
{
  "success": false,
  "message": "File size exceeds maximum allowed size of 50MB",
  "error": "File size exceeds maximum allowed size of 50MB"
}
```

**Error Response (400 Bad Request - Invalid File Type):**
```json
{
  "success": false,
  "message": "File type not allowed. Allowed types: image/jpeg, image/png, application/pdf, ...",
  "error": "File type not allowed. Allowed types: image/jpeg, image/png, application/pdf, ..."
}
```

**File Upload Limits:**
- **Max File Size:** 50MB
- **Allowed File Types:**
  - Images: `image/jpeg`, `image/jpg`, `image/png`, `image/gif`, `image/webp`
  - Documents: `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`
  - Archives: `application/zip`, `application/x-zip-compressed`
  - Video: `video/mp4`, `video/quicktime`
  - Audio: `audio/mpeg`, `audio/wav`

**Usage Flow:**
1. Upload evidence files using this endpoint
2. Collect the `fileUrl` from each upload response
3. Include the `fileUrl` in the `evidence` array when creating a dispute

**Example Workflow:**
```javascript
// Step 1: Upload evidence files
const file1 = await uploadEvidence(file1Input.files[0], token);
const file2 = await uploadEvidence(file2Input.files[0], token);

// Step 2: Create dispute with file URLs
const disputeData = {
  escrowId: "...",
  // ... other fields
  evidence: [
    {
      fileUrl: file1.data.fileUrl,
      fileName: file1.data.fileName,
      fileType: file1.data.fileType,
      fileSize: file1.data.fileSize,
    },
    {
      fileUrl: file2.data.fileUrl,
      fileName: file2.data.fileName,
      fileType: file2.data.fileType,
      fileSize: file2.data.fileSize,
    },
  ],
};

await createDispute(disputeData, token);
```

---

## Trustiscore APIs

### Get Trustiscore

**Endpoint:** `GET /api/trustiscore`

**Description:** Returns the user's trustiscore (score, level, and factors).

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```bash
curl -X GET https://your-api.com/api/trustiscore \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Trustiscore retrieved successfully",
  "data": {
    "score": 75,
    "level": "Gold",
    "factors": {
      "completedEscrows": 15,
      "accountAge": 180,
      "disputeResolutionRate": 0.95,
      "transactionVolume": 50000,
      "onTimeCompletionRate": 0.90
    }
  }
}
```

### View Trustiscore Level

**Endpoint:** `GET /api/trustiscore/level`

**Description:** Returns detailed trustiscore level information (same as getTrustiscore but with emphasis on level details).

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```bash
curl -X GET https://your-api.com/api/trustiscore/level \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Trustiscore level retrieved successfully",
  "data": {
    "score": 75,
    "level": "Gold",
    "factors": {
      "completedEscrows": 15,
      "accountAge": 180,
      "disputeResolutionRate": 0.95,
      "transactionVolume": 50000,
      "onTimeCompletionRate": 0.90
    }
  }
}
```

**Trustiscore Levels:**
- **Bronze**: 0-30 points
- **Silver**: 31-50 points
- **Gold**: 51-70 points
- **Platinum**: 71-100 points

---

## Portfolio APIs

### Get Portfolio Performance

**Endpoint:** `GET /api/portfolio/performance?timeframe=monthly`

**Description:** Returns portfolio performance data for chart visualization.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `timeframe` (optional, default: monthly) - One of: `daily`, `weekly`, `monthly`, `yearly`

**Request:**
```bash
curl -X GET "https://your-api.com/api/portfolio/performance?timeframe=monthly" \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Portfolio performance retrieved successfully",
  "data": {
    "timeframe": "monthly",
    "data": [
      {
        "period": "Aug",
        "value": 10000.00
      },
      {
        "period": "Sep",
        "value": 15000.00
      },
      {
        "period": "Oct",
        "value": 18000.00
      },
      {
        "period": "Nov",
        "value": 22000.00
      },
      {
        "period": "Dec",
        "value": 24567.89
      }
    ]
  }
}
```

**Daily Timeframe Example:**
```bash
curl -X GET "https://your-api.com/api/portfolio/performance?timeframe=daily" \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "success": true,
  "message": "Portfolio performance retrieved successfully",
  "data": {
    "timeframe": "daily",
    "data": [
      {
        "period": "Dec 10",
        "value": 24000.00
      },
      {
        "period": "Dec 11",
        "value": 24200.00
      },
      {
        "period": "Dec 12",
        "value": 24350.00
      }
    ]
  }
}
```

**Error Response (400 Bad Request - Invalid Timeframe):**
```json
{
  "success": false,
  "message": "Invalid timeframe. Must be one of: daily, weekly, monthly, yearly",
  "error": "Validation error"
}
```

---

## Exchange Rate APIs

### Get Live Exchange Rates

**Endpoint:** `GET /api/exchange/rates`

**Description:** Returns live exchange rates for XRP against major currencies (USD, EUR, GBP, JPY). **Public endpoint - no authentication required.**

**Request:**
```bash
curl -X GET https://your-api.com/api/exchange/rates
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Exchange rates retrieved successfully",
  "data": {
    "rates": [
      {
        "currency": "USD",
        "rate": 0.5430,
        "change": 0.0123,
        "changePercent": 2.32
      },
      {
        "currency": "EUR",
        "rate": 0.4920,
        "change": -0.0056,
        "changePercent": -1.12
      },
      {
        "currency": "GBP",
        "rate": 0.4310,
        "change": 0.0089,
        "changePercent": 2.11
      },
      {
        "currency": "JPY",
        "rate": 81.20,
        "change": 1.50,
        "changePercent": 1.88
      }
    ],
    "lastUpdated": "2024-01-15T12:00:00Z"
  }
}
```

**Note:** Exchange rates are cached for 5 minutes to avoid rate limiting.

---

## User APIs

### Get User Profile

**Endpoint:** `GET /api/user/profile`

**Description:** Returns the authenticated user's profile information.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```bash
curl -X GET https://your-api.com/api/user/profile \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User profile retrieved successfully",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@example.com",
    "fullName": "John Doe",
    "country": "United States",
    "verified": true
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "User not found",
  "error": "User not found"
}
```

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "success": false,
  "message": "Error description",
  "error": "Error type"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Authorization token required. Please provide a valid Bearer token.",
  "error": "Unauthorized"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Route not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "An unexpected error occurred",
  "error": "Internal server error"
}
```

---

## Testing with Postman

### Import Collection

You can import these endpoints into Postman:

1. Create a new collection: "TrustiChain Backend APIs"
2. Set collection variable: `baseUrl` = `https://your-api.com`
3. Set collection variable: `token` = `your_jwt_token`
4. Use `{{baseUrl}}` and `{{token}}` in requests

### Example Postman Request

**GET Dashboard Summary:**
- Method: `GET`
- URL: `{{baseUrl}}/api/dashboard/summary`
- Headers:
  - `Authorization`: `Bearer {{token}}`

**POST Fund Wallet:**
- Method: `POST`
- URL: `{{baseUrl}}/api/wallet/fund`
- Headers:
  - `Authorization`: `Bearer {{token}}`
  - `Content-Type`: `application/json`
- Body (raw JSON):
```json
{
  "amount": 1000,
  "currency": "USD"
}
```

---

## Notes

1. **Authentication**: Most endpoints require a valid JWT token. Obtain this token through the authentication endpoints (`/api/auth/login` or `/api/auth/google`).

2. **Currency**: When specifying amounts, you can use either `"USD"` or `"XRP"` as the currency. The system will automatically convert between them using current exchange rates.

3. **Pagination**: List endpoints support pagination with `limit` and `offset` query parameters.

4. **XRPL Network**: The XRPL integration uses testnet by default. Set `XRPL_NETWORK=mainnet` in environment variables for production.

5. **Rate Limiting**: Exchange rates are cached for 5 minutes to prevent excessive API calls.

6. **Transaction Status**: Transactions may have the following statuses:
   - `pending` - Transaction initiated but not yet processed
   - `processing` - Transaction is being processed on XRPL
   - `completed` - Transaction successfully completed
   - `failed` - Transaction failed
   - `cancelled` - Transaction was cancelled

7. **Escrow Status**: Escrows may have the following statuses:
   - `pending` - Escrow created but not yet active
   - `active` - Escrow is active and funds are locked
   - `completed` - Escrow completed and funds released
   - `cancelled` - Escrow was cancelled
   - `disputed` - Escrow is in dispute


