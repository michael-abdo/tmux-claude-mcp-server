# Claude Code VM Integration

Simple, powerful cloud VM management for Claude Code development. Create and manage development VMs with one command.

## 🌟 Features

- **🚀 One-Command Setup**: Complete project and VM creation in minutes
- **💰 Cost Optimized**: Smart instance types, auto-stop scheduling, spot instance support
- **🔧 Zero Config**: Automated environment with Node.js, Git, SSH keys, and development tools
- **📊 Easy Management**: Simple commands to create, start, stop, and connect to VMs
- **🌍 Google Cloud**: Reliable, fast, and cost-effective cloud infrastructure
- **🎯 Multiple VMs**: Create and manage multiple development environments

## 🚀 Quick Start

### Complete Setup (5 minutes)
```bash
# Interactive setup - handles everything
./start-here.sh
```

### Manual Setup
```bash
# 1. Create dedicated project
./setup-scripts/create-project.sh

# 2. Create your first VM
./setup-scripts/simple-gcp-vm.sh

# 3. Connect and start coding
./manage-vm.sh ssh vm-name
```

## 📁 Project Structure

```
vm-integration/
├── README.md                    # This file
├── start-here.sh               # Interactive setup wizard  
├── manage-vm.sh               # Daily VM management
├── quick-start.sh             # Skip checks, direct actions
│
├── docs/                      # Documentation
│   ├── GETTING-STARTED.md     # Complete setup guide
│   ├── SCRIPTS-REFERENCE.md   # All scripts documented
│   ├── SIMPLE-VM-GUIDE.md     # VM basics
│   ├── claude_install_help.txt # Claude Code installation guide
│   ├── minimal-vm-setup-guide.md
│   └── gcp-claude-setup-guide.md
│
├── setup-scripts/             # Setup and initialization scripts
│   ├── create-project.sh      # Create new GCP project
│   ├── setup-billing.sh       # Enable billing on project
│   ├── simple-gcp-vm.sh       # Create single VM
│   ├── install-claude-code-vm.sh # One-step Claude Code installer
│   ├── setup-claude-code-on-vm.sh # Research Claude Code setup
│   └── claude-dev-setup.sh    # Automated VM setup script
│
├── lib/                       # Core modules and utilities
│   ├── vm_manager.js          # VM lifecycle management
│   ├── vm_mcp_tools.js        # MCP integration tools
│   ├── integrate_vm_mcp.js    # MCP bridge integration
│   └── vm-cli.js              # Advanced CLI tool
│
├── examples/                  # Demo code
│   ├── demo_vm_integration.js
│   └── demo_enhanced_logging.js
│
├── tests/                     # Testing utilities
│   ├── test_vm_integration.js
│   └── test-vm-creation.sh
│
├── utils/                     # Utility modules
│   └── logger.js              # Structured logging
│
└── bottleneck_detection/      # Performance diagnostics
    ├── README.md
    ├── bottleneck_analyzer.py
    └── [monitoring tools...]
```

## 🎯 Common Workflows

### First Time Setup
```bash
./start-here.sh              # Complete guided setup
```

### Daily Development
```bash
./manage-vm.sh list          # See all VMs
./manage-vm.sh start my-vm   # Start development VM
./manage-vm.sh ssh my-vm     # Connect and code
./manage-vm.sh stop my-vm    # Stop to save costs
```

### Multiple VMs
```bash
# Create several VMs
for i in {1..3}; do 
  VM_NAME=dev-vm-$i ./setup-scripts/simple-gcp-vm.sh
done

# Manage them
./manage-vm.sh list
./manage-vm.sh ssh dev-vm-1
```

### Cost Management
```bash
# List running VMs and costs
./manage-vm.sh list

# Stop all VMs to save money
for vm in $(./manage-vm.sh list | grep RUNNING | awk '{print $1}'); do
  ./manage-vm.sh stop $vm
done
```

## 💰 Cost Information

| Machine Type | vCPU | RAM | Monthly Cost* |
|--------------|------|-----|---------------|
| e2-micro | 2 | 1GB | ~$7 |
| e2-small | 2 | 2GB | ~$14 |
| e2-medium | 2 | 4GB | ~$27 |
| e2-standard-2 | 2 | 8GB | ~$49 |
| e2-standard-4 | 4 | 16GB | ~$95 |

