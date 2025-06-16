#!/bin/bash

# Simple GCP VM Setup for Claude Code
# The simplest possible way to get Claude Code running on a cloud VM

set -e

# Load project configuration if available
if [ -f "$(dirname "$0")/.claude-gcp-project" ]; then
    source "$(dirname "$0")/.claude-gcp-project"
fi

# Configuration with fallbacks
PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project)}"
ZONE="${GCP_ZONE:-us-central1-a}"
MACHINE_TYPE="${GCP_MACHINE_TYPE:-e2-standard-4}"
VM_NAME="${VM_NAME:-claude-dev-$(date +%s)}"

echo "🚀 Creating Claude Code VM with Google Cloud..."
echo "📋 Project: $PROJECT_ID"
echo "🌍 Zone: $ZONE"
echo "💻 Machine: $MACHINE_TYPE"
echo "🏷️  Name: $VM_NAME"
echo ""

# Create startup script
cat > /tmp/claude-startup.sh << 'EOF'
#!/bin/bash
set -e

echo "🤖 Setting up Claude Code environment..."

# Update system
apt-get update -y
apt-get install -y git curl build-essential python3-pip

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

# Install Claude Code CLI (when available)
# For now, we'll set up the environment for it
pip3 install --upgrade pip

# Setup Git
git config --global init.defaultBranch main
git config --global user.email "claude-vm@$(hostname)"
git config --global user.name "Claude Dev VM"

# Generate SSH key
ssh-keygen -t ed25519 -C "claude-vm-$(hostname)" -f /home/ubuntu/.ssh/id_ed25519 -N ""
chown -R ubuntu:ubuntu /home/ubuntu/.ssh || true
chmod 600 /home/ubuntu/.ssh/id_ed25519 || true
chmod 644 /home/ubuntu/.ssh/id_ed25519.pub || true

# Create workspace
mkdir -p /home/ubuntu/workspace
chown -R ubuntu:ubuntu /home/ubuntu/workspace || true

# Setup welcome message
cat > /home/ubuntu/start-here.txt << 'INNER_EOF'
🤖 Claude Code VM Ready!

1. Add your SSH key to GitHub:
   cat ~/.ssh/id_ed25519.pub

2. Clone your repo:
   git clone git@github.com:username/repo.git

3. Start coding with Claude!

📁 Workspace: ~/workspace
🔑 SSH key: ~/.ssh/id_ed25519.pub
INNER_EOF

chown ubuntu:ubuntu /home/ubuntu/start-here.txt || true

echo "✅ Claude Code VM setup complete!"
EOF

# Create the VM
echo "🔨 Creating VM instance..."
gcloud compute instances create "$VM_NAME" \
  --project="$PROJECT_ID" \
  --zone="$ZONE" \
  --machine-type="$MACHINE_TYPE" \
  --network-interface=network-tier=STANDARD,subnet=default \
  --maintenance-policy=MIGRATE \
  --provisioning-model=STANDARD \
  --scopes=https://www.googleapis.com/auth/cloud-platform \
  --tags=claude-dev \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=50GB \
  --boot-disk-type=pd-standard \
  --metadata-from-file startup-script=/tmp/claude-startup.sh \
  --labels=type=claude-dev

# Wait for VM to be ready
echo "⏳ Waiting for VM to start..."
sleep 30

# Get VM IP
VM_IP=$(gcloud compute instances describe "$VM_NAME" --zone="$ZONE" --format="value(networkInterfaces[0].accessConfigs[0].natIP)")

echo ""
echo "🎉 VM Created Successfully!"
echo "════════════════════════"
echo "🏷️  Name: $VM_NAME"
echo "🌐 IP: $VM_IP"
echo "📍 Zone: $ZONE"
echo ""
echo "🔗 Connect via SSH:"
echo "   gcloud compute ssh ubuntu@$VM_NAME --zone=$ZONE"
echo ""
echo "💡 Next steps:"
echo "1. SSH to the VM (command above)"
echo "2. Follow instructions in ~/start-here.txt"
echo "3. Add SSH key to GitHub"
echo "4. Clone your repos and start coding!"
echo ""
echo "🛑 Stop VM to save money:"
echo "   gcloud compute instances stop $VM_NAME --zone=$ZONE"
echo ""
echo "🔄 Start VM again:"
echo "   gcloud compute instances start $VM_NAME --zone=$ZONE"
echo ""

# Clean up
rm -f /tmp/claude-startup.sh

echo "✅ Setup complete! VM is ready for Claude Code development."