#!/bin/bash

# Claude Code Orchestration Platform - VM Deployment Script
# Automatically deploys a complete orchestration environment on GCP

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-}"
ZONE="${GCP_ZONE:-us-central1-a}"
MACHINE_TYPE="${MACHINE_TYPE:-e2-standard-4}"
DISK_SIZE="${DISK_SIZE:-50}"
VM_PREFIX="${VM_PREFIX:-claude-orch}"
GITHUB_REPO="${GITHUB_REPO:-}"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Generate unique VM name
VM_NAME="${VM_PREFIX}-$(date +%Y%m%d-%H%M%S)"

# Functions
print_banner() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║     Claude Code Orchestration Platform VM Deployment        ║"
    echo "║                  Automated Setup Script                      ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "\n${GREEN}▶ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_step "Checking prerequisites..."
    
    # Check gcloud
    if ! command -v gcloud &> /dev/null; then
        print_error "gcloud CLI not installed. Please install Google Cloud SDK."
        exit 1
    fi
    
    # Check if logged in
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
        print_error "Not logged into gcloud. Run: gcloud auth login"
        exit 1
    fi
    
    # Check project
    if [ -z "$PROJECT_ID" ]; then
        PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
        if [ -z "$PROJECT_ID" ]; then
            print_error "No GCP project set. Set GCP_PROJECT_ID or run: gcloud config set project PROJECT_ID"
            exit 1
        fi
    fi
    
    print_success "Prerequisites satisfied"
    print_info "Project: $PROJECT_ID"
    print_info "Zone: $ZONE"
}

