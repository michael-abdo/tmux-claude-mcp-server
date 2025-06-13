#!/bin/bash

# Claude Code Development Environment Setup Script
# Automated VM provisioning for Claude development environments
# Version: 1.0.0

set -e  # Exit on any error

echo "🚀 Starting Claude Code development environment setup..."
echo "📅 $(date)"

# Update system packages
echo "📦 Updating system packages..."
apt-get update -y
apt-get upgrade -y

# Install essential development tools
echo "🔧 Installing essential development tools..."
apt-get install -y \
    git \
    curl \
    wget \
    build-essential \
    python3 \
    python3-pip \
    vim \
    nano \
    htop \
    tmux \
    screen \
    unzip \
    jq \
    tree \
    net-tools

# Install Node.js (latest LTS)
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt-get install -y nodejs

# Verify Node.js installation
node_version=$(node --version)
npm_version=$(npm --version)
echo "✅ Node.js installed: $node_version"
echo "✅ npm installed: $npm_version"

# Install AWS CLI v2
echo "☁️  Installing AWS CLI v2..."
cd /tmp
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
aws --version

# Install Claude Code CLI (if available via pip)
echo "🤖 Installing Claude Code..."
# Note: Adjust this based on actual Claude Code installation method
pip3 install --upgrade pip
# pip3 install claude-code  # Uncomment when available

# Setup Git configuration (placeholder - will be customized per user)
echo "📝 Setting up Git configuration..."
git config --global init.defaultBranch main
git config --global pull.rebase false
git config --global core.editor "vim"

# Generate SSH key for GitHub
echo "🔑 Generating SSH key..."
ssh-keygen -t ed25519 -C "claude-dev-vm@$(hostname)" -f /home/ubuntu/.ssh/id_ed25519 -N ""
chown -R ubuntu:ubuntu /home/ubuntu/.ssh
chmod 600 /home/ubuntu/.ssh/id_ed25519
chmod 644 /home/ubuntu/.ssh/id_ed25519.pub

# Create development directories
echo "📁 Creating development workspace..."
mkdir -p /home/ubuntu/projects
mkdir -p /home/ubuntu/claude-workspaces
mkdir -p /home/ubuntu/logs
chown -R ubuntu:ubuntu /home/ubuntu/projects
chown -R ubuntu:ubuntu /home/ubuntu/claude-workspaces
chown -R ubuntu:ubuntu /home/ubuntu/logs

# Install useful development utilities
echo "🛠️  Installing additional development utilities..."
npm install -g \
    typescript \
    nodemon \
    pm2 \
    eslint \
    prettier

# Setup tmux configuration
echo "🖥️  Setting up tmux configuration..."
cat > /home/ubuntu/.tmux.conf << 'EOF'
# Enable mouse support
set -g mouse on

# Set default terminal mode to 256color mode
set -g default-terminal "screen-256color"

# Enable activity alerts
setw -g monitor-activity on
set -g visual-activity on

# Set window and pane index to 1 (0 by default)
set-option -g base-index 1
setw -g pane-base-index 1

# Rename window to reflect current program
setw -g automatic-rename on

# Renumber windows when a window is closed
set -g renumber-windows on

# Set terminal title
set -g set-titles on

# Slightly longer pane indicators display time
set -g display-panes-time 800

# Slightly longer status messages display time
set -g display-time 1000

# Redraw status line every 10 seconds
set -g status-interval 10
EOF
chown ubuntu:ubuntu /home/ubuntu/.tmux.conf

# Setup bash profile enhancements
echo "🐚 Setting up bash profile..."
cat >> /home/ubuntu/.bashrc << 'EOF'

# Claude Code Development Environment
export CLAUDE_DEV_VM=true
export CLAUDE_WORKSPACE="/home/ubuntu/claude-workspaces"
export PROJECT_ROOT="/home/ubuntu/projects"

# Useful aliases
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
alias ..='cd ..'
alias ...='cd ../..'
alias grep='grep --color=auto'
alias fgrep='fgrep --color=auto'
alias egrep='egrep --color=auto'

# Development aliases
alias tmux-new='tmux new-session -d -s'
alias tmux-attach='tmux attach-session -t'
alias tmux-list='tmux list-sessions'
alias claude-logs='tail -f /home/ubuntu/logs/claude.log'

