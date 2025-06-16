# Claude Code Orchestration Platform - Documentation Index

## 📚 Complete Documentation Guide

Welcome to the Claude Code Orchestration Platform! This index provides a comprehensive guide to all documentation, tools, and features available in the system.

---

## 🚀 Quick Start

### First Time Setup
```bash
# Run the quick start script
./scripts/quick_start.sh

# Start monitoring services
./start_monitoring.sh

# Open the orchestration dashboard
npm run dashboard
```

### Essential Commands
- `npm run monitor` - Real-time system monitor
- `npm run health` - System health check
- `npm run cleanup` - Clean stale instances
- `npm run dashboard` - Interactive control center

---

## 📖 Core Documentation

### Architecture & Design
- **[Main Implementation](main/tmux-claude-implementation.md)** - Complete system architecture
- **[MVP Implementation](main/tmux-mvp-implementation.md)** - Phase 1 implementation guide
- **[MCP Specification](main/tmux-manager-MCP.md)** - MCP server API documentation
- **[MCP Implementation Guide](main/tmux-manager-MCP-implementation.md)** - Code migration guide

### Design Principles
- **[Meet Them Where They Are](DESIGN_PRINCIPLE_MEET_THEM_WHERE_THEY_ARE.md)** - Context-aware instructions
- **[Scope Contract Architecture](SCOPE_CONTRACT_ARCHITECTURE.md)** - Managing scope boundaries

### System Documentation
- **[CLAUDE.md](../CLAUDE.md)** - Main system documentation
- **[README.md](../README.md)** - Project overview

---

## 🛠️ Tools Documentation

### Monitoring Tools

#### System Monitor (`scripts/system_monitor.cjs`)
Real-time dashboard showing system statistics.
```bash
npm run monitor
```
**Features:**
- Live instance tracking
- Git repository status
- Workflow metrics
- VM integration status
- Performance metrics

#### Health Monitor (`scripts/health_monitor.cjs`)
Automated health checking system.
```bash
npm run health              # One-time check
node scripts/health_monitor.cjs --interval 30  # Continuous monitoring
```
**Checks:**
- Git repository health
- Instance management
- Tmux sessions
- File system integrity
- Memory usage
- Workflow system

#### Performance Optimizer (`scripts/performance_optimizer.cjs`)
Analyzes system performance and provides recommendations.
```bash
npm run optimize            # Basic analysis
npm run optimize -- --detailed  # Detailed recommendations
```

### Management Tools

#### Orchestration Dashboard (`scripts/orchestration_dashboard.cjs`)
Interactive control center for managing Claude instances.
```bash
npm run dashboard
```
**View Modes:**
- Overview (O) - System statistics
- Details (D) - Instance information
- Logs (L) - System logs
- Control (C) - Execute actions

**Controls:**
- Arrow keys - Navigate instances
- Enter - Select instance
- 1-6 - Execute actions in Control mode
- Q - Quit

#### Instance Cleanup (`scripts/cleanup_instances.cjs`)
Safely removes stale instances and resources.
```bash
npm run cleanup             # Default cleanup
node scripts/cleanup_instances.cjs --dry-run  # Preview changes
node scripts/cleanup_instances.cjs --stale-threshold 30  # Custom threshold
```

#### Maintenance Scheduler (`scripts/maintenance_scheduler.cjs`)
Automated background maintenance tasks.
```bash
npm run maintenance
```
**Scheduled Tasks:**
- Instance cleanup (hourly)
- Health checks (30 minutes)
- Performance optimization (2 hours)
- Git maintenance (daily)
- Log rotation (daily)

### Testing & Validation

#### Integration Tester (`scripts/integration_tester.cjs`)
Comprehensive test suite for system validation.
```bash
npm run test
```
**Test Coverage:**
- Git repository health
- Instance state management
- MCP bridge connectivity
- Workflow engine
- Tmux sessions
- VM integration
- Performance monitoring
- File system integrity
- Documentation
- Configuration

### Backup & Recovery

#### Backup System (`scripts/backup_recovery.cjs`)
Complete disaster recovery solution.
```bash
# Create backup
node scripts/backup_recovery.cjs backup "Description"

# List backups
node scripts/backup_recovery.cjs list

# Restore from backup
node scripts/backup_recovery.cjs restore <backup-id>

# Verify backup
node scripts/backup_recovery.cjs verify <backup-id>
```

---

## 🔧 Workflow System

### Workflow Engine (`src/workflow/workflow_engine.cjs`)
Execute YAML-based workflows for orchestration.
```bash
npm run workflow workflows/examples/simple_workflow.yaml
```

### Example Workflows
Located in `workflows/examples/`:
- `hello_world.yaml` - Basic test workflow
- `simple_workflow.yaml` - Stage progression demo
- `parallel_analysis.yaml` - Parallel execution
- `comprehensive_demo.yaml` - Advanced features
- `error_handling.yaml` - Error recovery patterns

### Workflow Structure
```yaml
name: Workflow Name
description: Description
version: 1.0

settings:
  useTaskIds: false
  poll_interval: 2
  timeout: 60

stages:
  - id: stage_id
    name: Stage Name
    prompt: |
      Instructions for Claude
    trigger_keyword: COMPLETE
    on_success:
      - action: next_stage
```

---