# Create startup script
create_startup_script() {
    print_step "Creating startup script..."
    
    cat > /tmp/claude_orch_startup.sh << 'STARTUP_SCRIPT'
#!/bin/bash

# Startup script for Claude Orchestration VM
set -e

# Logging
exec > >(tee -a /var/log/claude-setup.log)
exec 2>&1

echo "Starting Claude Orchestration Platform setup..."
echo "Timestamp: $(date)"

# Update system
apt-get update
apt-get upgrade -y

# Install dependencies
apt-get install -y \
    curl \
    git \
    tmux \
    jq \
    build-essential \
    python3-pip \
    htop \
    ncdu \
    tree

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install Claude CLI
echo "Installing Claude CLI..."
npm install -g @anthropic-ai/claude-cli@latest || {
    echo "Claude CLI installation requires manual intervention"
    echo "Please install from: https://github.com/anthropics/claude-cli"
}

# Create claude user
if ! id -u claude &>/dev/null; then
    useradd -m -s /bin/bash claude
    usermod -aG sudo claude
    echo "claude ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
fi

# Setup directory structure
sudo -u claude bash << 'CLAUDE_SETUP'
cd /home/claude

# Clone orchestration platform
if [ -n "$GITHUB_REPO" ] && [ -n "$GITHUB_TOKEN" ]; then
    git clone https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git orchestration
else
    # Create from scratch
    mkdir -p orchestration
    cd orchestration
    
    # Initialize git repo
    git init
    
    # Create directory structure
    mkdir -p {src,scripts,state,logs,config,workflows/examples,vm-integration}
    
    # Create initial files
    echo '{"instances":{}}' > state/instances.json
    
    # Download essential scripts from the setup
    BASE_URL="https://raw.githubusercontent.com/anthropics/claude-orchestration/main"
    
    # Download core scripts
    curl -s "$BASE_URL/scripts/mcp_bridge.js" > scripts/mcp_bridge.js || echo "// MCP Bridge placeholder" > scripts/mcp_bridge.js
    curl -s "$BASE_URL/scripts/system_monitor.cjs" > scripts/system_monitor.cjs || echo "// Monitor placeholder" > scripts/system_monitor.cjs
    
    # Create package.json
    cat > package.json << 'EOF'
{
  "name": "claude-orchestration-vm",
  "version": "1.0.0",
  "description": "Claude Code Orchestration Platform on VM",
  "type": "module",
  "scripts": {
    "start": "node scripts/orchestration_dashboard.cjs",
    "monitor": "node scripts/system_monitor.cjs",
    "health": "node scripts/health_monitor.cjs --once"
  }
}
EOF
fi

# Setup environment
cat > .env << EOF
ORCHESTRATION_MODE=vm
VM_NAME=$(hostname)
DEPLOYMENT_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF

# Create systemd services
sudo tee /etc/systemd/system/claude-monitor.service > /dev/null << EOF
[Unit]
Description=Claude Orchestration Monitor
After=network.target

[Service]
Type=simple
User=claude
WorkingDirectory=/home/claude/orchestration
ExecStart=/usr/bin/node /home/claude/orchestration/scripts/system_monitor.cjs
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/claude-maintenance.service > /dev/null << EOF
[Unit]
Description=Claude Orchestration Maintenance
After=network.target

[Service]
Type=simple
User=claude
WorkingDirectory=/home/claude/orchestration
ExecStart=/usr/bin/node /home/claude/orchestration/scripts/maintenance_scheduler.cjs
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable services
sudo systemctl daemon-reload
sudo systemctl enable claude-monitor claude-maintenance
sudo systemctl start claude-monitor claude-maintenance

CLAUDE_SETUP

# Setup tmux configuration
cat > /home/claude/.tmux.conf << 'EOF'
# Claude Orchestration tmux config
set -g base-index 1
set -g pane-base-index 1
set -g status-interval 5
set -g status-left-length 30
set -g status-right-length 60
set -g status-left '#[fg=green](#S) #(whoami) '
set -g status-right '#[fg=yellow]#(cut -d " " -f 1-3 /proc/loadavg)#[default] #[fg=white]%H:%M#[default]'

# Better colors
set -g default-terminal "screen-256color"

# Mouse support
set -g mouse on

# Larger history
set -g history-limit 10000
EOF

chown claude:claude /home/claude/.tmux.conf

# Create welcome script
cat > /home/claude/welcome.sh << 'EOF'
#!/bin/bash

echo "🎉 Welcome to Claude Orchestration Platform VM!"
echo ""
echo "📊 System Status:"
systemctl status claude-monitor --no-pager | head -5
systemctl status claude-maintenance --no-pager | head -5
echo ""
echo "🚀 Quick Commands:"
echo "  cd ~/orchestration      # Go to orchestration directory"
echo "  npm run monitor         # Start system monitor"
echo "  npm run health         # Run health check"
echo "  tmux ls                # List tmux sessions"
echo ""
echo "📖 Documentation available in ~/orchestration/docs/"
echo ""
EOF

chmod +x /home/claude/welcome.sh
chown claude:claude /home/claude/welcome.sh

# Add to bashrc
echo "" >> /home/claude/.bashrc
echo "# Claude Orchestration" >> /home/claude/.bashrc
echo "[ -f ~/welcome.sh ] && ~/welcome.sh" >> /home/claude/.bashrc

# Final setup message
cat > /var/log/claude-ready << EOF
Claude Orchestration Platform VM Setup Complete!

VM Name: $(hostname)
Setup Time: $(date)
Node Version: $(node -v)
NPM Version: $(npm -v)

Services Status:
- Monitor: $(systemctl is-active claude-monitor)
- Maintenance: $(systemctl is-active claude-maintenance)

SSH Access:
ssh claude@$(curl -s ifconfig.me)

Web Dashboard: http://$(curl -s ifconfig.me):3000 (if configured)
EOF

echo "✅ Claude Orchestration Platform setup complete!"

STARTUP_SCRIPT
    
    # Add repo-specific configuration if provided
    if [ -n "$GITHUB_REPO" ] && [ -n "$GITHUB_TOKEN" ]; then
        sed -i "s|GITHUB_REPO=|GITHUB_REPO=$GITHUB_REPO|" /tmp/claude_orch_startup.sh
        sed -i "s|GITHUB_TOKEN=|GITHUB_TOKEN=$GITHUB_TOKEN|" /tmp/claude_orch_startup.sh
    fi
    
    print_success "Startup script created"
}

# Create VM
create_vm() {
    print_step "Creating GCP VM instance..."
    print_info "VM Name: $VM_NAME"
    
    gcloud compute instances create "$VM_NAME" \
        --project="$PROJECT_ID" \
        --zone="$ZONE" \
        --machine-type="$MACHINE_TYPE" \
        --network-interface=network-tier=PREMIUM,subnet=default \
        --maintenance-policy=MIGRATE \
        --provisioning-model=STANDARD \
        --scopes=https://www.googleapis.com/auth/cloud-platform \
        --tags=http-server,https-server \
        --create-disk=auto-delete=yes,boot=yes,device-name="$VM_NAME",image=projects/ubuntu-os-cloud/global/images/ubuntu-2204-jammy-v20240119,mode=rw,size="$DISK_SIZE",type=pd-standard \
        --no-shielded-secure-boot \
        --shielded-vtpm \
        --shielded-integrity-monitoring \
        --reservation-affinity=any \
        --metadata-from-file startup-script=/tmp/claude_orch_startup.sh \
        --labels=purpose=claude-orchestration,environment=production
    
    print_success "VM created successfully"
}

