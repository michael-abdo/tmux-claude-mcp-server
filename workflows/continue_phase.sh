#!/bin/bash

# Continue Phase - Sends the next instruction in the phase workflow
# Usage: ./continue_phase.sh [instance_id]

INSTANCE_ID="${1:-$(node ../scripts/mcp_bridge.js list '{}' 2>&1 | jq -r '.instances[-1].instanceId')}"

if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" = "null" ]; then
    echo "❌ No instance found. Please provide instance ID."
    exit 1
fi

echo "📋 Continuing phase workflow for instance: $INSTANCE_ID"

# Read the phase workflow to get the comparison instruction
COMPARISON_INSTRUCTION=$(cat phase_implementation_workflow.json | jq -r '.chains[0].instruction')

echo "📨 Sending comparison instruction..."
node ../scripts/mcp_bridge.js send "{
  \"instanceId\": \"$INSTANCE_ID\",
  \"text\": \"$COMPARISON_INSTRUCTION\"
}" 2>&1

echo ""
echo "✅ Comparison instruction sent!"
echo ""
echo "Next keywords in sequence:"
echo "1. COMPARISON_FINISHED"
echo "2. DUPLICATION_ELIMINATED"
echo "3. COMMIT_FINISHED"
echo ""
echo "To attach to the instance:"
echo "tmux attach -t claude_$INSTANCE_ID"