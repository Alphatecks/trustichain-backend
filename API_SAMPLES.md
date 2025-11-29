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

### Fund Wallet (Deposit) - Step 1: Prepare Transaction

**Endpoint:** `POST /api/wallet/fund`

**Description:** Prepares a deposit transaction for user signing. Returns an unsigned transaction blob that the frontend should send to the user's XRPL wallet (Xaman/Xumm, Ledger, etc.) for signing.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "amount": 1000,
  "currency": "XRP"
}
```

**Supported Currencies:** `XRP`, `USDT`, `USDC`, `USD` (defaults to USDT)

**Request:**
```bash
curl -X POST https://your-api.com/api/wallet/fund \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "currency": "XRP"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Transaction prepared. Please sign in your wallet.",
  "data": {
    "transactionId": "550e8400-e29b-41d4-a716-446655440000",
    "transaction": {
      "TransactionType": "Payment",
      "Destination": "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH",
      "Amount": "1000000000",
      "Fee": "12",
      "Sequence": 12345,
      "Account": "rUserWalletAddress..."
    },
    "transactionBlob": "{\"TransactionType\":\"Payment\",...}",
    "instructions": "Please sign this transaction in your XRPL wallet to send 1000 XRP to rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH",
    "amount": {
      "xrp": 1000,
      "usdt": 0,
      "usdc": 0
    },
    "requiresTrustLine": false,
    "trustLineTransaction": null
  }
}
```

**Response for Token (USDT/USDC) - May Require Trust Line:**
```json
{
  "success": true,
  "message": "Transaction prepared. Please sign in your wallet.",
  "data": {
    "transactionId": "550e8400-e29b-41d4-a716-446655440000",
    "transaction": { ... },
    "transactionBlob": "...",
    "instructions": "Please sign this transaction in your XRPL wallet to send 1000 USDT to rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH",
    "amount": {
      "xrp": 0,
      "usdt": 1000,
      "usdc": 0
    },
    "requiresTrustLine": true,
    "trustLineTransaction": {
      "transaction": {
        "TransactionType": "TrustSet",
        "LimitAmount": {
          "currency": "USD",
          "issuer": "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",
          "value": "1000000000"
        }
      },
      "transactionBlob": "...",
      "instructions": "Please sign this transaction to set up a trust line for USDT. This is required before you can receive USDT tokens."
    }
  }
}
```

**Note:** 
- After getting the transaction blob, call `/api/wallet/fund/create-payload` to create a XUMM payload
- Frontend will receive a XUMM URL that opens the Xaman app for user signing
- Poll `/api/wallet/fund/status` to check if the transaction has been signed

### Fund Wallet (Deposit) - Step 2: Create XUMM Payload

**Endpoint:** `POST /api/wallet/fund/create-payload`

**Description:** Creates a XUMM payload using backend XUMM API credentials. Returns a URL that the frontend can use to open the Xaman app for user signing.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "transactionId": "550e8400-e29b-41d4-a716-446655440000",
  "transactionBlob": "{\"TransactionType\":\"Payment\",\"Destination\":\"rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH\",\"Amount\":\"1000000000\"}"
}
```

**Request:**
```bash
curl -X POST https://your-api.com/api/wallet/fund/create-payload \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "550e8400-e29b-41d4-a716-446655440000",
    "transactionBlob": "{\"TransactionType\":\"Payment\",...}"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "XUMM payload created successfully",
  "data": {
    "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "next": {
      "always": "https://xumm.app/sign/a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    }
  }
}
```

**Note:** 
- Frontend should open `data.next.always` URL in a new window or redirect user
- This URL will open the Xaman app (if installed) or web interface for signing
- The backend stores the XUMM UUID with the transaction for status checking

### Fund Wallet (Deposit) - Step 3: Check Payload Status

**Endpoint:** `GET /api/wallet/fund/status?transactionId=...`

**Description:** Checks the status of a XUMM payload. Returns whether the transaction has been signed, cancelled, or expired. If signed, the backend automatically submits it to XRPL.

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```bash
curl -X GET "https://your-api.com/api/wallet/fund/status?transactionId=550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <token>"
```

**Response (200 OK) - Pending:**
```json
{
  "success": true,
  "message": "Payload status retrieved",
  "data": {
    "signed": false,
    "signedTxBlob": null,
    "cancelled": false,
    "expired": false,
    "xrplTxHash": null
  }
}
```

**Response (200 OK) - Signed:**
```json
{
  "success": true,
  "message": "Transaction signed and submitted",
  "data": {
    "signed": true,
    "signedTxBlob": "120000228000000024000000012E...",
    "cancelled": false,
    "expired": false,
    "xrplTxHash": "A1B2C3D4E5F6..."
  }
}
```

**Response (200 OK) - Cancelled:**
```json
{
  "success": true,
  "message": "Payload status retrieved",
  "data": {
    "signed": false,
    "signedTxBlob": null,
    "cancelled": true,
    "expired": false,
    "xrplTxHash": null
  }
}
```

**Note:** 
- Frontend should poll this endpoint every few seconds while waiting for user to sign
- When `signed` is `true`, the transaction has been automatically submitted to XRPL
- If `cancelled` or `expired` is `true`, the transaction failed and user needs to start over

### Fund Wallet (Deposit) - Step 4: Complete Transaction (Alternative)

**Endpoint:** `POST /api/wallet/fund/complete`

**Description:** Completes the wallet funding after the user signs the transaction in their wallet. Submits the signed transaction to XRPL.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "transactionId": "550e8400-e29b-41d4-a716-446655440000",
  "signedTxBlob": "{\"TransactionType\":\"Payment\",\"signed\":true,...}"
}
```

**Request:**
```bash
curl -X POST https://your-api.com/api/wallet/fund/complete \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "550e8400-e29b-41d4-a716-446655440000",
    "signedTxBlob": "{\"TransactionType\":\"Payment\",...}"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Wallet funded successfully",
  "data": {
    "transactionId": "550e8400-e29b-41d4-a716-446655440000",
    "xrplTxHash": "A1B2C3D4E5F6...",
    "status": "completed"
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "Transaction not found",
  "error": "Transaction not found"
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


