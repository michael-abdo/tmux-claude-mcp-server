#!/bin/bash

echo "Claude Code Bottleneck Analyzer"
echo "==============================="

# Get Claude PIDs
PIDS=$(pgrep -f claude | tr '\n' ',' | sed 's/,$//')

if [ -z "$PIDS" ]; then
    echo "No Claude processes found"
    exit 1
fi

echo "Monitoring PIDs: $PIDS"
echo ""

# Function to get CPU stats
get_cpu_stats() {
    top -l 1 -pid $1 -stats pid,cpu,state,time,th,csw,purg 2>/dev/null | tail -n 1
}

# Monitor for 30 seconds
for i in {1..30}; do
    echo "Sample $i/30 ($(date +%H:%M:%S))"
    
    # System I/O wait
    iostat -c 1 1 | tail -n 1 | awk '{print "System - User: "$1"% Sys: "$3"% Idle: "$5"%"}'
    
    # Per-process stats
    for pid in ${PIDS//,/ }; do
        stats=$(get_cpu_stats $pid)
        if [ ! -z "$stats" ]; then
            echo "PID $pid: $stats"
        fi
    done
    
    # Network connections
    conn_count=$(lsof -p ${PIDS} -i TCP 2>/dev/null | grep ESTABLISHED | wc -l)
    echo "Active network connections: $conn_count"
    
    echo "---"
    sleep 1
done

echo ""
echo "Analysis complete. Look for:"
echo "- Consistent high CPU % = compute bound"
echo "- Fluctuating CPU with high context switches = I/O bound"