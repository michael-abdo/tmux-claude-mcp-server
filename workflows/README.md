# Scalable Workflow System

A modular, extensible workflow system for orchestrating Claude instances with prompt-based automation.

## 📁 Directory Structure

```
workflows/
├── README.md          # This file - system overview and usage guide
├── config/            # Configuration files
│   └── workflow_config.json          # Main workflow configuration
├── docs/              # System documentation
│   ├── CURRENT_STATUS.md             # Current system status
│   ├── SCALABLE_STRUCTURE_SUMMARY.md # Architecture overview
│   ├── TEST_README.md                # Testing documentation
│   ├── demo_workflow_test.md         # Workflow demo and examples
│   ├── prompt_chain.md               # Execute-Compare-Commit prompt chain
│   ├── workflow_advanced_actions.md  # Advanced action documentation
│   ├── workflow_system_design.md     # System design specification
│   ├── workflow_system_fix_plan.txt  # Implementation plan
│   └── workflow_system_summary.md    # System summary
├── examples/          # Example workflows for learning
│   ├── example_simple.yaml                  # Basic prompt chaining
│   ├── example_code_analysis.yaml           # Complex analysis workflow
│   ├── example_parallel_review.yaml         # Multi-instance parallel work
│   ├── example_test_generation.yaml         # Iterative test generation
│   ├── execute_compare_commit.yaml          # Execute-Compare-Commit workflow
│   ├── execute_compare_commit_simple.yaml   # Simplified version
│   └── execute_compare_commit_workflow.yaml # Full-featured version
├── library/           # Reusable workflow components
│   ├── actions/       # Action implementations
│   │   ├── control.js      # Control flow actions
│   │   ├── core.js         # Essential actions (send_prompt, spawn, etc.)
│   │   ├── data.js         # Data processing actions
│   │   ├── filesystem.js   # File operations
│   │   ├── index.js        # Action library registry
│   │   ├── network.js      # Network and HTTP actions
│   │   └── script.js       # Script execution actions
│   ├── common/        # Common workflow patterns
│   │   └── code_analysis.yaml # Reusable code analysis pattern
│   └── templates/     # Workflow templates for scaffolding
│       ├── basic.yaml                 # Simple workflow template
│       ├── conditional_branching.yaml # Conditional logic template
│       ├── parallel_processing.yaml   # Parallel workflow template
│       └── script_integration.yaml    # Script integration template
├── scripts/           # Supporting scripts and utilities
│   ├── chain_prompts.js     # Prompt chaining utility
│   ├── create_workflow.cjs  # Workflow scaffolding tool
│   ├── run_workflow.sh      # Shell script wrapper
│   └── workflow_runner.js   # Workflow execution engine
├── tests/             # Test workflows and test runner
│   ├── run_tests.sh                   # Test runner script
│   ├── test_basic.yaml                # Basic functionality test
│   ├── test_complex_workflow.yaml     # Complex workflow test
│   ├── test_engine_only.yaml          # Engine-only test
│   ├── test_execute_compare_commit.yaml # Execute-Compare-Commit test
│   ├── test_file_ops.yaml             # File operations test
│   ├── test_log_only.yaml             # Logging test
│   ├── test_minimal.yaml              # Minimal functionality test
│   ├── test_script.yaml               # Script execution test
│   └── test_script_actions.yaml       # Script actions test
└── user/              # User-created workflows (initially empty)
```

## 🚀 Quick Start

### 1. Unified Workflow Launcher (Recommended)
```bash
# Run complete 4-phase workflow with automatic progression
./unified_workflow_launcher.sh "create a Python hello world script" --preset phase

# Use existing instance (if available)
./unified_workflow_launcher.sh "implement user authentication" --preset phase

# Force new instance (kill existing first)
tmux kill-session -t claude_<instance_id>
./unified_workflow_launcher.sh "add logging functionality" --preset phase
```

