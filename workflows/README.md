# Workflow System Documentation

## Overview

The tmux-claude-mcp-server workflow system enables you to create sophisticated, multi-stage automated workflows using YAML configuration files. These workflows can spawn Claude instances, send prompts, monitor outputs, and chain complex sequences of tasks together.

## Quick Start

### Running a Workflow

```bash
# Using workflow manager (recommended)
node src/workflow/workflow_manager.cjs run quick_analysis

# Direct execution
node src/workflow/run_workflow.cjs workflows/examples/execute_compare_commit.yaml --debug

# From any directory
node ~/.claude/user/tmux-claude-mcp-server/src/workflow/workflow_manager.cjs list
```

### Available Commands

```bash
# List all workflows
node src/workflow/workflow_manager.cjs list

# Run a specific workflow
node src/workflow/workflow_manager.cjs run <workflow-name> [--debug] [--no-cleanup]

# Validate a workflow file
node src/workflow/workflow_manager.cjs validate <file.yaml>

# Create a new workflow template
node src/workflow/workflow_manager.cjs create "My New Workflow"
```

## Workflow Configuration

### Basic Structure

```yaml
name: My Workflow
description: What this workflow does
version: 1.0

settings:
  useTaskIds: false              # Enable/disable task ID mode
  poll_interval: 5               # How often to check for keywords (seconds)
  timeout: 120                   # Default timeout for stages (seconds)
  instance_role: specialist      # Default role for spawned instances
  workspace_mode: isolated       # isolated or shared

stages:
  - id: stage1
    name: First Stage
    prompt: |
      Your prompt here
      When done, respond with: STAGE1_COMPLETE
    trigger_keyword: STAGE1_COMPLETE
    timeout: 60
    on_success:
      - action: next_stage
        stage_id: stage2
```

### Stage Configuration

Each stage can have:

- **id**: Unique identifier for the stage
- **name**: Human-readable name
- **prompt**: Text to send to Claude instance
- **trigger_keyword**: Keyword to wait for before proceeding
- **timeout**: Maximum wait time (seconds)
- **instance_id**: Use specific existing instance (optional)
- **instance_role**: Role for new instance (optional)
- **workspace_mode**: Workspace mode for new instance (optional)

### Actions

Available actions in `on_success`, `on_timeout`, and `on_failure`:

#### Basic Actions
```yaml
- action: next_stage
  stage_id: next_stage_name

- action: complete_workflow

- action: log
  message: "Custom message"
  level: info  # info, warn, error, debug

- action: wait
  duration: 5  # seconds

- action: set_context
  key: "vars.my_variable"
  value: "some value"
```

#### Instance Management
```yaml
- action: spawn
  role: specialist
  workspace_mode: isolated
  context: "Context for new instance"

- action: send_prompt
  instance_id: spec_1_1_123456
  prompt: "Prompt to send"

- action: read_output
  instance_id: spec_1_1_123456
  lines: 20

- action: terminate
  instance_id: spec_1_1_123456
```

#### Advanced Actions
```yaml
- action: conditional
  condition: "ctx.vars.my_var === 'expected'"
  if_true:
    - action: log
      message: "Condition was true"
  if_false:
    - action: log
      message: "Condition was false"

- action: parallel
  max_concurrent: 3
  wait_all: true
  continue_on_failure: false
  actions:
    - action: log
      message: "First parallel task"
    - action: log
      message: "Second parallel task"

- action: foreach
  items: "ctx.vars.my_array"
  item_var: "item"
  actions:
    - action: log
      message: "Processing ${item}"
```

## Variable Interpolation

Workflows support variable interpolation using `${variable_name}` syntax:

```yaml
prompt: |
  Hello! Your task ID is: ${current_task_id}
  Working in: ${workflow.name}
  Current stage: ${stages.current_stage.name}
```

Available variables:
- `${workflow.id}` - Workflow instance ID
- `${workflow.name}` - Workflow name
- `${workflow.run_id}` - Unique run ID
- `${current_task_id}` - Current task ID (if enabled)
- `${vars.custom_var}` - Custom variables
- `${instances.specialist}` - Instance IDs
- `${stages.stage_id.status}` - Stage status

## Task ID Mode

When `useTaskIds: true`, the workflow system:
- Generates unique task IDs for each run
- Appends task IDs to keywords for uniqueness
- Enables advanced conflict resolution
- Useful for parallel workflows

When `useTaskIds: false` (default):
- Uses simple keyword matching
- Better for basic workflows
- Easier to debug

## Examples

### Simple Test Workflow
```yaml
name: Simple Test
description: Basic workflow test
version: 1.0

settings:
  useTaskIds: false
  poll_interval: 2
  timeout: 30

stages:
  - id: test
    name: Simple Test
    prompt: |
      Please respond with: TEST_COMPLETE
    trigger_keyword: TEST_COMPLETE
    timeout: 20
    on_success:
      - action: complete_workflow
```

