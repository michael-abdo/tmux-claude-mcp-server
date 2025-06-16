#!/bin/bash

# Create New GCP Project for Claude Code VMs
# This script creates a new project and sets it up for VM usage

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

echo -e "${BLUE}🏗️  Creating New GCP Project for Claude Code${NC}"
echo "=============================================="
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Google Cloud CLI not found${NC}"
    echo ""
    echo "📦 Install gcloud CLI first:"
    echo "   curl https://sdk.cloud.google.com | bash"
    echo "   exec -l \$SHELL"
    exit 1
fi

# Check if authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &>/dev/null; then
    echo -e "${YELLOW}⚠️  Please authenticate first:${NC}"
    echo "   gcloud auth login"
    exit 1
fi

echo -e "${GREEN}✅ Google Cloud CLI ready${NC}"
echo ""

# Get project details
echo "📝 Project Details"
echo "=================="

# Generate a unique project ID suggestion
TIMESTAMP=$(date +%Y%m%d-%H%M)
SUGGESTED_ID="claude-code-dev-$TIMESTAMP"

echo ""
read -p "Project Name (human-readable): " PROJECT_NAME
if [ -z "$PROJECT_NAME" ]; then
    PROJECT_NAME="Claude Code Development"
fi

# Sanitize project name - GCP only allows letters, numbers, spaces, hyphens, single quotes, and periods
PROJECT_NAME=$(echo "$PROJECT_NAME" | sed 's/[^a-zA-Z0-9 .-]//g')

echo ""
echo "Project ID must be:"
echo "  - 6-30 characters"
echo "  - Lowercase letters, numbers, hyphens only"
echo "  - Globally unique"
echo ""
echo "Suggested ID: $SUGGESTED_ID"
read -p "Project ID (or press Enter for suggestion): " PROJECT_ID
if [ -z "$PROJECT_ID" ]; then
    PROJECT_ID="$SUGGESTED_ID"
fi

# Validate project ID format
if ! echo "$PROJECT_ID" | grep -qE '^[a-z][a-z0-9-]{5,29}$'; then
    echo -e "${RED}❌ Invalid project ID format${NC}"
    echo "Must be 6-30 chars, start with letter, lowercase/numbers/hyphens only"
    exit 1
fi

echo ""
echo -e "${BLUE}Creating project...${NC}"
echo "Name: $PROJECT_NAME"
echo "ID: $PROJECT_ID"
echo ""

# Create the project
echo "🏗️  Creating GCP project..."
if gcloud projects create "$PROJECT_ID" --name="$PROJECT_NAME"; then
    echo -e "${GREEN}✅ Project created successfully!${NC}"
else
    echo -e "${RED}❌ Failed to create project${NC}"
    echo "The project ID might already exist. Try a different one."
    exit 1
fi

# Set as default project
echo ""
echo "🔧 Setting as default project..."
gcloud config set project "$PROJECT_ID"
echo -e "${GREEN}✅ Default project set${NC}"

# Enable billing API first (doesn't require billing)
echo ""
echo "🔧 Enabling Cloud Billing API..."
gcloud services enable cloudbilling.googleapis.com
echo -e "${GREEN}✅ Cloud Billing API enabled${NC}"

# Check billing account
echo ""
echo "💳 Setting up billing..."

# List billing accounts
BILLING_ACCOUNTS=$(gcloud beta billing accounts list --format="value(name)" 2>/dev/null || echo "")

if [ -z "$BILLING_ACCOUNTS" ]; then
    echo -e "${YELLOW}⚠️  No billing accounts found${NC}"
    echo ""
    echo "You need to:"
    echo "1. Go to: https://console.cloud.google.com/billing"
    echo "2. Create a billing account"
    echo "3. Then run this command to link it:"
    echo "   gcloud beta billing projects link $PROJECT_ID --billing-account=BILLING_ACCOUNT_ID"
    echo ""
