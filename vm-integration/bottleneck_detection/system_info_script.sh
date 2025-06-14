#!/bin/bash

# System Information Collection Script
# Comprehensive MacBook system analysis

echo "=== SYSTEM INFORMATION COLLECTION ==="
echo "Generated on: $(date)"
echo ""

echo "=== HARDWARE OVERVIEW ==="
system_profiler SPHardwareDataType SPSoftwareDataType SPDisplaysDataType SPMemoryDataType SPStorageDataType

echo ""
echo "=== CPU DETAILS ==="
sysctl -a | grep -E "hw\.|machdep\.cpu" | head -50

echo ""
echo "=== DISK INFORMATION ==="
diskutil list

echo ""
echo "=== MOTHERBOARD INFO ==="
ioreg -l | grep -E "product-name|board-id" | head -10

echo ""
echo "=== POWER & BATTERY ==="
system_profiler SPPowerDataType

echo ""
echo "=== SOFTWARE UPDATE HISTORY ==="
softwareupdate --history | head -20

echo ""
echo "=== OS VERSION & KERNEL ==="
sw_vers && uname -a

echo ""
echo "=== SYSTEM COLLECTION COMPLETE ==="