### Multi-Stage Analysis
```yaml
name: Code Analysis Workflow
version: 1.0

stages:
  - id: analyze
    name: Analyze Codebase
    prompt: |
      Analyze this codebase and list the main files.
      When done, respond with: ANALYSIS_COMPLETE
    trigger_keyword: ANALYSIS_COMPLETE
    on_success:
      - action: next_stage
        stage_id: document

  - id: document
    name: Generate Documentation
    prompt: |
      Based on the analysis, suggest improvements.
      When done, respond with: DOCS_COMPLETE
    trigger_keyword: DOCS_COMPLETE
    on_success:
      - action: complete_workflow
```

### Conditional Workflow
```yaml
name: Conditional Analysis
version: 1.0

stages:
  - id: check
    name: Check Project Type
    prompt: |
      Check if package.json exists: ls package.json
      If it exists, respond with: NODEJS_PROJECT
      If not, respond with: OTHER_PROJECT
    trigger_keyword: NODEJS_PROJECT
    timeout: 20
    on_success:
      - action: next_stage
        stage_id: nodejs_analysis
    on_timeout:
      - action: next_stage
        stage_id: general_analysis

  - id: nodejs_analysis
    name: Node.js Analysis
    prompt: "Analyze package.json and dependencies..."
    trigger_keyword: NODEJS_DONE
    on_success:
      - action: complete_workflow

  - id: general_analysis
    name: General Analysis  
    prompt: "Perform general project analysis..."
    trigger_keyword: GENERAL_DONE
    on_success:
      - action: complete_workflow
```

## Best Practices

### Workflow Design
1. **Keep stages focused** - Each stage should do one thing well
2. **Use clear keywords** - Make trigger keywords unique and descriptive
3. **Set appropriate timeouts** - Balance between too short and too long
4. **Handle errors gracefully** - Always include `on_timeout` and `on_failure`
5. **Use meaningful names** - Stage and workflow names should be descriptive

### Instance Management
1. **Reuse instances when possible** - Spawning is slower than reusing
2. **Clean up resources** - Use `--cleanup` or explicit terminate actions
3. **Monitor instance count** - Too many instances can cause timeouts
4. **Use appropriate workspace modes** - isolated vs shared

### Debugging
1. **Use --debug flag** - Shows detailed execution information
2. **Start with simple workflows** - Test basic functionality first
3. **Check keyword detection** - Ensure keywords match exactly
4. **Monitor instance output** - Use MCP bridge read commands
5. **Validate YAML syntax** - Use the validate command

### Performance
1. **Optimize poll intervals** - Shorter intervals = faster detection, more CPU
2. **Set realistic timeouts** - Account for Claude response time
3. **Limit parallel execution** - Too many concurrent actions can overwhelm
4. **Use existing instances** - Avoid unnecessary spawning

## Troubleshooting

### Common Issues

**Workflow hangs on spawn**
- Too many existing instances
- Use existing instance with `instance_id`
- Clean up old instances

**Keywords not detected**
- Check exact keyword spelling
- Verify instance is responding
- Use `--debug` to see detection attempts

**Timeout errors**
- Increase timeout values
- Check if Claude instance is responsive
- Verify prompt is clear and actionable

**Stage transitions fail**
- Check stage IDs match exactly
- Verify `next_stage` references exist
- Use `--debug` to trace execution

### Debugging Commands

```bash
# Check active instances
node scripts/mcp_bridge.js list '{}'

# Read instance output
node scripts/mcp_bridge.js read '{"instanceId": "spec_1_1_123456", "lines": 20}'

# Send test message
node scripts/mcp_bridge.js send '{"instanceId": "spec_1_1_123456", "text": "test"}'

# Validate workflow
node src/workflow/workflow_manager.cjs validate my_workflow.yaml
```

## Advanced Features

### Context Management
Workflows maintain a complete context object that includes:
- Workflow metadata
- Stage execution history
- Instance tracking
- Custom variables
- Action results

### Error Recovery
The system includes robust error handling:
- Automatic retries for transient failures
- Graceful degradation on timeouts
- Configurable failure behaviors
- Context preservation across errors

### Monitoring and Logging
- Real-time execution monitoring
- Structured logging with levels
- Context persistence to JSON
- Event-driven architecture

### Extensibility
- Custom action types can be added
- Pluggable keyword detection
- Configurable path resolution
- Modular architecture

## API Reference

### WorkflowEngine Class
Main orchestration engine for workflow execution.

### ActionExecutor Class  
Handles individual action execution via MCP bridge.

### KeywordMonitor Class
Monitors Claude instance output for trigger keywords.

### WorkflowContext Class
Manages workflow state and variable interpolation.

### WorkflowManager Class
High-level interface for workflow discovery and execution.

## Contributing

To add new features:
1. Extend the appropriate class
2. Add new action types to ActionExecutor
3. Update YAML schema validation
4. Add tests and documentation
5. Update this README

## File Structure

```
workflows/
├── README.md                 # This file
├── examples/                 # Example workflows
│   ├── execute_compare_commit.yaml
│   ├── quick_analysis.yaml
│   ├── parallel_analysis.yaml
│   └── advanced_development_workflow.yaml
└── docs/                     # Additional documentation

src/workflow/
├── run_workflow.cjs          # CLI entry point
├── workflow_manager.cjs      # High-level management
├── workflow_engine.cjs       # Core orchestration
├── action_executor.cjs       # Action execution
├── keyword_monitor.cjs       # Output monitoring
└── workflow_context.cjs      # State management
```