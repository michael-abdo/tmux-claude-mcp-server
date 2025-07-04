#!/bin/bash

# Phase Launcher - Spawns instance and runs phase workflow
# Usage: ./phase_launcher.sh "your task here"

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TASK="${1:-create a file with the text 123 in it}"

echo -e "${BLUE}🚀 Phase Implementation Launcher${NC}"
echo -e "${BLUE}==============================${NC}\n"

# Step 1: Clean up and prepare
echo -e "${GREEN}Step 1: Preparing environment...${NC}"
pkill -f "node.*workflow" 2>/dev/null || true
rm -f workflow_context.json 2>/dev/null || true
mkdir -p ../state
echo '{"instances":{}}' > ../state/instances.json

# Step 2: Spawn instance
echo -e "\n${GREEN}Step 2: Spawning Claude instance...${NC}"
echo "This may take 2-3 minutes for git operations..."

SPAWN_OUTPUT=$(node ../scripts/mcp_bridge.js spawn '{
  "role": "specialist",
  "workDir": "'$(pwd)'",
  "context": "Phase implementation specialist"
}' 2>&1)

# Extract instance ID from spawn output
INSTANCE_ID=$(echo "$SPAWN_OUTPUT" | grep -o '"instanceId":"[^"]*"' | cut -d'"' -f4)

if [ -z "$INSTANCE_ID" ]; then
    echo -e "${YELLOW}Failed to extract instance ID from spawn output${NC}"
    echo "Spawn output: $SPAWN_OUTPUT"
    exit 1
fi

echo -e "${GREEN}✅ Instance spawned: $INSTANCE_ID${NC}"

# Step 3: Run phase task
echo -e "\n${GREEN}Step 3: Starting phase implementation...${NC}"
echo "Task: \"$TASK\""

# Create config for phase task
cat > .phase_task_config.json << EOF
{
  "instanceId": "$INSTANCE_ID",
  "taskDescription": "$TASK",
  "chains": $(cat ../config/phase_implementation_workflow.json | jq '.chains'),
  "initialPrompt": $(cat ../config/phase_implementation_workflow.json | jq '.initialPrompt'),
  "options": $(cat ../config/phase_implementation_workflow.json | jq '.options // {}')
}
EOF

# Run task chain
node task_chain_launcher.js .phase_task_config.json &
TASK_PID=$!

# Step 4: Attach to instance
echo -e "\n${GREEN}Step 4: Attaching to Claude instance...${NC}"
echo -e "${YELLOW}Press Ctrl+B then D to detach from tmux${NC}\n"
sleep 2

tmux attach -t "claude_$INSTANCE_ID"

# Cleanup
cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    rm -f .phase_task_config.json
    [ -n "$TASK_PID" ] && kill $TASK_PID 2>/dev/null || true
}

trap cleanup EXIT