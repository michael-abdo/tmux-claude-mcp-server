#!/bin/bash

echo "🧪 Running Complete Test Suite for tmux-claude MCP Server"
echo "========================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test
run_test() {
    local test_name=$1
    local test_file=$2
    local timeout=${3:-30}  # Default 30 seconds timeout
    
    echo -e "${YELLOW}Running: $test_name${NC}"
    
    # Run test (without timeout on macOS)
    if node $test_file > /tmp/test_output.log 2>&1; then
        # Check if test actually passed by looking for success indicators
        if grep -q -E "(All.*tests passed|✅|pass [1-9]|All.*features working correctly|Demo Complete|Cleanup complete)" /tmp/test_output.log; then
            echo -e "${GREEN}✅ PASSED: $test_name${NC}"
            # Show summary if available
            grep -E "(Tests passed:|Total tests:|Summary)" /tmp/test_output.log | head -3
            ((PASSED_TESTS++))
        else
            echo -e "${RED}❌ FAILED: $test_name (no success indicators)${NC}"
            # Show last few lines of output
            tail -5 /tmp/test_output.log
            ((FAILED_TESTS++))
        fi
    else
        echo -e "${RED}❌ FAILED: $test_name (timeout or error)${NC}"
        # Show last few lines of output
        tail -5 /tmp/test_output.log
        ((FAILED_TESTS++))
    fi
    
    ((TOTAL_TESTS++))
    echo ""
}

# Phase 2 Tests
echo "📋 Phase 2 Tests (Basic MCP Functionality)"
echo "----------------------------------------"
run_test "Basic Test" "tests/integration/basic_test.js" 10
run_test "Integration Test" "tests/integration/integration_test.js" 20

# Phase 3 Tests  
echo "📋 Phase 3 Tests (Parallel Execution & Redis)"
echo "-------------------------------------------"
run_test "Phase 3 Integration" "tests/integration/phase3_integration_test.js" 20
run_test "Phase 3 Parallel Demo" "tests/e2e/phase3_parallel_demo.js" 15
run_test "Auto Recovery" "tests/e2e/test_auto_recovery.js" 20

# Phase 4 Tests
echo "📋 Phase 4 Tests (Architectural Alignment)"
echo "----------------------------------------"
run_test "Phase 4 Quick Test" "tests/e2e/test_phase4_quick.js" 10

# Summary
echo "========================================================="
echo "📊 Test Summary"
echo "========================================================="
echo -e "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed! The tmux-claude MCP server is working correctly.${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️  Some tests failed. Please check the output above.${NC}"
    exit 1
fi