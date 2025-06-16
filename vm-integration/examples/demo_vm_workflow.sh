#!/bin/bash
# VM Integration Workflow Demonstration
# Shows how to set up a complete Claude Code development environment

set -e

echo "🚀 Claude Code VM Integration Demonstration"
echo "============================================"
echo ""
echo "This script demonstrates the complete workflow for:"
echo "1. Setting up Claude Code on a GCP VM"
echo "2. Creating a GitHub repository" 
echo "3. Establishing SSH authentication"
echo "4. Testing the development workflow"
echo ""

# Configuration (demo mode - shows commands without execution)
DEMO_MODE=${DEMO_MODE:-true}
VM_NAME="claude-dev-demo-$(date +%s)"
ZONE="us-central1-a"
REPO_NAME="claude-vm-demo-$(date +%Y%m%d)"

echo "📝 Configuration:"
echo "  VM Name: $VM_NAME"
echo "  Zone: $ZONE"
echo "  Repository: $REPO_NAME"
echo ""

run_command() {
    echo "🔧 $1"
    if [ "$DEMO_MODE" = "true" ]; then
        echo "   [DEMO MODE] Would execute: $2"
    else
        echo "   Executing: $2"
        eval "$2"
    fi
    echo ""
}

echo "📦 Phase 1: VM Setup and Claude Code Installation"
echo "================================================"

run_command "Create GCP VM instance" \
    "gcloud compute instances create $VM_NAME --zone=$ZONE --machine-type=e2-medium --image-family=ubuntu-2004-lts --image-project=ubuntu-os-cloud"

run_command "Install Claude Code on VM" \
    "./vm-integration/setup-scripts/install-claude-code-vm.sh $VM_NAME $ZONE"

echo "🐙 Phase 2: GitHub Repository Setup"
echo "==================================="

run_command "Create GitHub repository" \
    "gh repo create $REPO_NAME --public --description 'Claude Code VM development project'"

run_command "Generate SSH key on VM" \
    "gcloud compute ssh $VM_NAME --zone=$ZONE --command='ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N \"\"'"

run_command "Add deploy key to GitHub" \
    "gh repo deploy-key add /tmp/vm_key.pub --title '$VM_NAME SSH Key' --allow-write --repo $REPO_NAME"

echo "🔗 Phase 3: Development Workflow Test"
echo "===================================="

run_command "Clone repository on VM" \
    "gcloud compute ssh $VM_NAME --zone=$ZONE --command='git clone git@github.com:username/$REPO_NAME.git'"

run_command "Create sample application" \
    "gcloud compute ssh $VM_NAME --zone=$ZONE --command='cd $REPO_NAME && echo \"console.log(\\\"Hello from Claude VM!\\\");\" > app.js'"

run_command "Commit and push changes" \
    "gcloud compute ssh $VM_NAME --zone=$ZONE --command='cd $REPO_NAME && git add app.js && git commit -m \"feat: Add sample application\" && git push origin main'"

echo "✅ Phase 4: Verification"
echo "======================="

run_command "Verify GitHub push" \
    "gh repo view $REPO_NAME --web"

run_command "Test Claude Code on VM" \
    "gcloud compute ssh $VM_NAME --zone=$ZONE --command='claude --version'"

echo ""
echo "🎉 VM Integration Demonstration Complete!"
echo ""
echo "📋 Summary of Capabilities:"
echo "  ✅ Automated VM creation and setup"
echo "  ✅ Claude Code v1.0.24 installation"
echo "  ✅ SSH key generation and GitHub integration"
echo "  ✅ Complete development workflow"
echo "  ✅ One-click automation scripts"
echo ""
echo "🔧 Available Scripts:"
echo "  • vm-integration/setup-scripts/complete-vm-github-workflow.sh"
echo "  • vm-integration/setup-scripts/install-claude-code-vm.sh"
echo "  • vm-integration/setup-scripts/simple-gcp-vm.sh"
echo ""
echo "📚 Documentation:"
echo "  • vm-integration/docs/vm-github-workflow-requirements.md"
echo "  • vm-integration/docs/gcp-claude-setup-guide.md"
echo "  • vm-integration/README.md"
echo ""

if [ "$DEMO_MODE" = "true" ]; then
    echo "💡 To run this demonstration with actual execution:"
    echo "   DEMO_MODE=false $0"
    echo ""
    echo "⚠️  Note: Requires active GCP project and GitHub CLI authentication"
fi