#!/bin/bash

# Simple test runner for workflow system
echo "Testing Workflow System..."
echo "========================="

cd "$(dirname "$0")/../.."

# Test 1: Minimal workflow
echo ""
echo "Test 1: Minimal workflow (logs only)"
echo "-------------------------------------"
gtimeout 60 node src/workflow/run_workflow.cjs workflows/tests/test_minimal.yaml 2>/dev/null || node src/workflow/run_workflow.cjs workflows/tests/test_minimal.yaml
test1_result=$?

# Test 2: Script execution
echo ""
echo "Test 2: Script execution workflow"
echo "----------------------------------"
gtimeout 120 node src/workflow/run_workflow.cjs workflows/tests/test_script.yaml 2>/dev/null || node src/workflow/run_workflow.cjs workflows/tests/test_script.yaml
test2_result=$?

# Test 3: File operations
echo ""
echo "Test 3: File operations workflow"
echo "---------------------------------"
gtimeout 120 node src/workflow/run_workflow.cjs workflows/tests/test_file_ops.yaml 2>/dev/null || node src/workflow/run_workflow.cjs workflows/tests/test_file_ops.yaml
test3_result=$?

# Summary
echo ""
echo "Test Results Summary:"
echo "===================="
echo "Test 1 (Minimal): $([ $test1_result -eq 0 ] && echo "PASS" || echo "FAIL")"
echo "Test 2 (Script): $([ $test2_result -eq 0 ] && echo "PASS" || echo "FAIL")"
echo "Test 3 (File Ops): $([ $test3_result -eq 0 ] && echo "PASS" || echo "FAIL")"

# Overall result
if [ $test1_result -eq 0 ] && [ $test2_result -eq 0 ] && [ $test3_result -eq 0 ]; then
    echo ""
    echo "✅ ALL TESTS PASSED!"
    exit 0
else
    echo ""
    echo "❌ SOME TESTS FAILED"
    exit 1
fi