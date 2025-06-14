#!/bin/bash

echo "Claude Deep Analysis - Process State & I/O Investigation"
echo "======================================================="
echo "Started: $(date)"
echo ""

# Get high-CPU Claude PIDs
HIGH_CPU_PIDS=$(ps aux | grep claude | grep -v grep | awk '$3 > 20 {print $2}' | tr '\n' ' ')
ALL_CLAUDE_PIDS=$(pgrep -f claude | tr '\n' ' ')

echo "High CPU Claude PIDs (>20%): $HIGH_CPU_PIDS"
echo "All Claude PIDs: $ALL_CLAUDE_PIDS"
echo ""

# Function to get process state breakdown
get_process_states() {
    echo "=== PROCESS STATE ANALYSIS ==="
    echo "Time: $(date)"
    ps aux | head -1
    ps aux | grep claude | grep -v grep | sort -k3 -nr | head -10
    echo ""
    
    # Check process states
    echo "Process States Detail:"
    for pid in $HIGH_CPU_PIDS; do
        if ps -p $pid > /dev/null 2>&1; then
            state=$(ps -o pid,stat,state,wchan -p $pid | tail -1)
            echo "PID $pid: $state"
        fi
    done
    echo "---"
}

# Function to monitor CPU vs I/O wait
monitor_cpu_io() {
    echo "=== CPU vs I/O WAIT ANALYSIS ==="
    echo "Time: $(date)"
    
    # Get system CPU breakdown
    echo "System CPU Breakdown:"
    iostat -c 1 1 | tail -n 2
    
    echo ""
    echo "Top processes with thread/state info:"
    top -l 1 -stats pid,command,cpu,state,th -n 10 | grep -E "(PID|claude)"
    echo "---"
}

# Function to check network activity correlation
check_network_activity() {
    echo "=== NETWORK ACTIVITY CORRELATION ==="
    echo "Time: $(date)"
    
    # Network connections per Claude process
    echo "Network connections by Claude processes:"
    for pid in $HIGH_CPU_PIDS; do
        if ps -p $pid > /dev/null 2>&1; then
            conn_count=$(lsof -p $pid -i 2>/dev/null | wc -l)
            echo "PID $pid: $conn_count network connections"
        fi
    done
    
    # Check network interface activity
    echo ""
    echo "Network interface activity:"
    netstat -i | grep en0 | head -1
    echo "---"
}

# Function to sample process activity
sample_process_activity() {
    echo "=== PROCESS ACTIVITY SAMPLING ==="
    echo "Time: $(date)"
    
    for pid in $HIGH_CPU_PIDS; do
        if ps -p $pid > /dev/null 2>&1; then
            echo "Sampling PID $pid for 1 second..."
            # Use timeout to limit sample time
            timeout 3s sample $pid 1 -mayDie 2>/dev/null | grep -E "(CPU|Running|Blocked|Call graph|Binary Images)" | head -10
            echo ""
        fi
    done
    echo "---"
}

# Function to check file descriptor usage
check_fd_usage() {
    echo "=== FILE DESCRIPTOR USAGE ==="
    echo "Time: $(date)"
    
    for pid in $HIGH_CPU_PIDS; do
        if ps -p $pid > /dev/null 2>&1; then
            fd_count=$(lsof -p $pid 2>/dev/null | wc -l)
            echo "PID $pid: $fd_count file descriptors"
            
            # Show types of file descriptors
            echo "  FD types:"
            lsof -p $pid 2>/dev/null | awk '{print $5}' | sort | uniq -c | head -5
        fi
    done
    echo "---"
}

# Function to check memory usage patterns
check_memory_patterns() {
    echo "=== MEMORY USAGE PATTERNS ==="
    echo "Time: $(date)"
    
    echo "Memory pressure:"
    vm_stat | head -6
    
    echo ""
    echo "Top memory consumers (Claude processes):"
    ps aux | grep claude | grep -v grep | sort -k4 -nr | head -5 | awk '{print "PID", $2, "MEM%", $4, "RSS", $6/1024"MB", $11}'
    echo "---"
}

# Main monitoring loop
echo "Starting 30-second monitoring session..."
echo "Taking 6 samples, 5 seconds apart"
echo ""

for i in {1..6}; do
    echo "████████████████████████████████████████████████████████████████"
    echo "SAMPLE $i/6 - $(date)"
    echo "████████████████████████████████████████████████████████████████"
    
    get_process_states
    monitor_cpu_io
    check_network_activity
    
    # Only do intensive sampling on first few iterations
    if [ $i -le 3 ]; then
        sample_process_activity
    fi
    
    check_fd_usage
    check_memory_patterns
    
    echo ""
    echo "Sleeping 5 seconds..."
    echo ""
    sleep 5
done

echo "████████████████████████████████████████████████████████████████"
echo "ANALYSIS COMPLETE"
echo "████████████████████████████████████████████████████████████████"

# Final summary
echo ""
echo "=== FINAL SUMMARY ==="
echo "Analysis period: 30 seconds"
echo "High-CPU processes monitored: $HIGH_CPU_PIDS"

# Get final state
echo ""
echo "Final process states:"
ps aux | grep claude | grep -v grep | awk '$3 > 10' | sort -k3 -nr

echo ""
echo "Key observations to look for:"
echo "- Consistent high CPU% = compute bound"
echo "- Fluctuating CPU with high I/O wait = I/O bound"
echo "- Many network connections = network bound"
echo "- High file descriptor count = file I/O intensive"
echo "- Process state 'D' = waiting for disk"
echo "- Process state 'R' = actively running"
echo ""
echo "Analysis completed: $(date)"