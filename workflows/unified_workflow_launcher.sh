#!/bin/bash

# Unified Workflow Launcher - Combines workflow, task, and attach in one script
# Usage: ./unified_workflow_launcher.sh "your task here" [workflow_file]

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
DEFAULT_WORKFLOW="examples/test_keyword_mechanism.yaml"

# Parse arguments
if [ "$#" -eq 0 ]; then
    TASK="create a file with the text 123 in it"
    WORKFLOW="$DEFAULT_WORKFLOW"
    PRESET=""
elif [ "$2" = "--preset" ] && [ "$3" = "phase" ]; then
    # Handle --preset phase option
    TASK="$1"
    WORKFLOW=""  # No workflow needed for preset phase
    PRESET="--preset phase"
else
    TASK="${1:-create a file with the text 123 in it}"
    WORKFLOW="${2:-$DEFAULT_WORKFLOW}"
    PRESET=""
fi

echo -e "${BLUE}🚀 Unified Workflow Launcher${NC}"
echo -e "${BLUE}=========================${NC}\n"

# Step 1: Clean up and start workflow (if needed)
echo -e "${GREEN}Step 1: Starting system...${NC}"
pkill -f "node.*workflow" 2>/dev/null || true
rm -f workflow_context.json 2>/dev/null || true

# DON'T create fresh instances.json - it wipes out existing instances!
# Just ensure the state directory exists
mkdir -p ../state

echo "Using existing state/instances.json"

# Always use phase workflow for preset phase
if [ "$PRESET" = "--preset phase" ]; then
    WORKFLOW="examples/phase_workflow.yaml"
fi

# Start workflow in background with error logging
echo "Starting workflow: $WORKFLOW"
node ../src/workflow/run_workflow.cjs "$WORKFLOW" 2>&1 | tee workflow.log &
WORKFLOW_PID=$!

# Wait for workflow to initialize
echo "Waiting for workflow to initialize and spawn instance..."
echo -e "${YELLOW}Note: First spawn may take 2-3 minutes (git operations)...${NC}"

# For preset phase, we need to wait for the instance to be fully ready
if [ "$PRESET" = "--preset phase" ]; then
    echo "Waiting for instance spawn to complete..."
    # Wait for instance to appear in the list
    WAIT_COUNT=0
    MAX_WAIT=60  # 5 minutes max
    while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
        INSTANCE_CHECK=$(node ../scripts/mcp_bridge.js list '{}' 2>&1 | jq -r '.instances[-1].instanceId' 2>/dev/null || echo "")
        if [ -n "$INSTANCE_CHECK" ] && [ "$INSTANCE_CHECK" != "null" ]; then
            echo "Instance $INSTANCE_CHECK detected, waiting for it to be fully ready..."
            sleep 20  # Extra time for Claude to fully initialize and MCP bridge to sync
            break
        fi
        echo "Still waiting for instance spawn... ($((WAIT_COUNT * 5))s elapsed)"
        sleep 5
        ((WAIT_COUNT++))
    done
else
    sleep 10
fi

# Step 2: Run task
echo -e "\n${GREEN}Step 2: Launching task...${NC}"
echo "Task: \"$TASK\""

# Change to workflows directory if not already there
cd "$(dirname "$0")"

# Run task with or without preset
if [ -n "$PRESET" ]; then
    echo "Running with preset: $PRESET"
    echo -e "${YELLOW}Note: Task will monitor for keywords to progress through phases${NC}"
    echo -e "${YELLOW}Keywords: EXECUTE_FINISHED → COMPARISON_FINISHED → DUPLICATION_ELIMINATED → COMMIT_FINISHED${NC}"
    ./task "$TASK" $PRESET &
else
    echo "Running without preset"
    ./task "$TASK" &
fi
TASK_PID=$!

# Wait a moment for task to start
sleep 2

# Step 3: Find and attach to instance
echo -e "\n${GREEN}Step 3: Finding instance to attach...${NC}"

# Try to get instance ID with retries
RETRY_COUNT=0
MAX_RETRIES=30  # Increased for long spawn times
INSTANCE_ID=""

# First wait a bit longer for spawn to complete
echo "Waiting for instance spawn to complete (this may take 2-3 minutes)..."
sleep 10

while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ -z "$INSTANCE_ID" ]; do
    INSTANCE_ID=$(node ../scripts/mcp_bridge.js list '{}' 2>/dev/null | jq -r '.instances[-1].instanceId' 2>/dev/null || echo "")
    
    if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" = "null" ]; then
        echo "Still waiting for instance... (attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)"
        sleep 5  # Increased wait time
        ((RETRY_COUNT++))
    else
        break
    fi
done

if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" = "null" ]; then
    echo -e "${YELLOW}⚠️  Warning: Could not find instance ID${NC}"
    echo "You may need to manually attach using:"
    echo "  tmux ls"
    echo "  tmux attach -t claude_<instance_id>"
else
    echo -e "${GREEN}✅ Found instance: $INSTANCE_ID${NC}"
    echo -e "\n${BLUE}Attaching to tmux session...${NC}"
    echo -e "${YELLOW}Press Ctrl+B then D to detach from tmux${NC}\n"
    
    # Give a moment before attaching
    sleep 1
    
    # Attach to tmux session
    tmux attach -t "claude_$INSTANCE_ID"
fi

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    [ -n "$WORKFLOW_PID" ] && kill $WORKFLOW_PID 2>/dev/null || true
    [ -n "$TASK_PID" ] && kill $TASK_PID 2>/dev/null || true
}

# Set trap for cleanup
trap cleanup EXIT