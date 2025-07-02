#!/bin/bash
set -e

# Ensure we're in the correct directory
cd /Users/Mike/.claude/user/tmux-claude-mcp-server

echo "🚀 Creating fresh Claude instance with keyword monitoring..."

# Create unique workspace
TIMESTAMP=$(date +%s)
WORKDIR="/tmp/test_keyword_$TIMESTAMP"

# Spawn new instance
echo "📱 Spawning new specialist instance..."
export PATH="/bin:/usr/bin:$PATH"
SPAWN_RESULT=$(env SHELL=/bin/bash node scripts/mcp_bridge.js spawn "{
  \"role\": \"specialist\", 
  \"workDir\": \"$WORKDIR\", 
  \"context\": \"You are a helpful specialist. Always be conversational and end responses with DONE when you complete a task.\"
}")

# Extract details
INSTANCE_ID=$(echo "$SPAWN_RESULT" | jq -r '.instanceId')
SESSION_NAME=$(echo "$SPAWN_RESULT" | jq -r '.sessionName')

echo "✅ Created instance: $INSTANCE_ID"
echo "📁 Working directory: $WORKDIR"
echo ""
echo "📱 COPY AND RUN THIS COMMAND IN A NEW TERMINAL:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "tmux attach-session -t $SESSION_NAME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎯 This monitor will detect when you type 'DONE' in your messages"
echo "🛑 Press Ctrl+C to stop monitoring and cleanup"
echo ""
echo "⏳ Waiting for Claude to initialize..."
sleep 3

# Start monitoring
echo "🔍 Starting keyword monitor..."
node scripts/workflow_monitor.cjs watch "$INSTANCE_ID" "DONE:./workflows/examples/persistent_response.yaml"

# Cleanup on exit
echo ""
echo "🧹 Cleaning up instance: $INSTANCE_ID"
node scripts/mcp_bridge.js terminate "{\"instanceId\": \"$INSTANCE_ID\"}" || true
echo "✅ Cleanup complete!"