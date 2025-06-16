#!/bin/bash

echo "Claude Network Connection Analysis"
echo "================================="
echo "Started: $(date)"
echo ""

# Get high-connection Claude PIDs
HIGH_CONN_PIDS=$(ps aux | grep claude | grep -v grep | awk '$3 > 5 {print $2}' | head -4)
echo "Analyzing high-activity Claude PIDs: $HIGH_CONN_PIDS"
echo ""

# Function to analyze connections for a specific PID
analyze_pid_connections() {
    local pid=$1
    echo "████████████████████████████████████████████████████████████████"
    echo "ANALYZING PID $pid"
    echo "████████████████████████████████████████████████████████████████"
    
    # Check if process exists
    if ! ps -p $pid > /dev/null 2>&1; then
        echo "PID $pid no longer exists"
        return
    fi
    
    # Get process info
    echo "=== PROCESS INFO ==="
    ps -o pid,ppid,user,command -p $pid
    echo ""
    
    # 1. Count total connections
    echo "=== CONNECTION SUMMARY ==="
    local total_conns=$(lsof -p $pid -i 2>/dev/null | wc -l)
    echo "Total network connections: $total_conns"
    
    # 2. Connection types breakdown
    echo ""
    echo "Connection types:"
    lsof -p $pid -i 2>/dev/null | awk '{print $8}' | sort | uniq -c | sort -rn
    
    # 3. See what hosts Claude is connecting to
    echo ""
    echo "=== TOP DESTINATION HOSTS ==="
    lsof -p $pid -i TCP 2>/dev/null | awk 'NR>1 {print $9}' | grep -E ":" | cut -d: -f1 | sort | uniq -c | sort -rn | head -10
    
    # 4. Check connection states
    echo ""
    echo "=== CONNECTION STATES ==="
    lsof -p $pid -i TCP 2>/dev/null | awk 'NR>1 {print $10}' | sort | uniq -c | sort -rn
    
    # 5. Port analysis
    echo ""
    echo "=== DESTINATION PORTS ==="
    lsof -p $pid -i TCP 2>/dev/null | awk 'NR>1 {print $9}' | grep -E ":" | cut -d: -f2 | sort | uniq -c | sort -rn | head -10
    
    # 6. Local ports (ephemeral port usage)
    echo ""
    echo "=== LOCAL PORT USAGE ==="
    local local_ports=$(lsof -p $pid -i TCP 2>/dev/null | awk 'NR>1 {print $8}' | grep -E ":" | cut -d: -f2 | wc -l)
    echo "Ephemeral ports in use: $local_ports"
    
    # 7. Check for specific services
    echo ""
    echo "=== SERVICE ANALYSIS ==="
    local anthropic_conns=$(lsof -p $pid -i 2>/dev/null | grep -i anthropic | wc -l)
    local https_conns=$(lsof -p $pid -i TCP 2>/dev/null | grep ":443" | wc -l)
    local http_conns=$(lsof -p $pid -i TCP 2>/dev/null | grep ":80" | wc -l)
    local api_conns=$(lsof -p $pid -i TCP 2>/dev/null | grep -E "api|claude" | wc -l)
    
    echo "Anthropic connections: $anthropic_conns"
    echo "HTTPS connections (port 443): $https_conns"
    echo "HTTP connections (port 80): $http_conns"
    echo "API-related connections: $api_conns"
    
    # 8. Sample actual connections
    echo ""
    echo "=== SAMPLE CONNECTIONS (first 10) ==="
    lsof -p $pid -i TCP 2>/dev/null | head -11
    
    echo ""
}

# Function to check system-wide network state
check_system_network() {
    echo "████████████████████████████████████████████████████████████████"
    echo "SYSTEM-WIDE NETWORK ANALYSIS"
    echo "████████████████████████████████████████████████████████████████"
    
    # Check ephemeral port configuration
    echo "=== EPHEMERAL PORT CONFIGURATION ==="
    echo "Port range configuration:"
    sysctl net.inet.ip.portrange.first net.inet.ip.portrange.last 2>/dev/null || echo "Unable to read port range (macOS restriction)"
    
    # Check TIME_WAIT connections system-wide
    echo ""
    echo "=== SYSTEM CONNECTION STATES ==="
    local time_wait_count=$(netstat -ant 2>/dev/null | grep TIME_WAIT | wc -l)
    local established_count=$(netstat -ant 2>/dev/null | grep ESTABLISHED | wc -l)
    local total_tcp_conns=$(netstat -ant 2>/dev/null | grep tcp | wc -l)
    
    echo "TIME_WAIT connections: $time_wait_count"
    echo "ESTABLISHED connections: $established_count"
    echo "Total TCP connections: $total_tcp_conns"
    
    # Check for Claude-related connections system-wide
    echo ""
    echo "=== CLAUDE PROCESSES NETWORK SUMMARY ==="
    echo "PID | Connections | Status"
    echo "----+-------------+--------"
    for pid in $(pgrep -f claude); do
        if ps -p $pid > /dev/null 2>&1; then
            local conn_count=$(lsof -p $pid -i 2>/dev/null | wc -l)
            local cpu_pct=$(ps -o pid,pcpu -p $pid | tail -1 | awk '{print $2}')
            printf "%4s | %11s | %.1f%% CPU\n" "$pid" "$conn_count" "$cpu_pct"
        fi
    done
    
    echo ""
}

