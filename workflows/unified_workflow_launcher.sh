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

# Check if there's already an active instance we can use
EXISTING_INSTANCE=$(cat ../state/instances.json 2>/dev/null | jq -r '.instances | to_entries | sort_by(.value.created) | last | .key' || echo "")
if [ -n "$EXISTING_INSTANCE" ] && [ "$EXISTING_INSTANCE" != "null" ] && tmux has-session -t "claude_$EXISTING_INSTANCE" 2>/dev/null; then
    echo -e "${YELLOW}Found existing active instance: $EXISTING_INSTANCE${NC}"
    echo -e "${YELLOW}Will reuse it for this task. To force a new instance:${NC}"
    echo "  1. Kill it first: tmux kill-session -t claude_$EXISTING_INSTANCE"
    echo "  2. Run this script again"
fi

# Get count of instances before spawning
BEFORE_COUNT=$(cat ../state/instances.json 2>/dev/null | jq -r '.instances | length' || echo "0")
echo "Current instance count: $BEFORE_COUNT"

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
    # Wait for instance count to increase
    WAIT_COUNT=0
    MAX_WAIT=60  # 5 minutes max
    
    while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
        CURRENT_COUNT=$(cat ../state/instances.json 2>/dev/null | jq -r '.instances | length' || echo "0")
        if [ "$CURRENT_COUNT" -gt "$BEFORE_COUNT" ]; then
            echo "New instance detected! (count: $BEFORE_COUNT → $CURRENT_COUNT)"
            echo "Waiting for it to be fully ready..."
            sleep 10  # Extra time for Claude to fully initialize
            break
        fi
        echo "Still waiting for instance spawn... ($((WAIT_COUNT * 5))s elapsed)"
        sleep 5
        ((WAIT_COUNT++))
    done
    
    if [ "$CURRENT_COUNT" -le "$BEFORE_COUNT" ]; then
        echo -e "${YELLOW}Warning: No new instance detected. Will use most recent existing instance.${NC}"
        # Don't wait for workflow to complete if no new instance
        kill $WORKFLOW_PID 2>/dev/null || true
    fi
else
    sleep 10
fi

# Step 2: Find the instance first
echo -e "\n${GREEN}Step 2: Finding instance...${NC}"

# Try to get instance ID with retries
RETRY_COUNT=0
MAX_RETRIES=30  # Increased for long spawn times
INSTANCE_ID=""

# For phase spawns, wait a bit longer
if [ "$PRESET" = "--preset phase" ]; then
    echo "Waiting additional time for phase instance to be ready..."
    sleep 5
fi

while [ $RETRY_COUNT -lt $MAX_RETRIES ] && [ -z "$INSTANCE_ID" ]; do
    # Get the most recent instance ID from the state file
    INSTANCE_ID=$(cat ../state/instances.json 2>/dev/null | jq -r '.instances | to_entries | sort_by(.value.created) | last | .key' || echo "")
    
    if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" = "null" ]; then
        echo "Still waiting for instance... (attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)"
        sleep 3
        ((RETRY_COUNT++))
    else
        # Verify instance exists in tmux
        if tmux has-session -t "claude_$INSTANCE_ID" 2>/dev/null; then
            break
        else
            echo "Instance $INSTANCE_ID found in state but tmux session not ready yet..."
            INSTANCE_ID=""
            sleep 3
            ((RETRY_COUNT++))
        fi
    fi
done

if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" = "null" ]; then
    echo -e "${YELLOW}⚠️  Warning: Could not find instance ID${NC}"
    echo "Cannot continue without instance. Exiting..."
    exit 1
fi

echo -e "${GREEN}✅ Found instance: $INSTANCE_ID${NC}"

# Step 3: Start task in background
echo -e "\n${GREEN}Step 3: Starting task monitor in background...${NC}"
echo "Task: \"$TASK\""

# Change to workflows directory if not already there
cd "$(dirname "$0")"

# Create a log file for task output
TASK_LOG="/tmp/unified_workflow_task_${INSTANCE_ID}.log"

# Run task with or without preset in background
if [ -n "$PRESET" ]; then
    echo "Running with preset: $PRESET"
    echo -e "${YELLOW}Note: Task will monitor for keywords to progress through phases${NC}"
    echo -e "${YELLOW}Keywords: EXECUTE_FINISHED → COMPARISON_FINISHED → DUPLICATION_ELIMINATED → COMMIT_FINISHED${NC}"
    echo -e "${YELLOW}Task monitor output will be logged to: $TASK_LOG${NC}"
    nohup ./task "$TASK" $PRESET > "$TASK_LOG" 2>&1 &
else
    echo "Running without preset"
    nohup ./task "$TASK" > "$TASK_LOG" 2>&1 &
fi
TASK_PID=$!

echo -e "${GREEN}✅ Task monitor started (PID: $TASK_PID)${NC}"

# Step 4: Attach to tmux session
echo -e "\n${GREEN}Step 4: Attaching to tmux session...${NC}"
echo -e "${YELLOW}Press Ctrl+B then D to detach from tmux${NC}"
echo -e "${YELLOW}The task monitor continues running in background after you detach${NC}\n"

# Give a moment before attaching
sleep 1

# Attach to tmux session
tmux attach -t "claude_$INSTANCE_ID"

# After detaching, show status
echo -e "\n${GREEN}Detached from tmux session${NC}"
echo "Task monitor is still running in background (PID: $TASK_PID)"
echo "To check task progress: tail -f $TASK_LOG"
echo "To reattach to Claude: tmux attach -t claude_$INSTANCE_ID"

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    [ -n "$WORKFLOW_PID" ] && kill $WORKFLOW_PID 2>/dev/null || true
    # Don't kill task - let it continue monitoring in background
    # [ -n "$TASK_PID" ] && kill $TASK_PID 2>/dev/null || true
}

# Set trap for cleanup
trap cleanup EXIT