#!/bin/bash

echo "🚀 Starting Persistent Monitor Test"
echo "=================================="

# Start the monitor in background
echo "📡 Starting workflow monitor..."
node scripts/workflow_monitor.cjs watch spec_1_1_785691 \
  "TRIGGER_COMMAND:workflows/examples/persistent_response.yaml" \
  "EXECUTE_CHAIN:workflows/examples/persistent_chain.yaml" &

MONITOR_PID=$!
echo "Monitor PID: $MONITOR_PID"

# Wait for monitor to start
sleep 3

# Send test triggers
echo -e "\n📤 Sending TRIGGER_COMMAND..."
node scripts/mcp_bridge.js send '{"instanceId": "spec_1_1_785691", "text": "TRIGGER_COMMAND"}'

echo -e "\n⏳ Waiting 5 seconds..."
sleep 5

echo -e "\n📤 Sending EXECUTE_CHAIN..."
node scripts/mcp_bridge.js send '{"instanceId": "spec_1_1_785691", "text": "EXECUTE_CHAIN"}'

echo -e "\n⏳ Waiting 5 seconds..."
sleep 5

echo -e "\n📤 Sending TRIGGER_COMMAND again..."
node scripts/mcp_bridge.js send '{"instanceId": "spec_1_1_785691", "text": "TRIGGER_COMMAND"}'

echo -e "\n⏳ Waiting 5 seconds..."
sleep 5

# Check logs if they exist
if [ -f logs/workflow_monitor.log ]; then
    echo -e "\n📋 Monitor Log:"
    cat logs/workflow_monitor.log
fi

# Kill the monitor
echo -e "\n🛑 Stopping monitor..."
kill $MONITOR_PID 2>/dev/null

echo -e "\n✅ Test complete!"