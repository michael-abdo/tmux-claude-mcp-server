#!/bin/bash

# Script to restart stuck projects
# These are projects with requirements but no implementation

echo "🔄 Batch Project Restart Script"
echo "================================"

# Function to restart a project
restart_project() {
    local project_dir="$1"
    local project_id=$(basename "$project_dir")
    
    echo ""
    echo "📦 Restarting project: $project_id"
    
    # Check if instructions.md or requirements.md exists
    if [ -f "$project_dir/instructions.md" ]; then
        req_file="instructions.md"
    elif [ -f "$project_dir/requirements.md" ]; then
        req_file="requirements.md"
    else
        echo "  ⚠️  No requirements file found, skipping"
        return
    fi
    
    # Check if implementation files exist
    if [ -f "$project_dir/index.html" ] || [ -f "$project_dir/main.py" ] || [ -f "$project_dir/app.py" ]; then
        echo "  ✅ Implementation files exist, skipping"
        return
    fi
    
    # Kill existing session if any
    if [ -f "$project_dir/.tmux_session_info.json" ]; then
        session_id=$(grep '"sessionId"' "$project_dir/.tmux_session_info.json" | cut -d'"' -f4)
        if [ ! -z "$session_id" ]; then
            echo "  🔪 Killing existing session: $session_id"
            tmux kill-session -t "$session_id" 2>/dev/null || true
        fi
    fi
    
    # Spawn new executive
    echo "  🚀 Spawning new executive with $req_file"
    node /Users/Mike/.claude/user/tmux-claude-mcp-server/scripts/api/spawn_project_executive.js \
        --project-dir "$project_dir" \
        --project-type web-app \
        --requirements-file "$req_file"
    
    echo "  ✅ Restarted successfully"
    sleep 2  # Brief pause between spawns
}

# Projects to restart (those without active implementations)
projects=(
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021919090362430743538"
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021920099030637438030"
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021921346257338424716"
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021921831981138262614"
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021922023501463108382"
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021922290495470175836"
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021922559710814724022"
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021923422940263632391"
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021923506750086859741"
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021924483133534911842"
)

# Process each project
for project in "${projects[@]}"; do
    restart_project "$project"
done

echo ""
echo "✅ Batch restart complete!"
echo ""
echo "Monitor progress with:"
echo "node /Users/Mike/.claude/user/tmux-claude-mcp-server/scripts/api/monitor_all_projects.js --scan-dir /Users/Mike/Desktop/programming/2_proposals/upwork"