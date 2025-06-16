#!/bin/bash

# Setup Claude Code on VM - Interactive Script
# This script helps set up Claude Code on the GCP VM

set -e

VM_NAME="claude-dev-1750040389"
ZONE="us-central1-a"

echo "🤖 Setting up Claude Code on VM: $VM_NAME"
echo "=========================================="

# Check VM status
echo "📊 Checking VM status..."
./manage-vm.sh status "$VM_NAME"

echo ""
echo "🔗 To set up Claude Code on the VM, we need to connect and run commands."
echo "Since SSH sessions are interactive, here are the commands to run:"
echo ""

echo "1️⃣  CONNECT TO VM:"
echo "   gcloud compute ssh ubuntu@$VM_NAME --zone=$ZONE"
echo ""

echo "2️⃣  ON THE VM, RUN THESE COMMANDS:"
echo ""

echo "# Check what's available"
echo "cat ~/start-here.txt"
echo "ls -la"
echo "which node && node --version"
echo "which npm && npm --version"
echo "which git && git --version"
echo ""

echo "# Create workspace"
echo "mkdir -p ~/workspace"
echo "cd ~/workspace"
echo ""

echo "# Check if Claude Code CLI exists (try different install methods)"
echo "# Method 1: pip install"
echo "pip3 install claude-code"
echo ""

echo "# Method 2: npm install (if pip fails)"
echo "npm install -g claude-code"
echo ""

echo "# Method 3: Download binary (if both fail)"
echo "curl -fsSL https://claude.ai/code/install.sh | sh"
echo ""

echo "# Test installation"
echo "claude-code --version"
echo "# or"
echo "claude --version"
echo ""

echo "# Start Claude Code"
echo "claude-code"
echo ""

echo "3️⃣  ALTERNATIVE - Use VS Code Remote SSH:"
echo "   In VS Code: Cmd+Shift+P → 'Remote-SSH: Connect to Host'"
echo "   Add: ubuntu@$(gcloud compute instances describe $VM_NAME --zone=$ZONE --format='value(networkInterfaces[0].accessConfigs[0].natIP)')"
echo ""

echo "🚀 Would you like to connect to the VM now? (y/n)"
read -p "Connect? " CONNECT

if [[ $CONNECT =~ ^[Yy] ]]; then
    echo ""
    echo "🔗 Connecting to VM..."
    echo "Run the commands above once connected!"
    echo ""
    gcloud compute ssh ubuntu@$VM_NAME --zone=$ZONE
else
    echo ""
    echo "💡 Copy the commands above and run them when you connect to the VM."
    echo "   Connection command: gcloud compute ssh ubuntu@$VM_NAME --zone=$ZONE"
fi