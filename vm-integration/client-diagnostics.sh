#!/bin/bash

# Client-Side VM Connection Diagnostics
# Comprehensive testing suite for troubleshooting connection issues

set -euo pipefail

# Source DRY configuration
SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/vm-connection-config"

# Use configured VM or allow override
TARGET_IP="${1:-$VM_IP}"
TARGET_NAME="${2:-$VM_NAME}"
TEST_DURATION="${3:-10}" # minutes

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Log configuration
LOG_DIR="$HOME/.vm-diagnostics"
mkdir -p "$LOG_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="$LOG_DIR/diagnostic-${TARGET_NAME}-${TIMESTAMP}.log"

# Functions
log_event() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local color=""
    
    case "$level" in
        "INFO") color="$BLUE" ;;
        "SUCCESS") color="$GREEN" ;;
        "WARNING") color="$YELLOW" ;;
        "ERROR") color="$RED" ;;
    esac
    
    echo -e "${color}[$timestamp] [$level] $message${NC}" | tee -a "$LOG_FILE"
}

print_usage() {
    echo "Usage: $0 [TARGET_IP] [TARGET_NAME] [DURATION_MINUTES]"
    echo ""
    echo "Defaults to configured VM: $VM_NAME ($VM_IP)"
    echo ""
    echo "Tests:"
    echo "  1. SSH verbose connection test"
    echo "  2. Network stability (ping/mtr)"
    echo "  3. Port accessibility"
    echo "  4. WiFi/network interface monitoring"
    echo "  5. Route analysis"
    echo "  6. Resource monitoring"
    echo ""
    echo "Example: $0 35.209.236.51 claude-dev 5"
}

# Test Functions
test_ssh_verbose() {
    log_event "INFO" "=== SSH Verbose Connection Test ==="
    
    # Build SSH command with our DRY config
    local ssh_cmd="ssh -vvv"
    ssh_cmd="$ssh_cmd -o ServerAliveInterval=$ALIVE_INTERVAL"
    ssh_cmd="$ssh_cmd -o ServerAliveCountMax=$ALIVE_COUNT"
    ssh_cmd="$ssh_cmd -o ConnectTimeout=$CONNECT_TIMEOUT"
    ssh_cmd="$ssh_cmd -o ConnectionAttempts=$CONNECT_ATTEMPTS"
    ssh_cmd="$ssh_cmd -o BatchMode=yes"
    ssh_cmd="$ssh_cmd -o StrictHostKeyChecking=no"
    ssh_cmd="$ssh_cmd -o UserKnownHostsFile=/dev/null"
    
    log_event "INFO" "Testing SSH connection to $TARGET_IP"
    
    if timeout 30 $ssh_cmd "$TARGET_IP" 'echo "SSH test successful"' >> "$LOG_FILE" 2>&1; then
        log_event "SUCCESS" "SSH connection successful"
    else
        log_event "ERROR" "SSH connection failed - check verbose output in log"
    fi
}

test_network_stability() {
    log_event "INFO" "=== Network Stability Test ==="
    
    # Quick ping test
    log_event "INFO" "Running quick ping test (10 packets)"
    if ping_result=$(ping -c 10 -i 1 "$TARGET_IP" 2>&1); then
        echo "$ping_result" >> "$LOG_FILE"
        
        local packet_loss=$(echo "$ping_result" | grep "packet loss" | awk -F', ' '{print $3}' | awk '{print $1}')
        local avg_time=$(echo "$ping_result" | grep "min/avg/max" | awk -F'/' '{print $5}')
        
        log_event "INFO" "Packet loss: $packet_loss, Average RTT: ${avg_time}ms"
        
        if [[ "${packet_loss%\%}" -eq 0 ]]; then
            log_event "SUCCESS" "No packet loss detected"
        else
            log_event "WARNING" "Packet loss detected: $packet_loss"
        fi
    else
        log_event "ERROR" "Ping test failed"
    fi
    
    # MTR test if available
    if command -v mtr >/dev/null; then
        log_event "INFO" "Running MTR analysis (20 cycles)"
        mtr --report --report-cycles 20 "$TARGET_IP" >> "$LOG_FILE" 2>&1 || true
    else
        log_event "WARNING" "MTR not installed - skipping detailed route analysis"
    fi
}

test_port_accessibility() {
    log_event "INFO" "=== Port Accessibility Test ==="
    
    # Test SSH port
    log_event "INFO" "Testing SSH port 22"
    if timeout 10 bash -c "</dev/tcp/$TARGET_IP/22" 2>/dev/null; then
        log_event "SUCCESS" "SSH port 22 is accessible"
    else
        log_event "ERROR" "SSH port 22 is not accessible"
    fi
    
    # Test common ports for comparison
    for port in 80 443; do
        if timeout 5 bash -c "</dev/tcp/$TARGET_IP/$port" 2>/dev/null; then
            log_event "INFO" "Port $port is open"
        else
            log_event "INFO" "Port $port is closed/filtered"
        fi
    done
}

