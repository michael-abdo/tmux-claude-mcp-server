# VM Integration for tmux-claude MCP Server

Seamless cloud VM management for Claude Code development environments. Extends the existing MCP orchestration system to support cloud-based development VMs with automated provisioning and management.

## 🌟 Features

- **🚀 One-Command VM Creation**: Spin up development VMs with Claude Code pre-installed
- **💰 Cost Optimization**: Built-in spot instance support and auto-scheduling
- **🔧 Automated Setup**: Complete development environment with Node.js, Git, tmux, and more
- **🤖 MCP Integration**: Full integration with existing Claude orchestration system
- **📊 Comprehensive Management**: Create, start, stop, terminate, and monitor VMs
- **🔑 SSH Management**: Automated SSH key generation and connection commands
- **📸 AMI Templates**: Create reusable VM templates for consistent environments
- **🎯 Bulk Operations**: Create multiple VMs for parallel development

## 🏗️ Architecture

The VM integration extends the existing tmux-claude architecture patterns:

```
┌─────────────────────────────────────────────────────────────┐
│                   Claude MCP Server                        │
├─────────────────────────────────────────────────────────────┤
│  Executive → Manager → Specialist (Local Instances)        │
│              ↓                                             │
│           VM Manager                                        │
│              ↓                                             │
│  AWS EC2 ← VM Instance ← VM Instance ← VM Instance         │
│           (Remote Claude Environments)                     │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

1. **AWS CLI installed and configured**
   ```bash
   # Install AWS CLI v2
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   
   # Configure credentials
   aws configure
   ```

2. **AWS Key Pair for SSH access**
   ```bash
   aws ec2 create-key-pair --key-name claude-dev-key \
     --query 'KeyMaterial' --output text > ~/.ssh/claude-dev-key.pem
   chmod 400 ~/.ssh/claude-dev-key.pem
   ```

3. **Security Group for SSH access**
   ```bash
   aws ec2 create-security-group \
     --group-name claude-dev-sg \
     --description "Claude development VMs"
   
   aws ec2 authorize-security-group-ingress \
     --group-name claude-dev-sg \
     --protocol tcp --port 22 \
     --cidr YOUR-IP/32
   ```

### Installation

```bash
# Install VM integration dependencies
npm install @aws-sdk/client-ec2 aws-cli

# Make CLI executable
chmod +x vm-integration/vm-cli.js
```

### Basic Usage

#### Create a Development VM
```bash
# Create a standard development VM
node vm-integration/vm-cli.js create my-dev-vm

# Create a cost-optimized spot instance
node vm-integration/vm-cli.js create spot-vm --spot --max-price 0.05

# Create with custom instance type
node vm-integration/vm-cli.js create powerful-vm --instance-type m5.2xlarge
```

#### List and Manage VMs
```bash
# List all VMs
node vm-integration/vm-cli.js list

# Get VM status
node vm-integration/vm-cli.js status my-dev-vm

# Get SSH connection command
node vm-integration/vm-cli.js ssh my-dev-vm
```

#### VM Lifecycle Management
```bash
# Stop VM to save costs (preserves data)
node vm-integration/vm-cli.js stop my-dev-vm

# Start stopped VM
node vm-integration/vm-cli.js start my-dev-vm

# Terminate VM (permanent deletion)
node vm-integration/vm-cli.js terminate my-dev-vm
```

#### Create Reusable Templates
```bash
# Create AMI from configured VM
node vm-integration/vm-cli.js image my-dev-vm my-template

# Use template for new VMs
node vm-integration/vm-cli.js create new-vm --image-id ami-12345678
```

## 🤖 MCP Integration

The VM integration provides MCP tools that can be used by Claude instances:

### Available MCP Tools

- `vm_create` - Create new VM instances
- `vm_list` - List all VM instances
- `vm_start` - Start stopped instances
- `vm_stop` - Stop running instances
- `vm_terminate` - Permanently delete instances
- `vm_status` - Get detailed instance status
- `vm_ssh` - Get SSH connection information
- `vm_create_image` - Create AMI templates
- `vm_bulk_create` - Create multiple instances

### MCP Usage Examples

```javascript
// Create a development VM via MCP
{
  "name": "vm_create",
  "arguments": {
    "name": "claude-dev-1",
    "instanceType": "m5.xlarge",
    "spot": true,
    "maxPrice": "0.10"
  }
}

// List all VMs
{
  "name": "vm_list",
  "arguments": {}
}

// Create multiple VMs for parallel work
{
  "name": "vm_bulk_create", 
  "arguments": {
    "namePrefix": "parallel-dev",
    "count": 5,
    "instanceType": "m5.large",
    "spot": true
  }
}
```

## 📁 Project Structure

```
vm-integration/
├── README.md                    # This file
├── minimal-vm-setup-guide.md    # Original setup guide
├── vm_manager.js                # Core VM management class
├── vm_cli.js                    # Command-line interface
├── vm_mcp_tools.js              # MCP tools integration
├── setup-scripts/
│   └── claude-dev-setup.sh      # VM initialization script
└── tests/
    └── test_vm_integration.js   # Comprehensive test suite