# Create firewall rules
setup_firewall() {
    print_step "Setting up firewall rules..."
    
    # Check if rules exist
    if ! gcloud compute firewall-rules describe claude-orchestration-web --project="$PROJECT_ID" &>/dev/null; then
        gcloud compute firewall-rules create claude-orchestration-web \
            --project="$PROJECT_ID" \
            --allow=tcp:3000,tcp:8080 \
            --source-ranges=0.0.0.0/0 \
            --target-tags=http-server \
            --description="Allow Claude Orchestration web access"
        
        print_success "Firewall rules created"
    else
        print_info "Firewall rules already exist"
    fi
}

# Wait for VM to be ready
wait_for_vm() {
    print_step "Waiting for VM to be ready..."
    
    # Wait for SSH to be available
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if gcloud compute ssh "$VM_NAME" --zone="$ZONE" --project="$PROJECT_ID" --command="echo 'SSH ready'" &>/dev/null; then
            print_success "VM is ready for SSH"
            break
        fi
        
        echo -n "."
        sleep 10
        ((attempt++))
    done
    
    if [ $attempt -eq $max_attempts ]; then
        print_error "Timeout waiting for VM to be ready"
        exit 1
    fi
}

# Check setup status
check_setup_status() {
    print_step "Checking setup status..."
    
    # Check if setup is complete
    local max_attempts=60
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if gcloud compute ssh "$VM_NAME" --zone="$ZONE" --project="$PROJECT_ID" \
            --command="[ -f /var/log/claude-ready ] && echo 'READY'" 2>/dev/null | grep -q "READY"; then
            
            print_success "Setup completed successfully!"
            
            # Get setup details
            gcloud compute ssh "$VM_NAME" --zone="$ZONE" --project="$PROJECT_ID" \
                --command="cat /var/log/claude-ready" 2>/dev/null
            
            break
        fi
        
        echo -n "."
        sleep 10
        ((attempt++))
    done
    
    if [ $attempt -eq $max_attempts ]; then
        print_error "Setup did not complete in time. Check /var/log/claude-setup.log on the VM."
    fi
}

# Generate connection info
generate_connection_info() {
    print_step "Generating connection information..."
    
    # Get external IP
    EXTERNAL_IP=$(gcloud compute instances describe "$VM_NAME" \
        --zone="$ZONE" \
        --project="$PROJECT_ID" \
        --format="get(networkInterfaces[0].accessConfigs[0].natIP)")
    
    cat > "vm_connection_${VM_NAME}.txt" << EOF
Claude Orchestration Platform VM Connection Info
================================================

VM Name: $VM_NAME
Project: $PROJECT_ID
Zone: $ZONE
External IP: $EXTERNAL_IP

SSH Access:
-----------
gcloud compute ssh claude@$VM_NAME --zone=$ZONE --project=$PROJECT_ID

Or with standard SSH:
ssh claude@$EXTERNAL_IP

Quick Commands After Login:
--------------------------
cd ~/orchestration          # Go to orchestration directory
npm run monitor            # Start system monitor
npm run health            # Check system health
sudo systemctl status claude-monitor    # Check monitor service
sudo systemctl status claude-maintenance # Check maintenance service
tmux ls                    # List tmux sessions
journalctl -u claude-monitor -f  # View monitor logs

Web Access (if configured):
---------------------------
Dashboard: http://$EXTERNAL_IP:3000
API: http://$EXTERNAL_IP:8080

Troubleshooting:
----------------
sudo tail -f /var/log/claude-setup.log  # View setup logs
sudo systemctl restart claude-monitor   # Restart monitor
sudo systemctl restart claude-maintenance # Restart maintenance

To Delete VM:
-------------
gcloud compute instances delete $VM_NAME --zone=$ZONE --project=$PROJECT_ID

EOF
    
    print_success "Connection info saved to: vm_connection_${VM_NAME}.txt"
    
    echo -e "\n${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ VM Deployment Complete!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${BLUE}SSH into your VM:${NC}"
    echo "  gcloud compute ssh claude@$VM_NAME --zone=$ZONE --project=$PROJECT_ID"
    echo ""
    echo -e "${BLUE}Or use standard SSH:${NC}"
    echo "  ssh claude@$EXTERNAL_IP"
    echo ""
}

# Main execution
main() {
    print_banner
    
    # Check prerequisites
    check_prerequisites
    
    # Create startup script
    create_startup_script
    
    # Create VM
    create_vm
    
    # Setup firewall
    setup_firewall
    
    # Wait for VM
    wait_for_vm
    
    # Check setup status
    check_setup_status
    
    # Generate connection info
    generate_connection_info
    
    # Cleanup
    rm -f /tmp/claude_orch_startup.sh
}

# Run main function
main "$@"