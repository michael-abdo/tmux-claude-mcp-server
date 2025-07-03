#!/bin/bash

echo "🎯 Persistent Workflow Monitor Demo"
echo "===================================="
echo ""
echo "This demo shows how to set up persistent monitoring that triggers"
echo "workflows whenever Claude responds with specific keywords."
echo ""

# Check if instance exists
if ! tmux has-session -t claude_spec_1_1_785691 2>/dev/null; then
    echo "❌ Instance spec_1_1_785691 not found. Please start an instance first."
    exit 1
fi

echo "📡 Starting persistent monitor for spec_1_1_785691..."
echo "    Watching for: TRIGGER_COMMAND → persistent_response.yaml"
echo "    Watching for: EXECUTE_CHAIN → persistent_chain.yaml"
echo ""

# Start monitor in background
node scripts/workflow_monitor.cjs watch spec_1_1_785691 \
  "TRIGGER_COMMAND:workflows/examples/persistent_response.yaml" \
  "EXECUTE_CHAIN:workflows/examples/persistent_chain.yaml" &

MONITOR_PID=$!
echo "✅ Monitor started (PID: $MONITOR_PID)"
echo ""

# Function to safely stop monitor
cleanup() {
    echo -e "\n🛑 Stopping monitor..."
    kill $MONITOR_PID 2>/dev/null
    wait $MONITOR_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

echo "📋 Usage Instructions:"
echo "======================"
echo ""
echo "1. Attach to your Claude instance:"
echo "   tmux attach -t claude_spec_1_1_785691"
echo ""
echo "2. In the Claude session, type these keywords to trigger workflows:"
echo "   → TRIGGER_COMMAND  (triggers persistent response workflow)"
echo "   → EXECUTE_CHAIN    (triggers multi-step chain workflow)"
echo ""
echo "3. Watch this terminal for workflow launch notifications"
echo ""
echo "4. Check logs: tail -f logs/workflow_monitor.log"
echo ""
echo "🔄 The monitor will keep running and detect keywords repeatedly!"
echo ""
echo "Press Ctrl+C to stop the monitor."
echo ""

# Keep script running
while true; do
    sleep 1
done