else
    echo "Available billing accounts:"
    gcloud beta billing accounts list --format="table(name,displayName,open)"
    echo ""
    
    # Count billing accounts
    ACCOUNT_COUNT=$(echo "$BILLING_ACCOUNTS" | wc -l | tr -d ' ')
    
    if [ "$ACCOUNT_COUNT" -eq 1 ]; then
        echo "🔧 Linking to your billing account..."
        BILLING_ACCOUNT=$(echo "$BILLING_ACCOUNTS" | head -1)
        if gcloud beta billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"; then
            echo -e "${GREEN}✅ Billing linked successfully${NC}"
        else
            echo -e "${YELLOW}⚠️  Could not link billing automatically${NC}"
            echo "Please link manually at: https://console.cloud.google.com/billing"
        fi
    else
        echo "Multiple billing accounts found."
        read -p "Enter billing account ID to use: " BILLING_ACCOUNT
        if [ -n "$BILLING_ACCOUNT" ]; then
            gcloud beta billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT"
            echo -e "${GREEN}✅ Billing linked${NC}"
        else
            echo -e "${YELLOW}⚠️  Billing not linked. Link manually at: https://console.cloud.google.com/billing${NC}"
        fi
    fi
fi

# Enable Compute Engine API after billing is set up
echo ""
echo "🔧 Enabling Compute Engine API..."
if gcloud services enable compute.googleapis.com; then
    echo -e "${GREEN}✅ Compute Engine API enabled${NC}"
    
    # Create default firewall rule for SSH
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
else
    echo -e "${YELLOW}⚠️  Could not enable Compute Engine API - billing may not be linked${NC}"
    echo "You can enable it later with: gcloud services enable compute.googleapis.com"
fi

# Set default region/zone
echo ""
echo "🌍 Setting default region/zone..."
echo "Recommended regions for Claude Code:"
echo "  us-central1 (Iowa) - Low cost, good performance"
echo "  us-east1 (South Carolina) - Low cost"
echo "  us-west1 (Oregon) - Low cost"
echo ""

read -p "Preferred region (or press Enter for us-central1): " REGION
if [ -z "$REGION" ]; then
    REGION="us-central1"
fi

read -p "Preferred zone (or press Enter for ${REGION}-a): " ZONE  
if [ -z "$ZONE" ]; then
    ZONE="${REGION}-a"
fi

gcloud config set compute/region "$REGION"
gcloud config set compute/zone "$ZONE"

echo -e "${GREEN}✅ Default region/zone set${NC}"

# Summary
echo ""
echo -e "${PURPLE}🎉 Project Setup Complete!${NC}"
echo "=========================="
echo ""
echo "📋 Project Details:"
echo "   Name: $PROJECT_NAME"
echo "   ID: $PROJECT_ID"
echo "   Region: $REGION"
echo "   Zone: $ZONE"
echo ""
echo "🔗 Console: https://console.cloud.google.com/compute?project=$PROJECT_ID"
echo ""

# Check if billing is properly linked
BILLING_STATUS=$(gcloud beta billing projects describe "$PROJECT_ID" --format="value(billingEnabled)" 2>/dev/null || echo "false")
if [ "$BILLING_STATUS" = "True" ]; then
    echo -e "${GREEN}✅ Billing: Enabled${NC}"
    echo ""
    echo "🚀 Ready to create VMs! Next steps:"
    echo "   ./start-here.sh     # Interactive setup"
    echo "   ./simple-gcp-vm.sh  # Create first VM"
    echo ""
else
    echo -e "${YELLOW}⚠️  Billing: Not enabled${NC}"
    echo ""
    echo "❗ Before creating VMs, enable billing at:"
    echo "   https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID"
    echo ""
fi

# Save project info for other scripts
cat > .claude-gcp-project << EOF
# Claude Code GCP Project Configuration
# Auto-generated by create-project.sh
export GCP_PROJECT_ID="$PROJECT_ID"
export GCP_REGION="$REGION"
export GCP_ZONE="$ZONE"
export PROJECT_NAME="$PROJECT_NAME"
EOF

echo "💾 Project configuration saved to .claude-gcp-project"
echo ""

# Offer to create first VM
if [ "$BILLING_STATUS" = "True" ]; then
    echo -e "${BLUE}Would you like to create your first VM now?${NC}"
    read -p "Create VM? (y/N): " CREATE_VM
    
    if [[ "$CREATE_VM" =~ ^[Yy] ]]; then
        echo ""
        echo "🚀 Creating your first Claude Code VM..."
        ./simple-gcp-vm.sh
    fi
fi