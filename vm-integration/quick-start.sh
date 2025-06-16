#!/bin/bash

# Quick Start - Skip all checks and go straight to VM creation
# Use this when you know your project is set up correctly

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Load project configuration if available
if [ -f "$(dirname "$0")/.claude-gcp-project" ]; then
    source "$(dirname "$0")/.claude-gcp-project"
fi

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"

echo -e "${BLUE}🚀 Quick Start - Claude Code VM${NC}"
echo "==============================="
echo ""

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ No project set${NC}"
    echo "Run one of these first:"
    echo "  ./create-project.sh    # Create new project"
    echo "  ./start-here.sh        # Full interactive setup"
    exit 1
fi

echo -e "${GREEN}✅ Using project: $PROJECT_ID${NC}"
echo ""

echo "What would you like to do?"
echo ""
echo "1. Create new VM"
echo "2. List existing VMs"
echo "3. Connect to existing VM"
echo "4. Exit"
echo ""

read -p "Choose option (1-4): " choice

case $choice in
    1)
        echo ""
        echo "🔧 VM Configuration:"
        echo "1. Small (e2-medium, 2 vCPU, 4GB) - ~$27/month"
        echo "2. Standard (e2-standard-2, 2 vCPU, 8GB) - ~$49/month"  
        echo "3. Large (e2-standard-4, 4 vCPU, 16GB) - ~$95/month [DEFAULT]"
        echo ""
        read -p "Choose size (1-3, Enter for default): " size_choice
        
        case $size_choice in
            1) export GCP_MACHINE_TYPE="e2-medium" ;;
            2) export GCP_MACHINE_TYPE="e2-standard-2" ;;
            3) export GCP_MACHINE_TYPE="e2-standard-4" ;;
            *) export GCP_MACHINE_TYPE="e2-standard-4" ;;
        esac
        
        echo ""
        read -p "VM name (or press Enter for auto-generated): " VM_NAME
        if [ -n "$VM_NAME" ]; then
            export VM_NAME
        fi
        
        echo ""
        echo "🚀 Creating VM..."
        ./simple-gcp-vm.sh
        ;;
    2)
        echo ""
        ./manage-vm.sh list
        ;;
    3)
        echo ""
        echo "Available VMs:"
        ./manage-vm.sh list | grep -E "(RUNNING|claude-)" | head -10
        echo ""
        read -p "Enter VM name to connect: " VM_NAME
        if [ -n "$VM_NAME" ]; then
            ./manage-vm.sh ssh "$VM_NAME"
        fi
        ;;
    4)
        echo "👋 Happy coding!"
        exit 0
        ;;
    *)
        echo "Invalid option"
        exit 1
        ;;
esac