# Git shortcuts
alias gs='git status'
alias ga='git add'
alias gc='git commit'
alias gp='git push'
alias gl='git pull'
alias gb='git branch'
alias gco='git checkout'

# Welcome message
echo "🤖 Claude Code Development Environment Ready!"
echo "📁 Projects: $PROJECT_ROOT"
echo "🔧 Workspaces: $CLAUDE_WORKSPACE"
echo "📄 Logs: /home/ubuntu/logs/"
echo ""
echo "💡 Quick start:"
echo "   - Clone a repo: git clone <repo-url> && cd <repo>"
echo "   - Start Claude: claude-code"
echo "   - New tmux session: tmux-new <session-name>"
echo ""
EOF

# Setup log rotation
echo "📋 Setting up log rotation..."
cat > /etc/logrotate.d/claude-dev << 'EOF'
/home/ubuntu/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 ubuntu ubuntu
}
EOF

# Create startup script for Claude environment
echo "🚀 Creating startup script..."
cat > /home/ubuntu/start-claude-env.sh << 'EOF'
#!/bin/bash

echo "🤖 Starting Claude Code development environment..."

# Display system info
echo "📊 System Information:"
echo "   Hostname: $(hostname)"
echo "   IP Address: $(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo 'N/A')"
echo "   Instance ID: $(curl -s http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null || echo 'N/A')"
echo "   Instance Type: $(curl -s http://169.254.169.254/latest/meta-data/instance-type 2>/dev/null || echo 'N/A')"
echo ""

# Display SSH key for GitHub
echo "🔑 SSH Public Key (add to GitHub):"
echo "----------------------------------------"
cat /home/ubuntu/.ssh/id_ed25519.pub
echo "----------------------------------------"
echo ""

# Show quick start guide
echo "💡 Quick Start Guide:"
echo "1. Add the SSH key above to your GitHub account"
echo "2. Clone your repository: git clone git@github.com:username/repo.git"
echo "3. Navigate to project: cd repo"
echo "4. Start Claude Code: claude-code"
echo ""

echo "✅ Claude Code environment ready!"
EOF
chmod +x /home/ubuntu/start-claude-env.sh
chown ubuntu:ubuntu /home/ubuntu/start-claude-env.sh

# Setup automatic welcome message
echo "💬 Setting up welcome message..."
cat >> /home/ubuntu/.profile << 'EOF'

# Auto-run startup script on login
if [ -t 0 ] && [ -z "$TMUX" ]; then
    /home/ubuntu/start-claude-env.sh
fi
EOF

# Install Docker (optional but useful)
echo "🐳 Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu
rm get-docker.sh

# Install Python packages commonly used with Claude
echo "🐍 Installing Python packages..."
pip3 install --user \
    requests \
    pyyaml \
    click \
    colorama \
    rich

# Set timezone to UTC
echo "🕐 Setting timezone..."
timedatectl set-timezone UTC

# Enable automatic security updates
echo "🔒 Enabling automatic security updates..."
apt-get install -y unattended-upgrades
echo 'Unattended-Upgrade::Automatic-Reboot "false";' >> /etc/apt/apt.conf.d/50unattended-upgrades

# Clean up
echo "🧹 Cleaning up..."
apt-get autoremove -y
apt-get autoclean

# Create completion marker
echo "✅ Setup completed successfully!" > /home/ubuntu/setup-complete.txt
echo "📅 Setup completed: $(date)" >> /home/ubuntu/setup-complete.txt
chown ubuntu:ubuntu /home/ubuntu/setup-complete.txt

# Final system info
echo ""
echo "🎉 Claude Code Development Environment Setup Complete!"
echo "📅 $(date)"
echo "💾 Disk usage: $(df -h / | tail -1 | awk '{print $3"/"$2" ("$5" used)"}')"
echo "🔧 Node.js: $(node --version)"
echo "📦 npm: $(npm --version)"
echo "☁️  AWS CLI: $(aws --version | head -1)"
echo "🐳 Docker: $(docker --version)"
echo ""
echo "🚀 Ready for Claude Code development!"
echo "👤 Login as 'ubuntu' user to start developing"
echo ""

# Log completion
logger "Claude Code development environment setup completed successfully"