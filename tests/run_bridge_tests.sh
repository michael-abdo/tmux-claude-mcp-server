#!/bin/bash
#
# MCP Bridge Test Suite Runner
# Runs all bridge tests and reports results
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Helper function to run a test
run_test() {
    local test_name=$1
    local test_file=$2
    local test_type=$3
    
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Running: ${test_name}${NC}"
    echo -e "Type: ${test_type}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if node "$test_file"; then
        echo -e "\n${GREEN}✅ ${test_name} PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "\n${RED}❌ ${test_name} FAILED${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Main test execution
main() {
    echo -e "${YELLOW}🌉 MCP Bridge Comprehensive Test Suite${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "Starting test suite at $(date)"
    echo ""
    
    # Check if we're in the right directory
    if [ ! -f "scripts/mcp_bridge.js" ]; then
        echo -e "${RED}Error: Must run from tmux-claude-mcp-server root directory${NC}"
        exit 1
    fi
    
    # Create logs directory
    mkdir -p logs/test-results
    LOG_FILE="logs/test-results/bridge-tests-$(date +%Y%m%d-%H%M%S).log"
    
    echo "Logging to: $LOG_FILE"
    echo ""
    
    # Run tests in order of complexity
    {
        # 1. Unit Tests
        run_test "Unit Tests" "tests/unit/test_mcp_bridge.js" "Unit"
        
        # 2. Integration Tests
        run_test "Integration Tests" "tests/integration/test_bridge_orchestration.js" "Integration"
        
        # 3. Error Scenario Tests
        run_test "Error Scenarios" "tests/e2e/test_bridge_error_scenarios.js" "Error Handling"
        
        # 4. End-to-End Tests
        run_test "E2E Hierarchy Test" "tests/e2e/test_bridge_hierarchy.js" "End-to-End"
        
        # 5. Performance Tests (light stress test by default)
        echo -e "\n${YELLOW}Note: Running light stress test. Use 'npm test:stress:heavy' for full stress test${NC}"
        run_test "Stress Test (Light)" "tests/performance/test_bridge_stress.js light" "Performance"
        
    } 2>&1 | tee "$LOG_FILE"
    
    # Summary
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}📊 Test Suite Summary${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "Total Tests Run: ${TOTAL_TESTS}"
    echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
    echo -e "${RED}Failed: ${FAILED_TESTS}${NC}"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests passed! The MCP Bridge is working correctly.${NC}"
        echo -e "${GREEN}The Bridge IS the Architecture! 🌉${NC}"
        exit 0
    else
        echo -e "${RED}❌ Some tests failed. Please check the log file for details.${NC}"
        echo -e "Log file: $LOG_FILE"
        exit 1
    fi
}

# Run main function
main