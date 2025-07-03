#!/bin/bash
# Check for the specific tmux session and send Enter if it exists

SESSION_NAME="claude_exec_1749369856326"

# Check if session exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "Session $SESSION_NAME exists"
    
    # Send Enter key
    tmux send-keys -t "$SESSION_NAME" Enter
    echo "Sent Enter key to session $SESSION_NAME"
else
    echo "Session $SESSION_NAME does not exist"
fi

# List all tmux sessions
echo ""
echo "All tmux sessions:"
tmux list-sessions 2>/dev/null || echo "No tmux sessions found"

# Look for any claude_exec sessions with long timestamps
echo ""
echo "Looking for claude_exec sessions with long timestamps:"
tmux list-sessions 2>/dev/null | grep -E "claude_exec_[0-9]{13}" || echo "No matching sessions found"