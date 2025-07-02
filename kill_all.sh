#\!/bin/bash

echo "🧹 Killing all tmux sessions and monitoring processes..."

# Kill monitoring processes
echo "🔍 Stopping monitors..."
pkill -f "workflow_monitor" 2>/dev/null && echo "  ✅ Workflow monitors killed" || echo "  ℹ️  No workflow monitors running"
pkill -f "keyword_monitor" 2>/dev/null && echo "  ✅ Keyword monitors killed" || echo "  ℹ️  No keyword monitors running"

# Kill MCP bridge processes
echo "🌉 Stopping MCP bridge processes..."
pkill -f "mcp_bridge" 2>/dev/null && echo "  ✅ MCP bridge processes killed" || echo "  ℹ️  No MCP bridge processes running"

# Kill all tmux sessions
echo "📱 Killing tmux sessions..."
tmux kill-server 2>/dev/null && echo "  ✅ All tmux sessions killed" || echo "  ℹ️  No tmux sessions running"


# Clean monitoring config
echo "⚙️  Cleaning monitor config..."
echo '{"monitors": [], "savedAt": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'"}' > /Users/Mike/.claude/user/tmux-claude-mcp-server/config/workflow_monitors.json
echo "  ✅ Monitor config cleared"

# Clean up temp directories
echo "🗂️  Cleaning temp directories..."
rm -rf /tmp/test_keyword_* /tmp/keyword_test_* 2>/dev/null && echo "  ✅ Temp directories cleaned" || echo "  ℹ️  No temp directories found"

echo ""
echo "🎯 Complete cleanup finished!"
echo "   - All tmux sessions: killed"
echo "   - All monitors: stopped"  
echo "   - Claude processes: not touched"
echo "   - Config files: reset"
echo "   - Temp files: cleaned"
echo ""
EOF < /dev/null