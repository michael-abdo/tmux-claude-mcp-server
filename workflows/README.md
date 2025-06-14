# Scalable Workflow System

A modular, extensible workflow system for orchestrating Claude instances with prompt-based automation.

## 📁 Directory Structure

```
workflows/
├── library/           # Reusable workflow components (legacy)
│   ├── actions/       # Original action implementations (now in src/workflow/actions/)
└── src/workflow/      # Current action implementations
    ├── actions/       # Modular action implementations
    │   ├── core.cjs          # Essential actions (send_prompt, spawn, etc.)
    │   ├── script.cjs        # Script execution actions
    │   ├── filesystem.cjs    # File operations
    │   ├── control.cjs       # Control flow (conditionals, loops)
    │   ├── network.cjs       # HTTP requests, webhooks
    │   ├── data.cjs          # Data processing and transformation
    │   └── index.cjs         # Action library registry
    ├── workflow_engine.cjs   # Main workflow orchestration engine
    ├── action_executor.cjs   # Action execution layer
    ├── workflow_context.cjs  # Context and variable management
    ├── mcp_bridge.cjs        # MCP communication bridge
    ├── keyword_monitor.cjs   # Keyword detection system
    └── run_workflow.cjs      # Workflow runner CLI
│   ├── templates/     # Workflow templates for scaffolding
│   │   ├── basic.yaml                 # Simple workflow template
│   │   ├── script_integration.yaml    # Script integration template
│   │   ├── parallel_processing.yaml   # Parallel workflow template
│   │   └── conditional_branching.yaml # Conditional logic template
│   └── common/        # Common workflow patterns
│       └── code_analysis.yaml         # Reusable code analysis pattern
├── examples/          # Example workflows for learning
│   ├── example_simple.yaml            # Basic prompt chaining
│   ├── example_code_analysis.yaml     # Complex analysis workflow
│   ├── example_parallel_review.yaml   # Multi-instance parallel work
│   └── example_test_generation.yaml   # Iterative test generation
├── tests/             # Test workflows
│   ├── test_minimal.yaml              # Basic functionality test
│   ├── test_script.yaml               # Script execution test
│   ├── test_file_ops.yaml             # File operations test
│   └── run_tests.sh                   # Test runner
├── user/              # User-created workflows
├── state/             # Workflow execution state
├── reports/           # Generated reports
├── scripts/           # Supporting scripts
│   └── create_workflow.js             # Workflow scaffolding tool
└── docs/              # System documentation
    ├── workflow_system_design.md
    ├── workflow_advanced_actions.md
    └── workflow_system_summary.md
```

## 🚀 Quick Start

### 1. Run Example Workflows
```bash
# Simple example
npm run workflow:simple

# Complex code analysis  
npm run workflow:analysis

# Parallel processing
npm run workflow:parallel

# Test generation
npm run workflow:tests
```

### 2. Create Your Own Workflow
```bash
# Interactive scaffolding
node workflows/scripts/create_workflow.cjs

# Manual creation from template
cp workflows/library/templates/basic.yaml workflows/user/my_workflow.yaml
# Edit the file with your prompts and actions

# Run your workflow
node src/workflow/run_workflow.cjs workflows/user/my_workflow.yaml
```

### 3. Test the System
```bash
# Run all tests
npm run workflow:test

# Individual tests
npm run workflow:test:minimal
npm run workflow:test:script
npm run workflow:test:files
```

## 🧩 Action Library

The modular action system provides 25+ actions across 6 categories:

### Core Actions
- `send_prompt` - Send prompts to Claude instances
- `spawn` - Create new Claude instances
- `terminate` - Clean up instances
- `log` - Logging and debugging
- `wait` - Time delays
- `complete_workflow` - End workflow

### Script Actions
- `run_script` - Execute any .py/.sh/.js files locally or in instances

### File System Actions
- `save_file`, `read_file`, `delete_file`
- `create_directory`, `copy_file`
- `list_files`, `file_exists`, `append_file`

### Control Flow Actions
- `conditional` - If/else logic
- `parallel` - Concurrent execution
- `foreach` - Loop over arrays
- `while_loop` - Conditional loops
- `try_catch` - Error handling

### Network Actions
- `http_request` - HTTP API calls
- `webhook` - Send notifications
- `slack_notify`, `discord_notify`
- `download_file`, `upload_file`

### Data Actions
- `transform` - Data manipulation (JSON, regex, etc.)
- `aggregate` - Combine multiple data sources  
- `template` - Generate reports
- `validate` - Data validation
- `generate_data` - Synthetic test data

## 📋 Workflow Templates

Use templates to quickly create new workflows:

### Basic Template
Simple linear workflow with prompt → keyword → action flow.

