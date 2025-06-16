#!/bin/bash

# Network Speed and WiFi Analysis Script
# Comprehensive network performance testing

echo "=== NETWORK SPEED ANALYSIS ==="
echo "Generated on: $(date)"
echo ""

echo "=== BASIC CONNECTIVITY TEST ==="
echo "Testing connectivity to Google DNS (8.8.8.8):"
ping -c 10 8.8.8.8 | tail -4

echo ""
echo "=== NETWORK INTERFACE STATISTICS ==="
echo "WiFi interface (en0) statistics:"
netstat -i | grep en0

echo ""
echo "=== SPEED TEST ==="
echo "Running internet speed test..."
curl -s https://raw.githubusercontent.com/sivel/speedtest-cli/master/speedtest.py | python3 - --simple

echo ""
echo "=== WIFI INFORMATION ==="
echo "Current WiFi network details:"
networksetup -getairportnetwork en0

echo ""
echo "=== NETWORK CONFIGURATION ==="
echo "Network interface configuration:"
ifconfig en0

echo ""
echo "=== DNS CONFIGURATION ==="
echo "DNS servers:"
scutil --dns | grep nameserver

echo ""
echo "=== ROUTING TABLE ==="
echo "Default route:"
route get default

echo ""
echo "=== AIRPORT UTILITY (if available) ==="
if command -v airport >/dev/null 2>&1; then
    echo "WiFi scan results:"
    airport -s
else
    echo "Airport utility not found in PATH"
    # Try common locations
    if [ -f "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport" ]; then
        echo "Using airport from framework location:"
        /System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I
    fi
fi

echo ""
echo "=== NETWORK ANALYSIS COMPLETE ==="