#!/bin/bash

# Claude Code Orchestration Platform - Quick Start Script
# Gets new users up and running with a single command

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Banner
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║        Claude Code Orchestration Platform Setup              ║"
echo "║              Quick Start Installation                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Function to print colored messages
print_step() {
    echo -e "\n${GREEN}▶ $1${NC}"
}

print_info() {
    echo -e "${BLUE}  ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}  ⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}  ✗ $1${NC}"
}

print_success() {
    echo -e "${GREEN}  ✓ $1${NC}"
}

# Check prerequisites
print_step "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
else
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ required. Current: $(node -v)"
        exit 1
    fi
    print_success "Node.js $(node -v) found"
fi

# Check tmux
if ! command -v tmux &> /dev/null; then
    print_error "tmux is not installed. Please install tmux first."
    echo "  On macOS: brew install tmux"
    echo "  On Ubuntu: sudo apt-get install tmux"
    exit 1
else
    print_success "tmux $(tmux -V) found"
fi

# Check git
if ! command -v git &> /dev/null; then
    print_error "git is not installed. Please install git first."
    exit 1
else
    print_success "git $(git --version | cut -d' ' -f3) found"
fi

# Check Claude CLI
if ! command -v claude &> /dev/null; then
    print_warning "Claude CLI not found. Will attempt to install..."
    INSTALL_CLAUDE=true
else
    print_success "Claude CLI found at $(which claude)"
    INSTALL_CLAUDE=false
fi

# Create necessary directories
print_step "Setting up directory structure..."

DIRS=(
    "state"
    "logs"
    "config"
    "workflows/examples"
    "workflows/custom"
    "vm-integration/setup-scripts"
    "vm-integration/docs"
    "vm-integration/examples"
)

for dir in "${DIRS[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        print_success "Created $dir"
    else
        print_info "$dir already exists"
    fi
done

# Initialize state file if it doesn't exist
if [ ! -f "state/instances.json" ]; then
    echo '{"instances":{}}' > state/instances.json
    print_success "Initialized instance state file"
fi

# Create default configuration
print_step "Creating default configuration..."

if [ ! -f "config/orchestration.json" ]; then
    cat > config/orchestration.json << 'EOF'
{
  "defaults": {
    "instanceRole": "specialist",
    "workspaceMode": "isolated",
    "gitEnabled": true,
    "todoMonitoring": true,
    "timeout": 300000
  },
  "limits": {
    "maxInstances": 30,
    "maxInstanceAge": 7200000,
    "maxMemoryUsage": 80
  },
  "paths": {
    "stateFile": "state/instances.json",
    "logDir": "logs",
    "workflowDir": "workflows"
  }
}
EOF
    print_success "Created default configuration"
fi

# Install Claude CLI if needed
if [ "$INSTALL_CLAUDE" = true ]; then
    print_step "Installing Claude CLI..."
    print_info "Please follow the installation guide at:"
    print_info "https://github.com/anthropics/claude-cli"
    print_warning "After installing, run this script again."
    exit 0
fi

# Check package.json
if [ ! -f "package.json" ]; then
    print_step "Initializing package.json..."
    cat > package.json << 'EOF'
{
  "name": "tmux-claude-mcp-server",
  "version": "1.0.0",
  "description": "Claude Code Orchestration Platform",
  "type": "module",
  "scripts": {
    "monitor": "node scripts/system_monitor.cjs",
    "dashboard": "node scripts/orchestration_dashboard.cjs",
    "health": "node scripts/health_monitor.cjs --once",
    "cleanup": "node scripts/cleanup_instances.cjs",
    "optimize": "node scripts/performance_optimizer.cjs",
    "test": "node scripts/integration_tester.cjs",
    "maintenance": "node scripts/maintenance_scheduler.cjs",
    "workflow": "node src/workflow/workflow_engine.cjs"
  },
  "keywords": ["claude", "orchestration", "tmux", "mcp"],
  "author": "",
  "license": "MIT"
}
EOF
    print_success "Created package.json"