# Function to monitor connection creation in real-time
monitor_connections_realtime() {
    echo "████████████████████████████████████████████████████████████████"
    echo "REAL-TIME CONNECTION MONITORING (10 seconds)"
    echo "████████████████████████████████████████████████████████████████"
    
    echo "Monitoring new TCP connections for 10 seconds..."
    echo "Looking for SYN packets on ports 80 and 443..."
    echo ""
    
    # Monitor for 10 seconds with timeout
    timeout 10s tcpdump -i any -n 'tcp[tcpflags] & (tcp-syn) != 0' 2>/dev/null | grep -E "port (443|80)" | head -20 &
    
    # Also monitor connection count changes
    echo "Connection count tracking:"
    for i in {1..10}; do
        local claude_conns=0
        for pid in $HIGH_CONN_PIDS; do
            if ps -p $pid > /dev/null 2>&1; then
                local conns=$(lsof -p $pid -i 2>/dev/null | wc -l)
                claude_conns=$((claude_conns + conns))
            fi
        done
        echo "Second $i: Total Claude connections: $claude_conns"
        sleep 1
    done
    
    wait # Wait for tcpdump to finish
    echo ""
}

# Function to check for connection leaks
check_connection_patterns() {
    echo "████████████████████████████████████████████████████████████████"
    echo "CONNECTION PATTERN ANALYSIS"
    echo "████████████████████████████████████████████████████████████████"
    
    echo "=== POTENTIAL CONNECTION LEAK DETECTION ==="
    
    # Take snapshot 1
    declare -A snapshot1
    for pid in $HIGH_CONN_PIDS; do
        if ps -p $pid > /dev/null 2>&1; then
            snapshot1[$pid]=$(lsof -p $pid -i 2>/dev/null | wc -l)
        fi
    done
    
    echo "Initial connection counts:"
    for pid in "${!snapshot1[@]}"; do
        echo "PID $pid: ${snapshot1[$pid]} connections"
    done
    
    echo ""
    echo "Waiting 15 seconds..."
    sleep 15
    
    # Take snapshot 2
    declare -A snapshot2
    for pid in $HIGH_CONN_PIDS; do
        if ps -p $pid > /dev/null 2>&1; then
            snapshot2[$pid]=$(lsof -p $pid -i 2>/dev/null | wc -l)
        fi
    done
    
    echo "Connection counts after 15 seconds:"
    for pid in "${!snapshot2[@]}"; do
        local initial=${snapshot1[$pid]:-0}
        local current=${snapshot2[$pid]:-0}
        local change=$((current - initial))
        echo "PID $pid: $current connections (${change:+$change})"
    done
    
    echo ""
}

# Main execution
echo "Starting comprehensive network analysis..."
echo ""

# System overview first
check_system_network

# Analyze each high-connection PID
for pid in $HIGH_CONN_PIDS; do
    analyze_pid_connections $pid
done

# Real-time monitoring
monitor_connections_realtime

# Check for patterns and leaks
check_connection_patterns

echo "████████████████████████████████████████████████████████████████"
echo "ANALYSIS COMPLETE"
echo "████████████████████████████████████████████████████████████████"

echo ""
echo "=== SUMMARY & RECOMMENDATIONS ==="
echo ""

# Generate summary
total_claude_conns=0
high_conn_processes=0

for pid in $(pgrep -f claude); do
    if ps -p $pid > /dev/null 2>&1; then
        local conns=$(lsof -p $pid -i 2>/dev/null | wc -l)
        total_claude_conns=$((total_claude_conns + conns))
        if [ $conns -gt 50 ]; then
            high_conn_processes=$((high_conn_processes + 1))
        fi
    fi
done

echo "📊 FINAL STATISTICS:"
echo "• Total Claude network connections: $total_claude_conns"
echo "• Processes with >50 connections: $high_conn_processes"
echo "• Analysis duration: ~1 minute"

echo ""
echo "🔍 LOOK FOR IN RESULTS:"
echo "• Same destination IP repeated many times = connection pooling issue"
echo "• Many TIME_WAIT connections = rapid connection cycling"
echo "• Connections to multiple hosts = API fan-out pattern"
echo "• Growing connection counts = potential leaks"
echo "• High HTTPS (443) usage = API calls to cloud services"

echo ""
echo "Analysis completed: $(date)"