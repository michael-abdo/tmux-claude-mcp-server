# Claude Code Orchestration Platform

This repository implements a comprehensive orchestration system for managing multiple Claude instances through tmux sessions, workflows, and VM integration.

## Quick Start

1. **System Monitor**: `node scripts/system_monitor.cjs`
2. **Performance Analysis**: `node scripts/performance_optimizer.cjs`
3. **Integration Tests**: `node scripts/integration_tester.cjs`
4. **Run Workflow**: `node src/workflow/workflow_engine.cjs workflows/examples/simple_workflow.yaml`

## Architecture Overview

The system implements a hierarchical orchestration model:

```
Executive (Primary Claude)
    ├── Managers (Orchestration)
    │   └── Specialists (Task Execution)
    └── Direct Specialists
```

## Key Components

### Instance Management
- **MCP Bridge**: Inter-instance communication via `scripts/mcp_bridge.js`
- **State Tracking**: JSON-based state in `state/instances.json`
- **Tmux Sessions**: Automated session lifecycle management

### Workflow System
- **YAML-based**: Define complex multi-stage workflows
- **Keyword Monitoring**: Automatic stage progression
- **Conditional Logic**: Branching and error handling

### VM Integration
- **GCP Support**: Automated VM provisioning
- **Claude Installation**: One-command setup script
- **GitHub Integration**: Deploy keys and automated git workflows

### Performance & Monitoring
- **Real-time Dashboard**: System health at a glance
- **Performance Optimizer**: Automated issue detection
- **Integration Testing**: Comprehensive test suite

## Directory Structure

```
.
├── src/                    # Core implementation
│   ├── instance_manager.js # Instance lifecycle management
│   └── workflow/          # Workflow engine
├── scripts/               # Utility scripts
│   ├── mcp_bridge.js      # MCP communication bridge
│   ├── system_monitor.cjs # Real-time monitoring
│   └── performance_optimizer.cjs # Performance analysis
├── workflows/             # Workflow definitions
│   └── examples/         # Example workflows
├── vm-integration/       # VM setup and management
│   ├── setup-scripts/    # Automation scripts
│   └── docs/            # VM documentation
└── state/               # Runtime state
    └── instances.json   # Active instance registry
```

## Best Practices

1. **Instance Management**
   - Clean up stale instances regularly
   - Use meaningful instance IDs
   - Monitor resource usage

2. **Workflow Design**
   - Keep stages focused and atomic
   - Use clear trigger keywords
   - Implement proper error handling

3. **Performance**
   - Monitor system load
   - Optimize memory usage
   - Run integration tests regularly

## Troubleshooting

### Common Issues

1. **MCP Bridge Timeout**
   - Check instance availability
   - Verify tmux session health
   - Review system load

2. **High Memory Usage**
   - Run performance optimizer
   - Clean up stale instances
   - Restart unnecessary sessions

3. **Workflow Failures**
   - Check instance IDs
   - Verify keyword triggers
   - Review stage timeouts

## Development

### Testing
```bash
# Run all tests
node scripts/integration_tester.cjs

# Monitor system
node scripts/system_monitor.cjs

# Analyze performance
node scripts/performance_optimizer.cjs --detailed
```

### Contributing
- Follow existing code patterns
- Add tests for new features
- Update documentation

## License

This project is part of the Claude Code ecosystem and follows its licensing terms.