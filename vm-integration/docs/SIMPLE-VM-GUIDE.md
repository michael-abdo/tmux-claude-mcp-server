# Simple Claude Code VM Setup (Google Cloud)

The absolute simplest way to get Claude Code running on a cloud VM.

## 🚀 Quick Start (5 minutes)

### 1. Prerequisites
- Google Cloud account with billing enabled
- `gcloud` CLI installed and authenticated

```bash
# Install gcloud CLI (if needed)
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Login and set project
gcloud auth login
gcloud config set project YOUR-PROJECT-ID
```

### 2. Create Your First VM

```bash
# Make scripts executable
chmod +x simple-gcp-vm.sh manage-vm.sh

# Create a VM (takes ~2 minutes)
./simple-gcp-vm.sh

# OR with custom settings
VM_NAME=my-claude-vm GCP_ZONE=us-west1-a ./simple-gcp-vm.sh
```

### 3. Connect and Start Coding

```bash
# Connect to your VM
./manage-vm.sh ssh your-vm-name

# Follow the setup instructions shown
cat ~/start-here.txt
```

## 🛠️ VM Management

```bash
# List all your VMs
./manage-vm.sh list

# Start a stopped VM
./manage-vm.sh start my-vm

# Stop a running VM (saves money)
./manage-vm.sh stop my-vm

# Get SSH command
./manage-vm.sh ssh my-vm

# Check VM status
./manage-vm.sh status my-vm

# Delete VM permanently
./manage-vm.sh delete my-vm
```

## 💰 Cost Information

**VM Specs:**
- Machine: e2-standard-4 (4 vCPU, 16GB RAM)
- Disk: 50GB standard
- Cost: ~$0.13/hour (~$95/month if left running)

**Cost Saving Tips:**
- Stop VMs when not in use: `./manage-vm.sh stop vm-name`
- Use preemptible instances for development (add to script)
- Consider smaller machine types for lighter workloads

## 🔧 Customization

### Environment Variables

```bash
# Customize VM creation
export GCP_PROJECT_ID="my-project"
export GCP_ZONE="us-central1-a"
export GCP_MACHINE_TYPE="e2-medium"
export VM_NAME="my-custom-vm"

./simple-gcp-vm.sh
```

### Machine Types
- `e2-micro` - 2 vCPU, 1GB RAM (~$7/month)
- `e2-small` - 2 vCPU, 2GB RAM (~$14/month)  
- `e2-medium` - 2 vCPU, 4GB RAM (~$27/month)
- `e2-standard-2` - 2 vCPU, 8GB RAM (~$49/month)
- `e2-standard-4` - 4 vCPU, 16GB RAM (~$95/month) **← Default**

## 🔍 Troubleshooting

### VM Won't Start
```bash
# Check VM status
./manage-vm.sh status vm-name

# View startup logs
gcloud compute instances get-serial-port-output vm-name --zone=us-central1-a
```

### Can't Connect via SSH
```bash
# Check firewall rules
gcloud compute firewall-rules list --filter="direction=INGRESS AND allowed[].ports:22"

# If no SSH rule exists, create one
gcloud compute firewall-rules create allow-ssh \
  --allow tcp:22 \
  --source-ranges 0.0.0.0/0 \
  --description "Allow SSH from anywhere"
```

### Out of Quota
- Check quotas: Cloud Console → IAM & Admin → Quotas
- Request quota increase if needed
- Try different regions/zones

## 🔐 Security Notes

- VMs are created with default firewall (SSH only)
- SSH keys are auto-generated on the VM
- No external services exposed by default
- Consider using IAP for SSH if needed

## 📁 What Gets Installed

- Ubuntu 22.04 LTS
- Node.js 20.x LTS
- Git with basic config
- SSH key pair for GitHub
- Basic development tools
- Workspace directory at `~/workspace`

## 🎯 Next Steps

1. **Add SSH Key to GitHub:**
   ```bash
   # On the VM, copy your public key
   cat ~/.ssh/id_ed25519.pub
   # Add this to GitHub → Settings → SSH Keys
   ```

2. **Clone Your Repos:**
   ```bash
   cd ~/workspace
   git clone git@github.com:username/repo.git
   ```

3. **Install Claude Code:**
   ```bash
   # When Claude Code CLI becomes available
   npm install -g claude-code
   # or pip install claude-code
   ```

4. **Start Developing:**
   - Use VS Code Remote SSH extension
   - Or work directly in terminal with tmux/screen
   - Push changes to GitHub as usual

## 🔄 Scaling Up

When you need more VMs:

```bash
# Create multiple VMs quickly
for i in {1..5}; do
  VM_NAME="dev-vm-$i" ./simple-gcp-vm.sh &
done
wait
```

For more advanced needs, check out the full VM integration system in this directory.

## 📞 Support

If something doesn't work:
1. Check the troubleshooting section above
2. Look at the generated startup script logs
3. Verify your GCP permissions and quotas
4. Try a different zone/region

---

**💡 Pro Tip:** Stop your VMs when you're done coding to save money. GCP bills by the minute, so you only pay for what you use!