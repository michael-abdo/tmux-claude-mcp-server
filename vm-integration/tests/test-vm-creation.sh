#!/bin/bash

# Test VM creation with the latest image
# This script tests VM creation without actually creating a VM

set -e

# Load project configuration if available
if [ -f "$(dirname "$0")/.claude-gcp-project" ]; then
    source "$(dirname "$0")/.claude-gcp-project"
fi

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project)}"
ZONE="${GCP_ZONE:-us-central1-a}"
MACHINE_TYPE="${GCP_MACHINE_TYPE:-e2-standard-4}"

echo "🧪 Testing VM creation parameters..."
echo "Project: $PROJECT_ID"
echo "Zone: $ZONE"
echo "Machine: $MACHINE_TYPE"
echo ""

# Test if the image family exists
echo "🔍 Checking Ubuntu image availability..."
if gcloud compute images describe-from-family ubuntu-2204-lts --project=ubuntu-os-cloud >/dev/null 2>&1; then
    LATEST_IMAGE=$(gcloud compute images describe-from-family ubuntu-2204-lts --project=ubuntu-os-cloud --format="value(name)")
    echo "✅ Latest Ubuntu 22.04 image: $LATEST_IMAGE"
else
    echo "❌ Ubuntu 22.04 image family not found"
    exit 1
fi

# Test if machine type exists in zone
echo ""
echo "🔍 Checking machine type availability..."
if gcloud compute machine-types describe "$MACHINE_TYPE" --zone="$ZONE" >/dev/null 2>&1; then
    echo "✅ Machine type $MACHINE_TYPE available in $ZONE"
else
    echo "❌ Machine type $MACHINE_TYPE not available in $ZONE"
    echo "Available machine types:"
    gcloud compute machine-types list --filter="zone:$ZONE" --format="table(name,guestCpus,memoryMb)" | head -10
    exit 1
fi

# Test project permissions
echo ""
echo "🔍 Checking project permissions..."
if gcloud compute instances list --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo "✅ Have compute permissions for project $PROJECT_ID"
else
    echo "❌ No compute permissions for project $PROJECT_ID"
    exit 1
fi

echo ""
echo "🎉 All tests passed! VM creation should work."
echo ""
echo "To create VM:"
echo "  ./simple-gcp-vm.sh"
echo ""