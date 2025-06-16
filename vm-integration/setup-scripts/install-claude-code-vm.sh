#!/bin/bash
# One-Step Claude Code Installation for Ubuntu VMs
# Based on successful specialist testing - works start to finish
set -e

VM_NAME=${1:-"claude-dev-1750040389"}
ZONE=${2:-"us-central1-a"}

echo "🚀 Installing Claude Code on VM: $VM_NAME"
echo "📍 Zone: $ZONE"

# Update system and install dependencies
echo "📦 Step 1: Updating system and installing dependencies..."
gcloud compute ssh ubuntu@$VM_NAME --zone=$ZONE --command="
sudo apt update && sudo apt upgrade -y &&
sudo apt install -y curl wget git python3 python3-pip nodejs npm
"

# Install Claude Code (official package)
echo "🔧 Step 2: Installing Claude Code via npm..."
gcloud compute ssh ubuntu@$VM_NAME --zone=$ZONE --command="
sudo npm install -g @anthropic-ai/claude-code
"

# Create symlink for easy access
echo "🔗 Step 3: Creating symlink for claude-code command..."
gcloud compute ssh ubuntu@$VM_NAME --zone=$ZONE --command="
sudo ln -sf /usr/lib/node_modules/@anthropic-ai/claude-code/cli.js /usr/local/bin/claude-code
"

# Verify installation
echo "✅ Step 4: Verifying Claude Code installation..."
VERSION_OUTPUT=$(gcloud compute ssh ubuntu@$VM_NAME --zone=$ZONE --command="claude-code --version" 2>/dev/null || echo "FAILED")

if [[ "$VERSION_OUTPUT" == *"Claude Code"* ]]; then
    echo "🎉 SUCCESS! Claude Code installed successfully"
    echo "📋 Version: $VERSION_OUTPUT"
    echo ""
    echo "💡 To use Claude Code on the VM:"
    echo "   1. Connect: gcloud compute ssh ubuntu@$VM_NAME --zone=$ZONE"
    echo "   2. Run: claude-code"
    echo ""
    echo "🔧 System Info:"
    gcloud compute ssh ubuntu@$VM_NAME --zone=$ZONE --command="
    echo 'Node.js:' \$(node --version)
    echo 'npm:' \$(npm --version)  
    echo 'Python:' \$(python3 --version)
    echo 'Git:' \$(git --version)
    "
else
    echo "❌ FAILED: Claude Code installation failed"
    echo "Output: $VERSION_OUTPUT"
    exit 1
fi

echo "🏁 Claude Code setup complete on $VM_NAME!"