fi

# Create example workflow
print_step "Creating example workflow..."

if [ ! -f "workflows/examples/hello_world.yaml" ]; then
    cat > workflows/examples/hello_world.yaml << 'EOF'
name: Hello World Workflow
description: Simple workflow to test the system
version: 1.0

settings:
  useTaskIds: false
  poll_interval: 2
  timeout: 30
  instance_role: specialist

stages:
  - id: greeting
    name: Initial Greeting
    prompt: |
      Hello! This is a test of the workflow system.
      Please respond with: GREETING_COMPLETE
    trigger_keyword: GREETING_COMPLETE
    timeout: 30
    on_success:
      - action: log
        message: "✅ Greeting completed successfully!"
      - action: complete_workflow
EOF
    print_success "Created example workflow"
fi

# Run initial health check
print_step "Running system health check..."
node scripts/health_monitor.cjs --once 2>/dev/null || true

# Create launcher script
print_step "Creating launcher scripts..."

cat > start_monitoring.sh << 'EOF'
#!/bin/bash
# Start all monitoring services

echo "Starting Claude Code Monitoring Services..."

# Start system monitor in background
tmux new-session -d -s monitor 'node scripts/system_monitor.cjs'
echo "✓ System monitor started (tmux session: monitor)"

# Start maintenance scheduler in background
tmux new-session -d -s maintenance 'node scripts/maintenance_scheduler.cjs'
echo "✓ Maintenance scheduler started (tmux session: maintenance)"

echo ""
echo "Monitoring services are running in background."
echo "To view:"
echo "  System Monitor: tmux attach -t monitor"
echo "  Maintenance: tmux attach -t maintenance"
echo ""
echo "To stop all: ./stop_monitoring.sh"
EOF

cat > stop_monitoring.sh << 'EOF'
#!/bin/bash
# Stop all monitoring services

echo "Stopping Claude Code Monitoring Services..."

tmux kill-session -t monitor 2>/dev/null && echo "✓ System monitor stopped" || echo "ℹ System monitor not running"
tmux kill-session -t maintenance 2>/dev/null && echo "✓ Maintenance scheduler stopped" || echo "ℹ Maintenance not running"

echo "All monitoring services stopped."
EOF

chmod +x start_monitoring.sh stop_monitoring.sh
print_success "Created launcher scripts"

# Summary
echo -e "\n${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Setup Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"

echo -e "\n${BLUE}Quick Start Commands:${NC}"
echo "  📊 System Monitor:        npm run monitor"
echo "  🎮 Orchestration Dashboard: npm run dashboard"
echo "  🏥 Health Check:          npm run health"
echo "  🧹 Cleanup Instances:     npm run cleanup"
echo "  ⚡ Performance Analysis:  npm run optimize"
echo "  🧪 Run Tests:            npm run test"
echo "  🔧 Start Maintenance:     npm run maintenance"
echo "  🚀 Run Workflow:         npm run workflow <workflow.yaml>"

echo -e "\n${BLUE}Background Services:${NC}"
echo "  Start all monitoring:     ./start_monitoring.sh"
echo "  Stop all monitoring:      ./stop_monitoring.sh"

echo -e "\n${BLUE}First Steps:${NC}"
echo "  1. Run health check:      npm run health"
echo "  2. Start dashboard:       npm run dashboard"
echo "  3. Create first instance: node scripts/mcp_bridge.js spawn '{...}'"

echo -e "\n${BLUE}Documentation:${NC}"
echo "  Main docs:               docs/main/"
echo "  VM integration:          vm-integration/docs/"
echo "  Workflow examples:       workflows/examples/"

echo -e "\n${YELLOW}Tips:${NC}"
echo "  • Run 'npm run cleanup' regularly to free resources"
echo "  • Check 'npm run health' before major operations"
echo "  • Use 'npm run dashboard' for interactive control"

echo -e "\n${GREEN}Happy Orchestrating! 🎉${NC}\n"