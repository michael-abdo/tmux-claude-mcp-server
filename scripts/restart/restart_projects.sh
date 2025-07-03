#!/bin/bash

# Restart Projects Script
# This script restarts the two specified projects

echo "Restarting project 1..."
node /Users/Mike/.claude/user/tmux-claude-mcp-server/scripts/api/spawn_project_executive.js \
  --project-dir "/Users/Mike/Desktop/programming/2_proposals/upwork/~021929506694170832611" \
  --project-type web-app \
  --requirements-file instructions.md

echo "Restarting project 2..."
node /Users/Mike/.claude/user/tmux-claude-mcp-server/scripts/api/spawn_project_executive.js \
  --project-dir "/Users/Mike/Desktop/programming/2_proposals/upwork/~021929597245880692451" \
  --project-type web-app \
  --requirements-file instructions.md

echo "Both projects restarted successfully!"