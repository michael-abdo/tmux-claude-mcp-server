#!/bin/bash

echo "🔄 PUSH COMPLETION MONITOR"
echo "========================="
echo ""
echo "Monitoring for successful push to origin/master..."
echo "Press Ctrl+C to stop monitoring"
echo ""

LOCAL_HEAD=$(git rev-parse HEAD)
echo "📍 Waiting for remote to match: $LOCAL_HEAD"
echo ""

# Function to check if push is complete
check_push_status() {
    git fetch origin --quiet 2>/dev/null
    REMOTE_HEAD=$(git rev-parse origin/master 2>/dev/null || echo "ERROR")
    
    if [ "$REMOTE_HEAD" == "$LOCAL_HEAD" ]; then
        return 0  # Success
    else
        return 1  # Not yet pushed
    fi
}

# Initial status
echo "Current status:"
echo "- Local:  $LOCAL_HEAD"
echo "- Remote: $(git rev-parse origin/master 2>/dev/null || echo 'NOT ACCESSIBLE')"
echo ""
echo "Monitoring... (checking every 10 seconds)"
echo ""

CHECK_COUNT=0
START_TIME=$(date +%s)

while true; do
    ((CHECK_COUNT++))
    
    if check_push_status; then
        # SUCCESS!
        echo ""
        echo "🎉 PUSH DETECTED! 🎉"
        echo ""
        
        ELAPSED=$(($(date +%s) - START_TIME))
        echo "✅ Push completed successfully!"
        echo "⏱️  Time elapsed: $ELAPSED seconds"
        echo "🔄 Total checks: $CHECK_COUNT"
        echo ""
        
        # Run full verification
        echo "Running full verification..."
        ./.push-state/verify_push.sh
        
        # Create completion marker
        echo "COMPLETED_AT_$(date +%Y%m%d-%H%M%S)" > .push-state/push_completed.txt
        
        # Play success sound if available
        if command -v afplay &> /dev/null; then
            afplay /System/Library/Sounds/Glass.aiff 2>/dev/null || true
        elif command -v paplay &> /dev/null; then
            paplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null || true
        fi
        
        echo ""
        echo "🏁 Monitoring complete!"
        exit 0
    else
        # Still waiting
        printf "."
        
        # Every 6 checks (1 minute), show status
        if [ $((CHECK_COUNT % 6)) -eq 0 ]; then
            echo ""
            echo "[$(date '+%H:%M:%S')] Still waiting... (Remote: $(git rev-parse --short origin/master 2>/dev/null || echo 'N/A'))"
        fi
    fi
    
    sleep 10
done