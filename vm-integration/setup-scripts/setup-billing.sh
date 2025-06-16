#!/bin/bash

# Quick Billing Setup for Your New Project
# Run this after creating a project to link billing

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ID="${1:-$(gcloud config get-value project)}"

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ No project specified${NC}"
    echo "Usage: $0 [project-id]"
    echo "Or set default project: gcloud config set project YOUR-PROJECT-ID"
    exit 1
fi

echo -e "${BLUE}💳 Setting up billing for project: $PROJECT_ID${NC}"
echo ""

# Check if billing is already enabled
BILLING_STATUS=$(gcloud beta billing projects describe "$PROJECT_ID" --format="value(billingEnabled)" 2>/dev/null || echo "false")
if [ "$BILLING_STATUS" = "True" ]; then
    echo -e "${GREEN}✅ Billing already enabled for this project${NC}"
    exit 0
fi

# List billing accounts
echo "📋 Available billing accounts:"
BILLING_ACCOUNTS=$(gcloud beta billing accounts list --format="value(name)" 2>/dev/null || echo "")

if [ -z "$BILLING_ACCOUNTS" ]; then
    echo -e "${RED}❌ No billing accounts found${NC}"
    echo ""
    echo "You need to create a billing account first:"
    echo "🔗 https://console.cloud.google.com/billing"
    echo ""
    echo "Steps:"
    echo "1. Go to the billing console"
    echo "2. Create a billing account"
    echo "3. Add a payment method"
    echo "4. Run this script again"
    exit 1
fi

echo ""
gcloud beta billing accounts list --format="table(name,displayName,open)"
echo ""

# Count billing accounts
ACCOUNT_COUNT=$(echo "$BILLING_ACCOUNTS" | wc -l | tr -d ' ')

if [ "$ACCOUNT_COUNT" -eq 1 ]; then
    echo "🔧 Auto-linking to your only billing account..."
    BILLING_ACCOUNT=$(echo "$BILLING_ACCOUNTS" | head -1)
    
    if gcloud beta billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"; then
        echo -e "${GREEN}✅ Billing linked successfully!${NC}"
    else
        echo -e "${RED}❌ Failed to link billing${NC}"
        exit 1
    fi
else
    echo "Multiple billing accounts found."
    echo "Copy the billing account ID from the table above."
    echo ""
    read -p "Enter billing account ID: " BILLING_ACCOUNT
    
    if [ -z "$BILLING_ACCOUNT" ]; then
        echo -e "${RED}❌ No billing account specified${NC}"
        exit 1
    fi
    
    if gcloud beta billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"; then
        echo -e "${GREEN}✅ Billing linked successfully!${NC}"
    else
        echo -e "${RED}❌ Failed to link billing${NC}"
        exit 1
    fi
fi

echo ""
echo "🔧 Now enabling Compute Engine API..."
if gcloud services enable compute.googleapis.com; then
    echo -e "${GREEN}✅ Compute Engine API enabled${NC}"
else
    echo -e "${RED}❌ Failed to enable Compute Engine API${NC}"
    exit 1
fi

echo ""
echo "🔧 Setting up firewall rules..."
if gcloud compute firewall-rules create allow-ssh \
    --allow tcp:22 \
    --source-ranges 0.0.0.0/0 \
    --description "Allow SSH access for Claude Code VMs" \
    --project "$PROJECT_ID" 2>/dev/null; then
    echo -e "${GREEN}✅ SSH firewall rule created${NC}"
else
    echo -e "${YELLOW}⚠️  SSH firewall rule might already exist${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Project setup complete!${NC}"
echo ""
echo "✅ Billing enabled"
echo "✅ Compute Engine API enabled"
echo "✅ SSH firewall rule created"
echo ""
echo "🚀 Ready to create VMs:"
echo "   ./simple-gcp-vm.sh"
echo ""