#!/bin/bash

# Simple test without MCP spawn
SESSION_NAME="test_simple_$(date +%s)"

echo "🚀 Creating simple tmux session with Claude..."
echo "Session: $SESSION_NAME"

# Create tmux session with Claude directly
tmux new-session -d -s "$SESSION_NAME" "claude --project /tmp/simple_test"

echo "✅ Session created: $SESSION_NAME"
echo ""
echo "📱 COPY AND RUN THIS COMMAND IN A NEW TERMINAL:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "tmux attach-session -t $SESSION_NAME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎯 Now start monitoring with:"
echo "cd /Users/Mike/.claude/user/tmux-claude-mcp-server && node src/workflow/keyword_monitor.cjs --instanceId $SESSION_NAME --keyword DONE --simpleMode true"
echo ""
echo "🛑 To cleanup: tmux kill-session -t $SESSION_NAME"