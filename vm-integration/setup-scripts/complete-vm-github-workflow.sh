#!/bin/bash
# Complete VM + GitHub Workflow Setup
# Based on successful claude-vm-test workflow analysis

set -e

# Configuration
VM_NAME=${1:-"claude-dev-$(date +%s)"}
ZONE=${2:-"us-central1-a"}
REPO_NAME=${3:-"claude-vm-project-$(date +%Y%m%d)"}
PROJECT_DESCRIPTION=${4:-"Claude Code VM development project"}

echo "🚀 Complete VM + GitHub Workflow Setup"
echo "=================================="
echo "VM Name: $VM_NAME"
echo "Zone: $ZONE" 
echo "Repo: $REPO_NAME"
echo ""

# Step 1: Install Claude Code on VM
echo "📦 Step 1: Installing Claude Code on VM..."
./install-claude-code-vm.sh "$VM_NAME" "$ZONE"

# Step 2: Create GitHub Repository
echo "🏗️ Step 2: Creating GitHub repository..."
REPO_URL=$(gh repo create "$REPO_NAME" --public --description "$PROJECT_DESCRIPTION" --clone=false)
echo "✅ Repository created: $REPO_URL"

# Step 3: Generate SSH Key on VM
echo "🔑 Step 3: Generating SSH key on VM..."
gcloud compute ssh ubuntu@$VM_NAME --zone=$ZONE --command="
ssh-keygen -t ed25519 -C '$REPO_NAME-vm-key' -f ~/.ssh/id_ed25519 -N ''
"

# Step 4: Get Public Key
echo "📋 Step 4: Extracting public key..."
VM_PUBLIC_KEY=$(gcloud compute ssh ubuntu@$VM_NAME --zone=$ZONE --command="cat ~/.ssh/id_ed25519.pub")
echo "Public key: $VM_PUBLIC_KEY"

# Step 5: Add to GitHub known hosts
echo "🌐 Step 5: Adding GitHub to known hosts..."
gcloud compute ssh ubuntu@$VM_NAME --zone=$ZONE --command="
ssh-keyscan github.com >> ~/.ssh/known_hosts
"

# Step 6: Add Deploy Key with Write Permissions
echo "🔐 Step 6: Adding deploy key to GitHub..."
echo "$VM_PUBLIC_KEY" > /tmp/vm_key_$VM_NAME.pub
gh repo deploy-key add /tmp/vm_key_$VM_NAME.pub --title "$VM_NAME SSH Key" --allow-write --repo "$REPO_NAME"
rm /tmp/vm_key_$VM_NAME.pub

# Step 7: Clone and Configure Git on VM
echo "📁 Step 7: Setting up git repository on VM..."
gcloud compute ssh ubuntu@$VM_NAME --zone=$ZONE --command="
cd ~ &&
git clone git@github.com:$(gh api user --jq .login)/$REPO_NAME.git &&
cd $REPO_NAME &&
git config user.name 'Claude VM Developer' &&
git config user.email 'claude-vm@example.com'
"

# Step 8: Create Sample Files
echo "📝 Step 8: Creating sample project files..."
gcloud compute ssh ubuntu@$VM_NAME --zone=$ZONE --command="
cd ~/$REPO_NAME &&
echo '# $REPO_NAME

Claude Code VM development project created on VM: $VM_NAME

## Setup Complete
- ✅ VM: $VM_NAME  
- ✅ Zone: $ZONE
- ✅ Claude Code: v1.0.24
- ✅ SSH Authentication: Configured
- ✅ Git Repository: Ready

## Usage
\`\`\`bash
# Connect to VM
gcloud compute ssh ubuntu@$VM_NAME --zone=$ZONE

# Start development
cd ~/$REPO_NAME
claude-code
\`\`\`
' > README.md &&

echo '{
  \"name\": \"$REPO_NAME\",
  \"version\": \"1.0.0\",
  \"description\": \"$PROJECT_DESCRIPTION\",
  \"main\": \"index.js\",
  \"scripts\": {
    \"start\": \"node index.js\",
    \"dev\": \"node index.js\"
  },
  \"author\": \"Claude VM\",
  \"license\": \"MIT\"
}' > package.json &&

echo 'console.log(\"Hello from Claude VM: $VM_NAME\");
console.log(\"Repository: $REPO_NAME\");
console.log(\"Ready for development!\");' > index.js
"

# Step 9: Initial Commit and Push
echo "⬆️ Step 9: Initial commit and push..."
gcloud compute ssh ubuntu@$VM_NAME --zone=$ZONE --command="
cd ~/$REPO_NAME &&
git add . &&
git commit -m 'Initial commit: VM $VM_NAME setup complete

- Claude Code v1.0.24 installed
- SSH authentication configured  
- Development environment ready' &&
git push origin main
"

# Step 10: Verify Success
echo "✅ Step 10: Verifying setup..."
echo ""
echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "📋 Summary:"
echo "  VM Name: $VM_NAME"
echo "  Zone: $ZONE"
echo "  Repository: $REPO_URL"
echo "  SSH Key: Configured with write access"
echo ""
echo "🔗 Connect to VM:"
echo "  gcloud compute ssh ubuntu@$VM_NAME --zone=$ZONE"
echo ""
echo "📁 Repository Path on VM:"
echo "  cd ~/$REPO_NAME"
echo ""
echo "🚀 Start Claude Code:"
echo "  claude-code"
echo ""
echo "🔄 Git Commands Ready:"
echo "  git add ."
echo "  git commit -m 'Your changes'"
echo "  git push origin main"
echo ""

# Verification
echo "🧪 Testing GitHub integration..."
if gh repo view "$REPO_NAME" >/dev/null 2>&1; then
    echo "✅ GitHub repository accessible"
    echo "✅ Files pushed successfully"
    echo ""
    echo "🎯 Ready for Claude Code development!"
else
    echo "❌ GitHub verification failed"
    exit 1
fi