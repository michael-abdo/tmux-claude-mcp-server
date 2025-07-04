#!/bin/bash

# Quick VM Connection Test
# Fast validation of VM connectivity using DRY config

set -euo pipefail

# Source DRY configuration
SCRIPT_DIR="$(dirname "$0")"
source "$SCRIPT_DIR/vm-connection-config"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Quick VM Connection Test${NC}"
echo "=========================="
echo "VM: $VM_NAME ($VM_IP)"
echo ""

# Test 1: Basic ping
echo -n "1. Testing ping... "
if ping -c 3 -W 5 "$VM_IP" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
fi

# Test 2: SSH port
echo -n "2. Testing SSH port... "
if timeout 5 bash -c "</dev/tcp/$VM_IP/22" 2>/dev/null; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
fi

# Test 3: GCloud status
echo -n "3. Checking VM status... "
if vm_status=$(gcloud compute instances describe "$VM_NAME" \
    --project="$PROJECT" \
    --zone="$ZONE" \
    --format="value(status)" 2>/dev/null); then
    
    if [[ "$vm_status" == "RUNNING" ]]; then
        echo -e "${GREEN}✅ RUNNING${NC}"
    else
        echo -e "${YELLOW}⚠️  $vm_status${NC}"
    fi
else
    echo -e "${RED}❌ NOT FOUND${NC}"
fi

# Test 4: SSH connection
echo -n "4. Testing SSH connection... "
if timeout 10 gcloud compute ssh "$VM_USER@$VM_NAME" \
    --project="$PROJECT" \
    --zone="$ZONE" \
    $(build_gcloud_ssh_flags) \
    --command="echo 'SSH OK'" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${RED}❌ FAILED${NC}"
fi

echo ""
echo "Quick Commands:"
echo "  Connect:     claude-ssh"
echo "  Auto-retry:  claude-connect"
echo "  Full test:   ./client-diagnostics.sh"