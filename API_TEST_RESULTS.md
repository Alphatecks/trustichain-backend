# API Test Results

## Test Configuration

**Test Date:** $(date)
**Base URL:** To be configured (local or deployed)
**Test User:** chikezie.ndubuisi01@gmail.com

## Prerequisites

Before running tests, ensure:

1. **Server is running:**
   - Local: `npm run dev` (runs on port 3000 or PORT env var)
   - Deployed: Use your Render/Production URL

2. **Environment variables are set:**
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (optional but recommended)

3. **Database migrations are applied:**
   - All migration files in `supabase/migrations/` should be run

## Running the Tests

### Option 1: Using the Test Script

```bash
# For local server
BASE_URL="http://localhost:3000" ./test-all-apis.sh

# For deployed server (e.g., Render)
BASE_URL="https://your-app.onrender.com" ./test-all-apis.sh
```

### Option 2: Manual Testing with curl

#### 1. Health Check
```bash
curl http://localhost:3000/health
```

#### 2. Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "chikezie.ndubuisi01@gmail.com",
    "password": "Chikezie02@"
  }'
```

**Save the token from the response** (look for `accessToken` or `token` field)

#### 3. Test Protected Endpoints

Replace `YOUR_TOKEN` with the token from login:

```bash
# Get User Profile
curl http://localhost:3000/api/user/profile \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get Dashboard Summary
curl http://localhost:3000/api/dashboard/summary \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get Wallet Balance
curl http://localhost:3000/api/wallet/balance \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get Wallet Transactions
curl "http://localhost:3000/api/wallet/transactions?limit=10&offset=0" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get Active Escrows
curl http://localhost:3000/api/escrow/active \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get Total Escrowed
curl http://localhost:3000/api/escrow/total \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get Escrow List
curl "http://localhost:3000/api/escrow/list?limit=10&offset=0" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get Trustiscore
curl http://localhost:3000/api/trustiscore \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get Trustiscore Level
curl http://localhost:3000/api/trustiscore/level \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get Portfolio Performance
curl "http://localhost:3000/api/portfolio/performance?timeframe=monthly" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get Exchange Rates (Public - no token needed)
curl http://localhost:3000/api/exchange/rates
```

## Expected Test Results

### ✅ Successful Responses Should Include:

1. **Login:** Returns `success: true` with `accessToken` or `token`
2. **All Protected Endpoints:** Return `success: true` with `data` object
3. **Exchange Rates:** Returns `success: true` with rates array

### ⚠️ Common Issues:

1. **Login Fails:**
   - User may need to verify email first
   - Check if user exists in Supabase Auth
   - Verify password is correct

2. **401 Unauthorized:**
   - Token expired or invalid
   - Token not included in Authorization header
   - Token format incorrect (should be `Bearer <token>`)

3. **500 Internal Server Error:**
   - Database connection issue
   - Missing environment variables
   - Migration not applied

4. **404 Not Found:**
   - Route doesn't exist
   - Wrong base URL
   - Server not running

## Test Checklist

- [ ] Health check endpoint works
- [ ] Login successful and returns token
- [ ] User profile endpoint works
- [ ] Dashboard summary endpoint works
- [ ] Wallet balance endpoint works
- [ ] Wallet transactions endpoint works
- [ ] Active escrows endpoint works
- [ ] Total escrowed endpoint works
- [ ] Escrow list endpoint works
- [ ] Trustiscore endpoint works
- [ ] Trustiscore level endpoint works
- [ ] Portfolio performance endpoint works
- [ ] Exchange rates endpoint works (public)

## Notes

- The test script (`test-all-apis.sh`) automatically tests all endpoints
- For deployed servers, update the `BASE_URL` variable
- All protected endpoints require a valid JWT token
- Exchange rates endpoint is public and doesn't require authentication


