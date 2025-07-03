#!/bin/bash

# Start a single project instance
PROJECT_DIR="/Users/Mike/Desktop/programming/2_proposals/upwork/submitting/021930531716804018443"
SPAWNER="/Users/Mike/.claude/user/tmux-claude-mcp-server/scripts/api/spawn_project_executive.js"

echo "🚀 Starting instance for project: 021930531716804018443"
echo "📁 Location: $PROJECT_DIR"

node "$SPAWNER" \
    --project-dir "$PROJECT_DIR" \
    --project-type web-app \
    --requirements-file instructions.md

echo "✅ Instance started!"
echo "📊 Monitor with: node /Users/Mike/.claude/user/tmux-claude-mcp-server/scripts/api/monitor_all_projects.js"