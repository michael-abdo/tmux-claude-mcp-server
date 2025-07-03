#!/bin/bash

echo "Project Activity Check - $(date)"
echo "================================================"

projects=(
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021929016736789551311"
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021929068121735806743"
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021929338960843102416"
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021929506694170832611"
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021930285200940677616"
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021929592495979610025"
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021929597245880692451"
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021929935114393239313"
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021930362089278539004"
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021930369574831916284"
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021930370659237853965"
)

for proj in "${projects[@]}"; do
    proj_id=$(basename "$proj")
    echo "=== Project: $proj_id ==="
    
    if [ -d "$proj" ]; then
        # Count files modified in last 5 minutes
        recent_count=$(find "$proj" -type f -mmin -5 2>/dev/null | wc -l | tr -d ' ')
        
        # Check for navigation.yaml (completion indicator)
        if [ -f "$proj/navigation.yaml" ]; then
            nav_status="✅ COMPLETED (navigation.yaml exists)"
        else
            nav_status="🔄 IN PROGRESS"
        fi
        
        echo "Recent files (last 5 min): $recent_count"
        echo "Status: $nav_status"
        
        # Show last 3 modified files
        echo "Latest modifications:"
        find "$proj" -type f -mmin -5 2>/dev/null | head -3 | sed 's/^/  - /'
    else
        echo "ERROR: Directory not found!"
    fi
    echo ""
done

echo "================================================"
echo "Summary:"
echo "Total projects: ${#projects[@]}"