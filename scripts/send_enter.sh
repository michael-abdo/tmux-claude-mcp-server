#!/bin/bash
# Send Enter key to all tmux sessions

echo "Listing tmux sessions..."
sessions=$(tmux list-sessions 2>/dev/null | cut -d: -f1)

if [ -z "$sessions" ]; then
    echo "No tmux sessions found."
    exit 0
fi

count=0
total=$(echo "$sessions" | wc -l | tr -d ' ')

echo "Found $total tmux sessions:"
echo "$sessions" | while read -r session; do
    echo "  - $session"
done

echo ""
echo "Sending Enter key to each session..."

success=0
echo "$sessions" | while read -r session; do
    if tmux send-keys -t "$session" Enter 2>/dev/null; then
        echo "✓ Sent Enter to session: $session"
        ((success++))
    else
        echo "✗ Failed to send Enter to session: $session"
    fi
    ((count++))
done

echo ""
echo "Summary: Processed $count sessions"

# Special focus on claude_exec_* sessions
exec_sessions=$(echo "$sessions" | grep '^claude_exec_' || true)
if [ -n "$exec_sessions" ]; then
    exec_count=$(echo "$exec_sessions" | wc -l | tr -d ' ')
    echo ""
    echo "Found $exec_count claude_exec_* sessions that were updated:"
    echo "$exec_sessions" | while read -r session; do
        echo "  - $session"
    done
fi