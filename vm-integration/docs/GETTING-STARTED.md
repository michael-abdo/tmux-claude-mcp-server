# Getting Started with Claude Code VMs

The complete guide to setting up cloud VMs for Claude Code development.

## 🚀 Quick Start (Complete Setup)

### Option 1: Complete Automated Setup
```bash
# One command to set everything up
./start-here.sh
```

### Option 2: Step by Step

#### 1. Create New GCP Project
```bash
# Create a dedicated project for Claude Code
./create-project.sh
```

#### 2. Create Your First VM
```bash
# Create VM with defaults
./simple-gcp-vm.sh

# Or customize
VM_NAME=my-dev-vm GCP_MACHINE_TYPE=e2-medium ./simple-gcp-vm.sh
```

#### 3. Start Coding
```bash
# Connect to VM
./manage-vm.sh ssh vm-name

# Follow setup instructions on VM
cat ~/start-here.txt
```

## 📋 Prerequisites

### 1. Google Cloud CLI
```bash
# Install (if not installed)
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Authenticate
gcloud auth login
```

### 2. Enable Billing
- Go to [Google Cloud Console](https://console.cloud.google.com/billing)
- Create billing account or link existing one
- Enable billing for your project

## 🛠️ Project Management

### Create New Project
```bash
./create-project.sh
```
**What it does:**
- Creates new GCP project with unique ID
- Enables required APIs (Compute Engine, Billing)
- Sets up firewall rules for SSH
- Links billing account
- Configures default region/zone
- Saves settings for other scripts

### Use Existing Project
```bash
# Set existing project as default
gcloud config set project YOUR-PROJECT-ID

# Then proceed with VM creation
./simple-gcp-vm.sh
```

## 🖥️ VM Management

### Create VMs
```bash
# Basic VM creation
./simple-gcp-vm.sh

# Custom configuration
VM_NAME=my-vm GCP_MACHINE_TYPE=e2-large ./simple-gcp-vm.sh

# Multiple VMs
for i in {1..3}; do VM_NAME=dev-vm-$i ./simple-gcp-vm.sh; done
```

### Manage Existing VMs
```bash
# List all VMs
./manage-vm.sh list

# Start/stop VMs
./manage-vm.sh start vm-name
./manage-vm.sh stop vm-name

# Connect via SSH
./manage-vm.sh ssh vm-name

# Get VM status
./manage-vm.sh status vm-name

# Delete VM
./manage-vm.sh delete vm-name
```

## 💰 Cost Management

### Machine Types & Costs
| Type | vCPU | RAM | Cost/Month* |
|------|------|-----|-------------|
| e2-micro | 2 | 1GB | ~$7 |
| e2-small | 2 | 2GB | ~$14 |
| e2-medium | 2 | 4GB | ~$27 |
| e2-standard-2 | 2 | 8GB | ~$49 |
| e2-standard-4 | 4 | 16GB | ~$95 |

*If left running 24/7. Stop when not in use to save money.

### Cost Optimization
```bash
# Stop VMs when not coding
./manage-vm.sh stop vm-name

# Use smaller machine types for light work
GCP_MACHINE_TYPE=e2-medium ./simple-gcp-vm.sh

# Use preemptible instances (add to script)
# 70% cost savings but can be terminated
```

## 🔧 Configuration

### Environment Variables
```bash
# Project settings
export GCP_PROJECT_ID="my-project"
export GCP_REGION="us-central1"
export GCP_ZONE="us-central1-a"

# VM settings
export VM_NAME="my-claude-vm"
export GCP_MACHINE_TYPE="e2-standard-2"
```

### Persistent Configuration
The `create-project.sh` script creates `.claude-gcp-project` with your settings:
```bash
# Auto-loaded by other scripts
source .claude-gcp-project
```

## 🔍 Troubleshooting

### Common Issues

#### "gcloud: command not found"
```bash
# Install Google Cloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

#### "Project not found"
```bash
# Make sure project exists and you have access
gcloud projects list
gcloud config set project YOUR-PROJECT-ID
```

#### "Billing not enabled"
```bash
# Enable billing in console
open https://console.cloud.google.com/billing
```

#### "SSH connection refused"
```bash
# Check VM is running
./manage-vm.sh status vm-name

# Check firewall rules
gcloud compute firewall-rules list --filter="direction=INGRESS AND allowed[].ports:22"
```

#### "Out of quota"
```bash
# Check quotas
gcloud compute project-info describe --format="table(quotas.metric,quotas.limit,quotas.usage)"

# Request quota increase in console
open https://console.cloud.google.com/iam-admin/quotas
```

### Getting Help
```bash
# Show detailed VM creation logs
gcloud compute instances get-serial-port-output vm-name --zone=us-central1-a

# Validate setup
./start-here.sh

# Check project configuration
cat .claude-gcp-project
```

## 🎯 Next Steps After VM Creation

### 1. On the VM
```bash
# Connect to your VM
./manage-vm.sh ssh vm-name

# Follow the setup guide
cat ~/start-here.txt

# Add SSH key to GitHub
cat ~/.ssh/id_ed25519.pub
# Copy this to GitHub → Settings → SSH Keys
```

### 2. Development Setup
```bash
# Clone your repositories
cd ~/workspace
git clone git@github.com:username/repo.git

# Install Claude Code (when available)
npm install -g claude-code

# Start developing!
```

### 3. Best Practices
- Stop VMs when not in use
- Use version control for all code
- Regular backups of important work
- Monitor costs in GCP Console

## 🔗 Useful Links

- [Google Cloud Console](https://console.cloud.google.com)
- [GCP Pricing Calculator](https://cloud.google.com/products/calculator)
- [VM Instance Pricing](https://cloud.google.com/compute/vm-instance-pricing)
- [gcloud CLI Reference](https://cloud.google.com/sdk/gcloud/reference)

---

**💡 Pro Tip:** Use `./start-here.sh` for the complete interactive setup experience!