#!/bin/bash

# TrustiChain Backend API Test Script
# This script tests all API endpoints

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3001}"
EMAIL="chikezie.ndubuisi01@gmail.com"
PASSWORD="Chikezie02@"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print test result
print_test() {
    local test_name=$1
    local status=$2
    local message=$3
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✓${NC} $test_name: $message"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗${NC} $test_name: $message"
        ((TESTS_FAILED++))
    fi
}

# Function to make API request
api_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local token=$4
    
    if [ -n "$token" ]; then
        if [ -n "$data" ]; then
            curl -s -X "$method" "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $token" \
                -d "$data"
        else
            curl -s -X "$method" "$BASE_URL$endpoint" \
                -H "Authorization: Bearer $token"
        fi
    else
        if [ -n "$data" ]; then
            curl -s -X "$method" "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data"
        else
            curl -s -X "$method" "$BASE_URL$endpoint"
        fi
    fi
}

echo "=========================================="
echo "TrustiChain Backend API Test Suite"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo ""

# Test 1: Health Check
echo "1. Testing Health Check..."
HEALTH_RESPONSE=$(api_request "GET" "/health")
if echo "$HEALTH_RESPONSE" | grep -q "status.*ok" || echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
    print_test "Health Check" "PASS" "Server is running"
else
    print_test "Health Check" "FAIL" "Server not responding or invalid response"
    echo "   Response: $HEALTH_RESPONSE"
    echo ""
    echo "${RED}Server is not running or not accessible at $BASE_URL${NC}"
    echo "Please ensure:"
    echo "  1. The server is running (npm run dev)"
    echo "  2. Environment variables are set (SUPABASE_URL, SUPABASE_ANON_KEY)"
    echo "  3. The correct port is used (default: 3001)"
    exit 1
fi
echo ""

# Test 2: Login
echo "2. Testing Login..."
LOGIN_DATA="{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"
LOGIN_RESPONSE=$(api_request "POST" "/api/auth/login" "$LOGIN_DATA")

if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
    if [ -z "$TOKEN" ]; then
        TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
    fi
    if [ -n "$TOKEN" ]; then
        print_test "Login" "PASS" "Authentication successful"
        echo "   Token: ${TOKEN:0:50}..."
    else
        print_test "Login" "FAIL" "Login successful but no token found"
        echo "   Response: $LOGIN_RESPONSE"
    fi
else
    print_test "Login" "FAIL" "Login failed"
    echo "   Response: $LOGIN_RESPONSE"
    echo ""
    echo "${YELLOW}Note: If login fails, the user may need to verify their email first.${NC}"
    TOKEN=""
fi
echo ""

if [ -z "$TOKEN" ]; then
    echo "${RED}Cannot continue testing protected endpoints without authentication token.${NC}"
    exit 1
fi

# Test 3: Get User Profile
echo "3. Testing Get User Profile..."
PROFILE_RESPONSE=$(api_request "GET" "/api/user/profile" "" "$TOKEN")
if echo "$PROFILE_RESPONSE" | grep -q '"success":true'; then
    print_test "Get User Profile" "PASS" "Profile retrieved"
else
    print_test "Get User Profile" "FAIL" "Failed to get profile"
    echo "   Response: $PROFILE_RESPONSE"
fi
echo ""

# Test 4: Get Dashboard Summary
echo "4. Testing Get Dashboard Summary..."
DASHBOARD_RESPONSE=$(api_request "GET" "/api/dashboard/summary" "" "$TOKEN")
if echo "$DASHBOARD_RESPONSE" | grep -q '"success":true'; then
    print_test "Get Dashboard Summary" "PASS" "Dashboard data retrieved"
else
    print_test "Get Dashboard Summary" "FAIL" "Failed to get dashboard"
    echo "   Response: $DASHBOARD_RESPONSE"
fi
echo ""

# Test 5: Get Wallet Balance
echo "5. Testing Get Wallet Balance..."
BALANCE_RESPONSE=$(api_request "GET" "/api/wallet/balance" "" "$TOKEN")
if echo "$BALANCE_RESPONSE" | grep -q '"success":true'; then
    print_test "Get Wallet Balance" "PASS" "Balance retrieved"
else
    print_test "Get Wallet Balance" "FAIL" "Failed to get balance"
    echo "   Response: $BALANCE_RESPONSE"
fi
echo ""

