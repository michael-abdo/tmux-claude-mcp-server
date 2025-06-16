#!/bin/bash

# Claude Code Instance Monitoring Script
# Monitors CPU, memory, and network usage of Claude processes

echo "=== Claude Code Instance Monitor ==="
echo "Timestamp: $(date)"
echo

# Find all Claude processes
echo "=== Active Claude Processes ==="
ps aux | grep -E "(claude|anthropic)" | grep -v grep
echo

# Get detailed stats for high-usage processes
echo "=== High-Usage Process Details ==="
CLAUDE_PIDS=$(ps aux | grep -E "(claude|anthropic)" | grep -v grep | awk '{if($3 > 5) print $2}' | tr '\n' ',' | sed 's/,$//')
if [ ! -z "$CLAUDE_PIDS" ]; then
    ps -p $CLAUDE_PIDS -o pid,pcpu,pmem,rss,vsz,comm 2>/dev/null
else
    echo "No high-usage Claude processes found"
fi
echo

# System resource overview
echo "=== System Resource Overview ==="
top -l 1 -n 10 | head -10
echo

# Network interface statistics
echo "=== Network Interface Statistics ==="
netstat -i | grep -E "Name|en0|lo0"
echo

# Disk I/O statistics
echo "=== Disk I/O Statistics ==="
iostat -w 1 -c 1
echo

# Memory pressure
echo "=== Memory Pressure ==="
vm_stat | head -5
echo

# Load average and uptime
echo "=== System Load ==="
uptime
echo

# Network connections by Claude processes
echo "=== Network Connections (Claude processes) ==="
for pid in $(ps aux | grep claude | grep -v grep | awk '{print $2}'); do
    echo "PID $pid connections:"
    lsof -p $pid -i 2>/dev/null | head -5
done
echo

echo "=== Summary ==="
echo "Total Claude processes: $(ps aux | grep claude | grep -v grep | wc -l)"
echo "High CPU processes (>5%): $(ps aux | grep claude | grep -v grep | awk '{if($3 > 5) print $2}' | wc -l)"
echo "Total memory used by Claude: $(ps aux | grep claude | grep -v grep | awk '{sum += $6} END {printf "%.1f MB\n", sum/1024}')"