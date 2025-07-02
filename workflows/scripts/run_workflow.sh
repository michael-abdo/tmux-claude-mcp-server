#!/bin/bash

# Workflow Runner for Execute-Compare-Commit Chain

FEATURE_NAME="${1:-Feature Implementation}"
PHASE_FILE="${2:-phase.md}"

echo "Starting workflow for: $FEATURE_NAME"
echo "Phase file: $PHASE_FILE"
echo ""

# Function to send prompt to Claude
send_to_claude() {
    local prompt_file=$1
    local marker=$2
    
    echo "=== Sending prompt from $prompt_file ==="
    cat "$prompt_file"
    echo ""
    echo "Waiting for: $marker"
    
    # In real usage, this would pipe to Claude or use Claude CLI
    # claude --continue < "$prompt_file"
    
    # For now, wait for user confirmation
    read -p "Press Enter when you see '$marker': "
}

# Phase 1: Execute
echo "PHASE 1: EXECUTE"
send_to_claude "docs/execute.md" "***EXECUTE FINISHED***"

# Phase 2: Compare
echo -e "\\nPHASE 2: COMPARE"
send_to_claude "docs/compare.md" "***COMPARISON FINISHED***"

# Check if we need to loop back
read -p "Were gaps found that need addressing? (y/n): " gaps_found
if [ "$gaps_found" = "y" ]; then
    echo "Looping back to Execute phase..."
    send_to_claude "docs/execute.md" "***EXECUTE FINISHED***"
    send_to_claude "docs/compare.md" "***COMPARISON FINISHED***"
fi

# Phase 3: Commit
echo -e "\\nPHASE 3: COMMIT"
send_to_claude "docs/commit.md" "***COMMIT FINISHED***"

echo -e "\\n✅ Workflow completed!"