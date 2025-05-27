#!/bin/bash

echo "🔍 Monitoring Executive and Manager activity..."
echo "Press Ctrl+C to stop"
echo ""

while true; do
    clear
    echo "=== EXECUTIVE (exec_757845) ==="
    tmux capture-pane -t claude_exec_757845 -p | tail -20
    
    # Check for any manager sessions
    for session in $(tmux list-sessions -F "#{session_name}" | grep "claude_mgr"); do
        echo ""
        echo "=== MANAGER ($session) ==="
        tmux capture-pane -t $session -p | tail -15
    done
    
    # Check for any specialist sessions
    for session in $(tmux list-sessions -F "#{session_name}" | grep "claude_spec"); do
        echo ""
        echo "=== SPECIALIST ($session) ==="
        tmux capture-pane -t $session -p | tail -10
    done
    
    echo ""
    echo "Active tmux sessions: $(tmux list-sessions -F "#{session_name}" | wc -l)"
    echo "Managers: $(tmux list-sessions -F "#{session_name}" | grep -c "mgr")"
    echo "Specialists: $(tmux list-sessions -F "#{session_name}" | grep -c "spec")"
    
    sleep 5
done