### 2. Manual Workflow Execution
```bash
# Execute-Compare-Commit workflow (manual)
node ../src/workflow/run_workflow.cjs examples/execute_compare_commit.yaml

# Simple prompt chaining example
node ../src/workflow/run_workflow.cjs examples/example_simple.yaml

# Complex code analysis workflow
node ../src/workflow/run_workflow.cjs examples/example_code_analysis.yaml

# Parallel processing example
node ../src/workflow/run_workflow.cjs examples/example_parallel_review.yaml
```

### 3. Task Execution
```bash
# Quick task with phases
./task "implement feature X" --preset phase

# Quick task with custom workflow
./task "analyze codebase" --workflow examples/example_code_analysis.yaml
```

### 4. Create Your Own Workflow
```bash
# Interactive scaffolding
node scripts/create_workflow.cjs

# Manual creation from template
cp library/templates/basic.yaml user/my_workflow.yaml
# Edit the file with your prompts and actions

# Run your workflow
node ../src/workflow/run_workflow.cjs user/my_workflow.yaml
```

### 5. Test the System
```bash
# Run all tests
./tests/run_tests.sh

# Run individual tests
node ../src/workflow/run_workflow.cjs tests/test_minimal.yaml
node ../src/workflow/run_workflow.cjs tests/test_script.yaml
node ../src/workflow/run_workflow.cjs tests/test_file_ops.yaml
```

## 🔄 Unified Workflow Launcher

The unified workflow launcher (`./unified_workflow_launcher.sh`) provides a streamlined experience by combining:
- Workflow engine startup
- Instance spawning
- Task monitoring with automatic phase progression
- Direct tmux attachment for real-time observation

### Key Features
- **Automatic Phase Progression**: Monitors for keywords (`EXECUTE_FINISHED` → `COMPARISON_FINISHED` → `DUPLICATION_ELIMINATED` → `COMMIT_FINISHED`)
- **Smart Instance Detection**: Reuses existing instances or spawns new ones as needed
- **Background Monitoring**: Task progression continues even after detaching from tmux
- **Robust Error Handling**: Graceful handling of spawn timeouts and instance detection

### Usage Patterns
```bash
# Standard usage
./unified_workflow_launcher.sh "your task description" --preset phase

# Monitor progress after detaching
tail -f /tmp/unified_workflow_task_<instance_id>.log

# Reattach to Claude session
tmux attach -t claude_<instance_id>
```

## 🔄 Execute-Compare-Commit Workflow

The Execute-Compare-Commit workflow provides a systematic approach to feature implementation with built-in quality assurance:

### Available Versions
- **`execute_compare_commit.yaml`** - Full-featured with loop-back capability
- **`execute_compare_commit_simple.yaml`** - Sequential execution
- **`execute_compare_commit_workflow.yaml`** - Advanced with conditional logic

### Three-Phase Process
1. **Execute Phase** - Implement features methodically with todo tracking
2. **Compare Phase** - Analyze implementation vs requirements, identify gaps
3. **Commit Phase** - Clean up code, update docs, create git commit

### Usage
```bash
# Run with a phase requirements file
node ../src/workflow/run_workflow.cjs examples/execute_compare_commit.yaml --phase_file path/to/requirements.md

# Test the workflow
node ../src/workflow/run_workflow.cjs tests/test_execute_compare_commit.yaml
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
# Check workflow syntax (from workflows directory)
node -c user/my_workflow.yaml

# Run with verbose logging
DEBUG=workflow:* node ../src/workflow/run_workflow.cjs user/my_workflow.yaml

# Test action library
node -e "const lib = require('../src/workflow/actions/index.cjs'); const ActionLibrary = lib; const context = require('../src/workflow/workflow_context.cjs'); const actionLib = new ActionLibrary(new context()); console.log(actionLib.getAvailableActions())"
```

This scalable structure enables building complex automation workflows while maintaining organization, reusability, and extensibility for dozens of workflows.