```

## 🛠️ Automated VM Setup

Each VM is automatically configured with:

### Development Environment
- ✅ **Node.js 20.x LTS** - Latest stable Node.js
- ✅ **Python 3 + pip** - Python development tools
- ✅ **Git** - Version control with global configuration
- ✅ **tmux/screen** - Terminal multiplexing
- ✅ **Build tools** - gcc, make, build-essential

### Cloud & DevOps Tools
- ✅ **AWS CLI v2** - Cloud resource management
- ✅ **Docker** - Container support
- ✅ **SSH Keys** - Auto-generated for GitHub integration

### Development Utilities
- ✅ **VS Code friendly** - Ready for remote development
- ✅ **Monitoring tools** - htop, logging, metrics
- ✅ **Package managers** - npm, pip3 with useful packages

### Claude Code Integration
- ✅ **Optimized environment** - Tuned for Claude development
- ✅ **Project workspace** - Organized directory structure
- ✅ **Auto-start scripts** - Quick setup guidance on login

## 💰 Cost Optimization

### Spot Instances
```bash
# Use spot instances for 70-90% cost savings
node vm-integration/vm-cli.js create spot-vm --spot --max-price 0.05
```

### Auto-Scheduling
```bash
# Stop VMs automatically at night (save costs)
# Add to crontab:
0 22 * * * node vm-integration/vm-cli.js stop my-dev-vm

# Start VMs in the morning
0 8 * * * node vm-integration/vm-cli.js start my-dev-vm
```

### Resource Optimization
- **Right-sizing**: Start with `t3.medium`, scale up as needed
- **Regional selection**: Choose closest region for latency
- **Storage optimization**: Use gp3 volumes for better price/performance

## 🔧 Advanced Usage

### Custom AMI Creation
```bash
# Setup your perfect development environment
node vm-integration/vm-cli.js create template-vm
# ... customize the VM via SSH ...

# Create reusable template
node vm-integration/vm-cli.js image template-vm my-dev-template

# Use template for instant deployments
node vm-integration/vm-cli.js create quick-vm --image-id ami-your-template
```

### Bulk Development Environments
```javascript
// Via MCP tools
{
  "name": "vm_bulk_create",
  "arguments": {
    "namePrefix": "team-dev",
    "count": 10,
    "instanceType": "m5.large",
    "spot": true
  }
}
```

### Integration with Existing Workflows
```javascript
// Spawn Claude instance on VM
{
  "name": "spawn",
  "arguments": {
    "role": "specialist",
    "workDir": "/remote/project",
    "context": "Work on the remote VM environment...",
    "vmInstance": "my-dev-vm"  // Custom extension
  }
}
```

## 🧪 Testing

```bash
# Run comprehensive test suite
node vm-integration/tests/test_vm_integration.js

# Run with verbose output
VM_TEST_VERBOSE=true node vm-integration/tests/test_vm_integration.js

# Run against real AWS (requires credentials)
VM_TEST_MOCK=false node vm-integration/tests/test_vm_integration.js
```

## 🔒 Security Best Practices

### SSH Security
- Use strong key pairs with proper permissions
- Restrict security groups to your IP address
- Regular key rotation for long-term usage

### IAM Permissions
Required AWS permissions for VM management:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:RunInstances",
        "ec2:DescribeInstances", 
        "ec2:StartInstances",
        "ec2:StopInstances",
        "ec2:TerminateInstances",
        "ec2:CreateImage",
        "ec2:DescribeImages"
      ],
      "Resource": "*"
    }
  ]
}
```

### Data Protection
- Regular snapshots of important work
- Use encrypted EBS volumes for sensitive data
- Backup critical projects to version control

## 🚀 Scaling Strategies

### Development Team Scaling
1. **Individual VMs**: One VM per developer
2. **Shared Templates**: Common AMI for consistency
3. **Auto-Scaling**: Dynamic VM creation based on demand
4. **Cost Monitoring**: Track usage and optimize regularly

### CI/CD Integration
- Use VMs for isolated testing environments
- Parallel test execution across multiple VMs
- Automated deployment and teardown

## 🔧 Troubleshooting

### Common Issues

**AWS CLI not configured**
```bash
aws configure
# Enter your access key, secret key, region, and output format
```

**SSH key permissions error**
```bash
chmod 400 ~/.ssh/claude-dev-key.pem
```

**Instance not responding**
```bash
# Check instance status
node vm-integration/vm-cli.js status my-vm

# Check security group allows SSH from your IP
aws ec2 describe-security-groups --group-names claude-dev-sg
```

**Cost concerns**
```bash
# List all running instances
node vm-integration/vm-cli.js list

# Stop unused instances
node vm-integration/vm-cli.js stop unused-vm
```

### Debug Mode
```bash
# Enable verbose logging
VM_TEST_VERBOSE=true node vm-integration/vm-cli.js list
```

## 🔮 Future Enhancements

- **Multi-cloud support**: Azure, GCP integration
- **Container orchestration**: Kubernetes/ECS integration
- **Advanced monitoring**: CloudWatch integration
- **Auto-scaling groups**: Dynamic scaling based on load
- **Cost analytics**: Detailed cost tracking and optimization
- **Team management**: User access controls and sharing

## 📚 Related Documentation

- [Minimal VM Setup Guide](minimal-vm-setup-guide.md) - Quick setup reference
- [MCP Bridge Integration](../docs/MCP_BRIDGE_INTEGRATION_PLAN.md) - How VMs integrate with MCP
- [Performance Optimization](../docs/PERFORMANCE_OPTIMIZATION_GUIDE.md) - Optimization strategies
- [Architecture Overview](../docs/tmux-claude-implementation.md) - Overall system design

## 🤝 Contributing

1. Test changes thoroughly with the test suite
2. Update documentation for new features
3. Follow existing code patterns and conventions
4. Consider cost implications of new features
5. Test both mock and real AWS environments

## 📄 License

This VM integration is part of the tmux-claude MCP Server project and uses the same MIT license.

---

**Ready to scale your Claude development to the cloud!** 🚀