monitor_network_interface() {
    log_event "INFO" "=== Network Interface Monitoring ==="
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        log_event "INFO" "macOS network interface status"
        
        # WiFi info
        if [[ -f /System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport ]]; then
            local airport="/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport"
            log_event "INFO" "WiFi Status:"
            "$airport" -I | grep -E 'agrCtlRSSI|state|SSID|channel' >> "$LOG_FILE" 2>&1 || true
        fi
        
        # Interface stats
        netstat -i >> "$LOG_FILE" 2>&1 || true
        
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        log_event "INFO" "Linux network interface status"
        
        # Interface info
        ip addr show >> "$LOG_FILE" 2>&1 || true
        
        # WiFi info if available
        if command -v iwconfig >/dev/null; then
            iwconfig 2>/dev/null | grep -E "Signal level|Bit Rate|ESSID" >> "$LOG_FILE" || true
        fi
        
        # Interface statistics
        cat /proc/net/dev >> "$LOG_FILE" 2>&1 || true
    fi
}

test_route_analysis() {
    log_event "INFO" "=== Route Analysis ==="
    
    # Traceroute
    log_event "INFO" "Running traceroute"
    if command -v traceroute >/dev/null; then
        traceroute "$TARGET_IP" >> "$LOG_FILE" 2>&1 || true
    else
        log_event "WARNING" "traceroute not installed"
    fi
    
    # DNS resolution
    log_event "INFO" "Testing DNS resolution"
    local dns_start=$(date +%s.%N)
    if nslookup "$TARGET_IP" >> "$LOG_FILE" 2>&1; then
        local dns_end=$(date +%s.%N)
        local dns_time=$(echo "$dns_end - $dns_start" | bc 2>/dev/null || echo "N/A")
        log_event "INFO" "DNS resolution time: ${dns_time}s"
    else
        log_event "WARNING" "DNS resolution failed"
    fi
}

monitor_resources() {
    log_event "INFO" "=== Local Resource Monitoring ==="
    
    # CPU and Memory
    if [[ "$OSTYPE" == "darwin"* ]]; then
        log_event "INFO" "System load:"
        uptime >> "$LOG_FILE"
        
        log_event "INFO" "Memory pressure:"
        memory_pressure >> "$LOG_FILE" 2>&1 || vm_stat >> "$LOG_FILE" 2>&1 || true
        
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        log_event "INFO" "System load:"
        uptime >> "$LOG_FILE"
        
        log_event "INFO" "Memory usage:"
        free -h >> "$LOG_FILE" 2>&1 || true
    fi
}

continuous_monitor() {
    log_event "INFO" "=== Starting Continuous Monitoring ($TEST_DURATION minutes) ==="
    
    local end_time=$(($(date +%s) + TEST_DURATION * 60))
    local test_count=0
    
    while [[ $(date +%s) -lt $end_time ]]; do
        test_count=$((test_count + 1))
        log_event "INFO" "--- Test cycle $test_count ---"
        
        # Quick connectivity test
        if ping -c 3 -W 5 "$TARGET_IP" >/dev/null 2>&1; then
            log_event "SUCCESS" "Quick ping successful"
            
            # SSH port test
            if timeout 5 bash -c "</dev/tcp/$TARGET_IP/22" 2>/dev/null; then
                log_event "SUCCESS" "SSH port responsive"
            else
                log_event "ERROR" "SSH port not responsive"
                monitor_network_interface
            fi
        else
            log_event "ERROR" "Ping failed"
            monitor_network_interface
            monitor_resources
        fi
        
        # Wait 30 seconds between tests
        sleep 30
    done
    
    log_event "INFO" "Continuous monitoring completed"
}

generate_report() {
    log_event "INFO" "=== Diagnostic Summary ==="
    
    # Count successes and failures
    local success_count=$(grep -c "SUCCESS" "$LOG_FILE" || echo 0)
    local error_count=$(grep -c "ERROR" "$LOG_FILE" || echo 0)
    local warning_count=$(grep -c "WARNING" "$LOG_FILE" || echo 0)
    
    echo ""
    echo "Test Results:"
    echo "  ✅ Successes: $success_count"
    echo "  ❌ Errors: $error_count"
    echo "  ⚠️  Warnings: $warning_count"
    echo ""
    echo "Full log: $LOG_FILE"
    echo ""
    
    # Recommendations based on results
    if [[ $error_count -gt 0 ]]; then
        echo "Recommendations:"
        
        if grep -q "SSH connection failed" "$LOG_FILE"; then
            echo "  • Check SSH configuration in ~/.ssh/config"
            echo "  • Verify firewall rules allow port 22"
            echo "  • Try: ssh -vvv $TARGET_IP for detailed debug"
        fi
        
        if grep -q "Packet loss detected" "$LOG_FILE"; then
            echo "  • Network instability detected"
            echo "  • Check WiFi signal strength or use wired connection"
            echo "  • Contact ISP if persistent"
        fi
        
        if grep -q "SSH port not accessible" "$LOG_FILE"; then
            echo "  • SSH port appears blocked"
            echo "  • Check VM is running: gcloud compute instances list"
            echo "  • Verify security group allows SSH"
        fi
    fi
}

# Main execution
main() {
    if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
        print_usage
        exit 0
    fi
    
    log_event "INFO" "Starting VM connection diagnostics"
    log_event "INFO" "Target: $TARGET_NAME ($TARGET_IP)"
    log_event "INFO" "Duration: $TEST_DURATION minutes"
    log_event "INFO" "Log file: $LOG_FILE"
    echo ""
    
    # Run diagnostic tests
    test_ssh_verbose
    test_network_stability
    test_port_accessibility
    test_route_analysis
    monitor_network_interface
    monitor_resources
    
    # Continuous monitoring
    continuous_monitor
    
    # Generate report
    generate_report
}

# Run main
main "$@"