## ☁️ VM Integration

### VM Deployment (`vm-integration/deploy_orchestration_vm.sh`)
Automated GCP VM provisioning with complete setup.
```bash
# Set environment variables
export GCP_PROJECT_ID=your-project
export GITHUB_REPO=your-org/your-repo
export GITHUB_TOKEN=your-token

# Deploy VM
./vm-integration/deploy_orchestration_vm.sh
```

### VM Setup Scripts
Located in `vm-integration/setup-scripts/`:
- `install-claude-cli.sh` - Claude CLI installation
- `setup-tmux-sessions.sh` - Tmux configuration
- `complete-vm-github-workflow.sh` - Full automation

### VM Documentation
- [Setup Guide](../vm-integration/docs/vm-setup-guide.md)
- [GCP Configuration](../vm-integration/docs/gcp-configuration.md)
- [Integration Guide](../vm-integration/docs/integration-guide.md)

---

## 🔌 MCP Bridge

### Bridge Commands (`scripts/mcp_bridge.js`)

#### List Instances
```bash
node scripts/mcp_bridge.js list '{}'
```

#### Spawn Instance
```bash
node scripts/mcp_bridge.js spawn '{
  "role": "specialist",
  "workDir": "/path/to/work",
  "context": "Task description"
}'
```

#### Send Message
```bash
node scripts/mcp_bridge.js send '{
  "instanceId": "spec_1_1_123",
  "text": "Your message here"
}'
```

#### Read Output
```bash
node scripts/mcp_bridge.js read '{
  "instanceId": "spec_1_1_123",
  "lines": 50
}'
```

#### Terminate Instance
```bash
node scripts/mcp_bridge.js terminate '{
  "instanceId": "spec_1_1_123"
}'
```

---

## 📊 Configuration Files

### Main Configuration (`config/orchestration.json`)
```json
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
  }
}
```

### Maintenance Configuration (`config/maintenance.json`)
Controls automated maintenance schedules and retention policies.

### Backup Configuration (`config/backup.json`)
Defines backup schedules, retention, and inclusion/exclusion patterns.

---

## 📈 Performance Tuning

### System Requirements
- **Minimum**: 4GB RAM, 2 CPU cores, 20GB disk
- **Recommended**: 16GB RAM, 4 CPU cores, 50GB disk
- **Production**: 32GB RAM, 8 CPU cores, 100GB disk

### Optimization Tips
1. Run `npm run cleanup` regularly
2. Monitor with `npm run health`
3. Use `npm run optimize` for recommendations
4. Enable maintenance scheduler
5. Configure appropriate instance limits

### Troubleshooting

#### High Memory Usage
```bash
# Check instance count
node scripts/mcp_bridge.js list '{}' | jq '.instances | length'

# Clean stale instances
npm run cleanup

# Optimize performance
npm run optimize -- --detailed
```

#### MCP Bridge Timeout
```bash
# Check tmux sessions
tmux ls

# Verify instance state
cat state/instances.json | jq

# Restart specific instance
node scripts/mcp_bridge.js terminate '{"instanceId": "ID"}'
```

---

## 🔐 Security Considerations

### Best Practices
1. Never commit sensitive data
2. Use environment variables for secrets
3. Restrict file permissions appropriately
4. Regular security audits
5. Keep dependencies updated

### SSH Key Management
- Store keys in `~/.ssh/`
- Use Ed25519 format
- Set proper permissions (600)
- Use SSH agent forwarding

---

## 📝 Development Guide

### Adding New Tools
1. Create script in `scripts/`
2. Use `.cjs` extension for CommonJS
3. Add npm script to `package.json`
4. Update documentation
5. Add integration tests

### Workflow Development
1. Create YAML in `workflows/custom/`
2. Test with small instances first
3. Use clear trigger keywords
4. Implement error handling
5. Document thoroughly

### Contributing
1. Follow existing patterns
2. Add comprehensive tests
3. Update documentation
4. Use meaningful commit messages
5. Test on multiple platforms

---

## 🚨 Emergency Procedures

### System Recovery
```bash
# 1. Check system health
npm run health

# 2. Stop all instances
tmux kill-server

# 3. Clear state
echo '{"instances":{}}' > state/instances.json

# 4. Restart services
./start_monitoring.sh
```

### Backup Recovery
```bash
# List available backups
node scripts/backup_recovery.cjs list

# Restore from backup
node scripts/backup_recovery.cjs restore <backup-id> --force
```

---

## 📞 Support & Resources

### Getting Help
- Check logs in `logs/` directory
- Run `npm run health` for diagnostics
- Review integration test results
- Consult troubleshooting guides

### Community Resources
- [GitHub Issues](https://github.com/anthropics/claude-code/issues)
- [Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Discord Community](#)

### Version Information
- Platform Version: 1.0.0
- Node.js Required: 18+
- Claude CLI: Latest

---

## 🎯 Next Steps

1. **Complete Setup**: Run `./scripts/quick_start.sh`
2. **Start Monitoring**: Execute `./start_monitoring.sh`
3. **Test System**: Run `npm run test`
4. **Create First Instance**: Use MCP bridge spawn command
5. **Explore Dashboard**: Launch `npm run dashboard`

---

*Last Updated: June 2025*
*Documentation Version: 1.0.0*