*If left running 24/7. Stop VMs when not in use to save money!

## 🔧 Configuration

### Environment Variables
```bash
# Project settings
export GCP_PROJECT_ID="my-project"
export GCP_REGION="us-central1" 
export GCP_ZONE="us-central1-a"

# VM settings
export VM_NAME="my-dev-vm"
export GCP_MACHINE_TYPE="e2-standard-2"
```

### Persistent Configuration
Created automatically by `setup-scripts/create-project.sh`:
```bash
# .claude-gcp-project (auto-loaded by scripts)
export GCP_PROJECT_ID="claude-code-dev-20250615-1851"
export GCP_REGION="us-central1"
export GCP_ZONE="us-central1-a"
export PROJECT_NAME="Claude Code Development"
```

## 🛠️ Script Reference

### Core Scripts (Root Directory)
| Script | Purpose | Example |
|--------|---------|---------|
| `start-here.sh` | Interactive setup wizard | `./start-here.sh` |
| `manage-vm.sh` | Daily VM operations | `./manage-vm.sh list` |
| `quick-start.sh` | Skip checks, direct actions | `./quick-start.sh` |

### Setup Scripts (`setup-scripts/`)
| Script | Purpose | Example |
|--------|---------|---------|
| `create-project.sh` | Create new GCP project | `./setup-scripts/create-project.sh` |
| `setup-billing.sh` | Enable billing on project | `./setup-scripts/setup-billing.sh` |
| `simple-gcp-vm.sh` | Create single VM | `./setup-scripts/simple-gcp-vm.sh` |
| `install-claude-code-vm.sh` | One-step Claude Code installer | `./setup-scripts/install-claude-code-vm.sh` |
| `setup-claude-code-on-vm.sh` | Research Claude Code setup | `./setup-scripts/setup-claude-code-on-vm.sh` |
| `claude-dev-setup.sh` | Automated VM setup script | `./setup-scripts/claude-dev-setup.sh` |

### Library Scripts (`lib/`)
| Script | Purpose | Example |
|--------|---------|---------|
| `vm-cli.js` | Advanced CLI tool | `node lib/vm-cli.js --help` |

See `docs/SCRIPTS-REFERENCE.md` for complete documentation.

## 🔍 Troubleshooting

### Common Issues

**"gcloud: command not found"**
```bash
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

**"Project not found"**
```bash
./setup-scripts/create-project.sh    # Create new project
# OR
gcloud config set project existing-project-id
```

**"Billing not enabled"**
```bash
./setup-scripts/setup-billing.sh    # Enable billing
```

**VM won't start**
```bash
./manage-vm.sh status vm-name    # Check status
gcloud compute instances get-serial-port-output vm-name --zone=us-central1-a
```

**Install Claude Code on VM**
```bash
# One-step installation (recommended)
./setup-scripts/install-claude-code-vm.sh vm-name zone

# Manual installation
./manage-vm.sh ssh vm-name
sudo npm install -g @anthropic-ai/claude-code
```

## 📚 Documentation

- **`docs/GETTING-STARTED.md`** - Complete setup guide
- **`docs/SCRIPTS-REFERENCE.md`** - All scripts documented
- **`docs/SIMPLE-VM-GUIDE.md`** - VM basics and cost info

## 🤝 Getting Help

1. **Start with**: `./start-here.sh` for guided setup
2. **Check docs**: `docs/GETTING-STARTED.md` for detailed guides
3. **Test first**: `tests/test-vm-creation.sh` to validate setup
4. **Use quick start**: `./quick-start.sh` when you know your setup works

## 🎯 Next Steps

1. **First VM**: Run `./start-here.sh` for complete setup
2. **Development**: Connect via SSH, add GitHub keys, clone repos
3. **Scale up**: Create multiple VMs for different projects
4. **Optimize**: Use smaller instances, stop VMs when not in use

---

**Ready to scale your Claude development to the cloud!** 🚀

Start with: `./start-here.sh`