# Test 6: Get Wallet Transactions
echo "6. Testing Get Wallet Transactions..."
TX_RESPONSE=$(api_request "GET" "/api/wallet/transactions?limit=10&offset=0" "" "$TOKEN")
if echo "$TX_RESPONSE" | grep -q '"success":true'; then
    print_test "Get Wallet Transactions" "PASS" "Transactions retrieved"
else
    print_test "Get Wallet Transactions" "FAIL" "Failed to get transactions"
    echo "   Response: $TX_RESPONSE"
fi
echo ""

# Test 7: Get Active Escrows
echo "7. Testing Get Active Escrows..."
ACTIVE_ESCROW_RESPONSE=$(api_request "GET" "/api/escrow/active" "" "$TOKEN")
if echo "$ACTIVE_ESCROW_RESPONSE" | grep -q '"success":true'; then
    print_test "Get Active Escrows" "PASS" "Active escrows retrieved"
else
    print_test "Get Active Escrows" "FAIL" "Failed to get active escrows"
    echo "   Response: $ACTIVE_ESCROW_RESPONSE"
fi
echo ""

# Test 8: Get Total Escrowed
echo "8. Testing Get Total Escrowed..."
TOTAL_ESCROW_RESPONSE=$(api_request "GET" "/api/escrow/total" "" "$TOKEN")
if echo "$TOTAL_ESCROW_RESPONSE" | grep -q '"success":true'; then
    print_test "Get Total Escrowed" "PASS" "Total escrowed retrieved"
else
    print_test "Get Total Escrowed" "FAIL" "Failed to get total escrowed"
    echo "   Response: $TOTAL_ESCROW_RESPONSE"
fi
echo ""

# Test 9: Get Escrow List
echo "9. Testing Get Escrow List..."
ESCROW_LIST_RESPONSE=$(api_request "GET" "/api/escrow/list?limit=10&offset=0" "" "$TOKEN")
if echo "$ESCROW_LIST_RESPONSE" | grep -q '"success":true'; then
    print_test "Get Escrow List" "PASS" "Escrow list retrieved"
else
    print_test "Get Escrow List" "FAIL" "Failed to get escrow list"
    echo "   Response: $ESCROW_LIST_RESPONSE"
fi
echo ""

# Test 10: Get Trustiscore
echo "10. Testing Get Trustiscore..."
TRUSTISCORE_RESPONSE=$(api_request "GET" "/api/trustiscore" "" "$TOKEN")
if echo "$TRUSTISCORE_RESPONSE" | grep -q '"success":true'; then
    print_test "Get Trustiscore" "PASS" "Trustiscore retrieved"
else
    print_test "Get Trustiscore" "FAIL" "Failed to get trustiscore"
    echo "   Response: $TRUSTISCORE_RESPONSE"
fi
echo ""

# Test 11: Get Trustiscore Level
echo "11. Testing Get Trustiscore Level..."
TRUSTISCORE_LEVEL_RESPONSE=$(api_request "GET" "/api/trustiscore/level" "" "$TOKEN")
if echo "$TRUSTISCORE_LEVEL_RESPONSE" | grep -q '"success":true'; then
    print_test "Get Trustiscore Level" "PASS" "Trustiscore level retrieved"
else
    print_test "Get Trustiscore Level" "FAIL" "Failed to get trustiscore level"
    echo "   Response: $TRUSTISCORE_LEVEL_RESPONSE"
fi
echo ""

# Test 12: Get Portfolio Performance
echo "12. Testing Get Portfolio Performance..."
PORTFOLIO_RESPONSE=$(api_request "GET" "/api/portfolio/performance?timeframe=monthly" "" "$TOKEN")
if echo "$PORTFOLIO_RESPONSE" | grep -q '"success":true'; then
    print_test "Get Portfolio Performance" "PASS" "Portfolio data retrieved"
else
    print_test "Get Portfolio Performance" "FAIL" "Failed to get portfolio"
    echo "   Response: $PORTFOLIO_RESPONSE"
fi
echo ""

# Test 13: Get Exchange Rates (Public)
echo "13. Testing Get Exchange Rates (Public)..."
EXCHANGE_RESPONSE=$(api_request "GET" "/api/exchange/rates")
if echo "$EXCHANGE_RESPONSE" | grep -q '"success":true'; then
    print_test "Get Exchange Rates" "PASS" "Exchange rates retrieved"
else
    print_test "Get Exchange Rates" "FAIL" "Failed to get exchange rates"
    echo "   Response: $EXCHANGE_RESPONSE"
fi
echo ""

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo "Total: $((TESTS_PASSED + TESTS_FAILED))"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${YELLOW}Some tests failed. Check the output above for details.${NC}"
    exit 1
fi
