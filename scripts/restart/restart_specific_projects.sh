#!/bin/bash

# Restart Specific Projects Script
# Restarts two specific projects with tilde (~) prefixes

set -e

PROJECT_SPAWNER="/Users/Mike/.claude/user/tmux-claude-mcp-server/scripts/api/spawn_project_executive.js"

echo "🔄 Restarting specific projects..."
echo

# Project 1: ~021929506694170832611
PROJECT1_DIR="/Users/Mike/Desktop/programming/2_proposals/upwork/~021929506694170832611"
PROJECT1_SESSION="claude_exec_1749140389829"

echo "📁 Project 1: ~021929506694170832611"
echo "Current session: $PROJECT1_SESSION"

# Kill existing session if it exists
if tmux has-session -t "$PROJECT1_SESSION" 2>/dev/null; then
    echo "🛑 Killing existing session: $PROJECT1_SESSION"
    tmux kill-session -t "$PROJECT1_SESSION"
    sleep 2
else
    echo "ℹ️ No existing session found"
fi

echo "🚀 Starting new executive for project 1..."
node "$PROJECT_SPAWNER" \
    --project-dir "$PROJECT1_DIR" \
    --project-type web-app \
    --requirements-file instructions.md

echo "✅ Project 1 restarted"
echo

# Project 2: ~021929597245880692451
PROJECT2_DIR="/Users/Mike/Desktop/programming/2_proposals/upwork/~021929597245880692451"
PROJECT2_SESSION="claude_exec_1749140212897"

echo "📁 Project 2: ~021929597245880692451"
echo "Current session: $PROJECT2_SESSION"

# Kill existing session if it exists
if tmux has-session -t "$PROJECT2_SESSION" 2>/dev/null; then
    echo "🛑 Killing existing session: $PROJECT2_SESSION"
    tmux kill-session -t "$PROJECT2_SESSION"
    sleep 2
else
    echo "ℹ️ No existing session found"
fi

echo "🚀 Starting new executive for project 2..."
node "$PROJECT_SPAWNER" \
    --project-dir "$PROJECT2_DIR" \
    --project-type web-app \
    --requirements-file instructions.md

echo "✅ Project 2 restarted"
echo

echo "🎉 Both projects have been successfully restarted!"
echo
echo "📊 To monitor all projects:"
echo "node /Users/Mike/.claude/user/tmux-claude-mcp-server/scripts/api/monitor_all_projects.js --scan-dir /Users/Mike/Desktop/programming/2_proposals/upwork"