### Script Integration Template
Integrate external scripts with error handling and result processing.

### Parallel Processing Template
Spawn multiple workers for concurrent processing tasks.

### Conditional Branching Template
Complex decision trees with multiple execution paths.

## 🎯 Common Patterns

### Code Analysis Pattern
```yaml
# Include reusable analysis pattern
<<: !include library/common/code_analysis.yaml

# Customize for your needs
settings:
  target_directory: "./src"
  include_tests: true
```

### Notification Pattern
```yaml
on_success:
  - action: "slack_notify"
    webhook_url: "${env.SLACK_WEBHOOK}"
    message: "Workflow ${workflow.name} completed successfully!"
```

### Error Handling Pattern
```yaml
on_success:
  - action: "try_catch"
    try_actions:
      - action: "run_script"
        script: "./risky_operation.py"
    catch_actions:
      - action: "log"
        message: "Operation failed: ${vars._error.message}"
      - action: "slack_notify"
        message: "Alert: ${workflow.name} encountered an error"
```

## 🛠 Extending the System

### Adding New Actions

1. Create action module in `library/actions/`:
```javascript
// library/actions/my_custom.js
class MyCustomActions {
  async my_action(action) {
    // Implementation
    return { success: true };
  }
}
module.exports = MyCustomActions;
```

2. Register in `library/actions/index.js`:
```javascript
const MyCustomActions = require('./my_custom');

// In constructor:
this.modules.my_custom = new MyCustomActions(context, options);

// In registerActions():
this.handlers['my_action'] = this.modules.my_custom.my_action.bind(this.modules.my_custom);
```

### Creating Workflow Libraries

Organize related workflows into libraries:
```
workflows/user/
├── data_processing/
│   ├── etl_pipeline.yaml
│   ├── data_validation.yaml
│   └── reporting.yaml
├── testing/
│   ├── unit_test_generator.yaml
│   └── integration_test_runner.yaml
└── deployment/
    ├── staging_deploy.yaml
    └── production_deploy.yaml
```

## 📊 Monitoring and Debugging

### Workflow State
All execution state is saved in `workflows/state/` for debugging and recovery.

### Reports
Generated reports are saved in `workflows/reports/` with timestamps.

### Debugging Tips
```yaml
# Add debug logging
- action: "log"
  message: "Current variables: ${JSON.stringify(vars)}"

# Save intermediate state
- action: "save_file"
  path: "./debug/stage_${stage.id}_output.json"
  content: "${JSON.stringify(stage)}"

# Use shorter timeouts during development
settings:
  timeout: 60  # vs 300 for production
```

## 🔒 Best Practices

### 1. Workflow Design
- Use clear, unique keywords: `***TASK_COMPLETE***`
- Set appropriate timeouts for each stage
- Include error handling for critical operations
- Clean up instances when done

### 2. Variable Management
```yaml
# Good: descriptive names with actions prefix
message: "Results: ${actions.security_scan_results.stdout}"

# Bad: missing actions prefix (won't interpolate)
message: "Results: ${security_scan_results.stdout}"

# Variable storage
- action: "run_script"
  output_var: "security_scan_results"  # Stored as actions.security_scan_results
```

### 3. File Organization
- Keep examples in `examples/`
- Put reusable patterns in `library/common/`
- Store user workflows in `user/` subdirectories
- Use semantic versioning for templates

### 4. Testing
- Test each workflow stage incrementally
- Use `tests/` directory for system tests
- Include error scenarios in tests
- Validate with shorter timeouts first

## 🚀 Performance Tips

1. **Use parallel actions** for independent tasks
2. **Set realistic timeouts** to fail fast
3. **Clean up instances** to free resources
4. **Use shared workspace mode** for collaborative workflows
5. **Cache results** in variables to avoid recomputation

## 🆘 Troubleshooting

### Common Issues

**Keyword not detected**: Check Claude's actual output vs expected keyword
**Script failures**: Verify paths, permissions, and environment variables  
**Variable not found**: Check variable scope and interpolation syntax
**Timeout errors**: Increase timeout or break into smaller stages

### Debug Commands
```bash
# Check workflow syntax
node -c workflows/user/my_workflow.yaml

# Run with verbose logging
DEBUG=workflow:* npm run workflow:run workflows/user/my_workflow.yaml

# Test action library
node -e "const lib = require('./src/workflow/actions/index.cjs'); const ActionLibrary = lib; const context = require('./src/workflow/workflow_context.cjs'); const actionLib = new ActionLibrary(new context()); console.log(actionLib.getAvailableActions())"
```

This scalable structure enables building complex automation workflows while maintaining organization, reusability, and extensibility for dozens of workflows.