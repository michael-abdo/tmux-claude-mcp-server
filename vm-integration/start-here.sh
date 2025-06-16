#!/bin/bash

# Getting Started with Claude Code VMs
# This script checks prerequisites and guides you through setup

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${BLUE}🤖 Claude Code VM Setup${NC}"
echo "=========================="
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Google Cloud CLI not found${NC}"
    echo ""
    echo "📦 Install gcloud CLI:"
    echo "   curl https://sdk.cloud.google.com | bash"
    echo "   exec -l \$SHELL"
    echo ""
    echo "🔗 Or visit: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

echo -e "${GREEN}✅ Google Cloud CLI found${NC}"

# Check if authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &>/dev/null; then
    echo -e "${YELLOW}⚠️  Not authenticated with Google Cloud${NC}"
    echo ""
    echo "🔐 Please authenticate:"
    echo "   gcloud auth login"
    echo ""
    read -p "Press Enter after authenticating..."
fi

echo -e "${GREEN}✅ Google Cloud authentication verified${NC}"

# Check/set project
PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "")
if [ -z "$PROJECT_ID" ]; then
    echo -e "${YELLOW}⚠️  No default project set${NC}"
    echo ""
    echo "Options:"
    echo "1. Use existing project"
    echo "2. Create new project"
    echo ""
    read -p "Choose option (1-2): " project_choice
    
    case $project_choice in
        1)
            echo ""
            echo "Available projects:"
            gcloud projects list --format="table(projectId,name)"
            echo ""
            read -p "Enter project ID: " PROJECT_ID
            gcloud config set project "$PROJECT_ID"
            ;;
        2)
            echo ""
            echo "🏗️  Creating new project..."
            ./create-project.sh
            PROJECT_ID=$(gcloud config get-value project 2>/dev/null || echo "")
            ;;
        *)
            echo "Invalid option"
            exit 1
            ;;
    esac
fi

echo -e "${GREEN}✅ Using project: $PROJECT_ID${NC}"

# Check if Compute Engine API is enabled
echo "🔍 Checking Compute Engine API..."
if ! gcloud services list --enabled --filter="name:compute.googleapis.com" --format="value(name)" | grep -q compute; then
    echo -e "${YELLOW}⚠️  Compute Engine API not enabled${NC}"
    echo "🔧 Enabling Compute Engine API..."
    gcloud services enable compute.googleapis.com
    echo -e "${GREEN}✅ Compute Engine API enabled${NC}"
else
    echo -e "${GREEN}✅ Compute Engine API is enabled${NC}"
fi

# Check billing with timeout
echo "💳 Checking billing..."
if timeout 10s gcloud beta billing projects describe "$PROJECT_ID" --format="value(billingEnabled)" >/dev/null 2>&1; then
    BILLING_ENABLED=$(gcloud beta billing projects describe "$PROJECT_ID" --format="value(billingEnabled)" 2>/dev/null || echo "false")
    if [ "$BILLING_ENABLED" != "True" ]; then
        echo -e "${RED}❌ Billing not enabled for this project${NC}"
        echo ""
        echo "🔗 Enable billing at: https://console.cloud.google.com/billing"
        echo "💡 You need billing enabled to create VMs"
        echo "🔧 Or run: ./setup-billing.sh"
        exit 1
    fi
    echo -e "${GREEN}✅ Billing is enabled${NC}"
else
    echo -e "${YELLOW}⚠️  Could not check billing status (API timeout)${NC}"
    echo "💡 Assuming billing is enabled and continuing..."
    echo "🔧 If VM creation fails, run: ./setup-billing.sh"
fi

echo ""
echo -e "${PURPLE}🎯 Setup Complete! Ready to create VMs${NC}"
echo ""

# Show available actions
echo "What would you like to do?"
echo ""
echo "1. Create your first VM"
echo "2. List existing VMs" 
echo "3. Show cost estimates"
echo "4. Exit"
echo ""

read -p "Choose an option (1-4): " choice

case $choice in
    1)
        echo ""
        echo "🚀 Creating your first Claude Code VM..."
        echo ""
        
        # Optional: Ask for VM name
        read -p "VM name (press Enter for auto-generated): " VM_NAME
        if [ -n "$VM_NAME" ]; then
            export VM_NAME
        fi
        
        # Optional: Ask for machine type
        echo ""
        echo "Machine type options:"
        echo "  1. e2-micro (2 vCPU, 1GB) - ~$7/month"
        echo "  2. e2-small (2 vCPU, 2GB) - ~$14/month"
        echo "  3. e2-medium (2 vCPU, 4GB) - ~$27/month"
        echo "  4. e2-standard-2 (2 vCPU, 8GB) - ~$49/month"
        echo "  5. e2-standard-4 (4 vCPU, 16GB) - ~$95/month [DEFAULT]"
        echo ""
        read -p "Choose machine type (1-5, Enter for default): " machine_choice
        
        case $machine_choice in
            1) export GCP_MACHINE_TYPE="e2-micro" ;;
            2) export GCP_MACHINE_TYPE="e2-small" ;;
            3) export GCP_MACHINE_TYPE="e2-medium" ;;
            4) export GCP_MACHINE_TYPE="e2-standard-2" ;;
            5) export GCP_MACHINE_TYPE="e2-standard-4" ;;
            *) export GCP_MACHINE_TYPE="e2-standard-4" ;;
        esac
        
        echo ""
        ./simple-gcp-vm.sh
        ;;
    2)
        echo ""
        ./manage-vm.sh list
        ;;
    3)
        echo ""
        echo -e "${BLUE}💰 VM Cost Estimates (per month if left running)${NC}"
        echo "=================================================="
        echo ""
        echo "e2-micro     (2 vCPU, 1GB):    ~$7/month"
        echo "e2-small     (2 vCPU, 2GB):    ~$14/month"
        echo "e2-medium    (2 vCPU, 4GB):    ~$27/month"
        echo "e2-standard-2 (2 vCPU, 8GB):   ~$49/month"
        echo "e2-standard-4 (4 vCPU, 16GB):  ~$95/month"
        echo ""
        echo -e "${YELLOW}💡 Pro tip: Stop VMs when not in use to save money!${NC}"
        echo "   ./manage-vm.sh stop vm-name"
        echo ""
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