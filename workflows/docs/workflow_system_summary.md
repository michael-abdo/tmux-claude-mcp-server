# Prompt-Based Workflow System - Implementation Summary

## What We Built

A scalable, modular workflow system that chains Claude instance prompts based on keyword detection. The system allows you to:

1. **Define workflows in YAML** - No coding required
2. **Chain prompts** - Each stage waits for a keyword before proceeding
3. **Execute scripts** - Run any executable (.py, .sh, .js, etc.) locally or in Claude instances
4. **Branch conditionally** - Make decisions based on outputs
5. **Run in parallel** - Spawn multiple instances for concurrent work
6. **Pass context** - Share data between stages and actions

## Core Components ("Lego Pieces")

### 1. **Workflow Engine** (`src/workflow/workflow_engine.js`)
- Reads YAML workflow definitions
- Manages stage execution
- Handles control flow (sequential, conditional, parallel)
- Maintains workflow state

### 2. **Keyword Monitor** (`src/workflow/keyword_monitor.js`)
- Polls Claude instance output
- Detects trigger keywords
- Handles timeouts
- Emits events for workflow progression

### 3. **Action Executor** (`src/workflow/action_executor.js`)
- Modular action system
- Built-in actions: send_prompt, run_script, spawn, terminate, save_file, etc.
- Extensible - easy to add new action types
- Handles context interpolation

### 4. **Workflow Context** (`src/workflow/workflow_context.js`)
- Manages workflow state and variables
- Interpolates variables in prompts and arguments
- Persists state to disk
- Provides expression evaluation

## How It Works

1. **Define a workflow** in YAML with stages
2. **Each stage** has:
   - A prompt to send to Claude
   - A trigger keyword to wait for
   - Actions to execute on success/failure
3. **Actions can**:
   - Send more prompts
   - Run scripts
   - Make decisions
   - Save outputs
   - Chain to next stages
4. **Context flows** through the workflow:
   - Script outputs → variables
   - Variables → next prompts
   - Stage outputs → final reports

## Usage

```bash
# Run a workflow
node src/workflow/run_workflow.js workflows/example_simple.yaml

# With environment variables
API_KEY=secret node src/workflow/run_workflow.js workflows/my_workflow.yaml
```

## Creating New Workflows

### Simple Example
```yaml
name: "My Workflow"
stages:
  - id: "start"
    prompt: "Do something. Say ***DONE*** when finished."
    trigger_keyword: "***DONE***"
    on_success:
      - action: "complete_workflow"
```

### Complex Example with Scripts
```yaml
stages:
  - id: "analyze"
    prompt: "Analyze code. Say ***ANALYZED***"
    trigger_keyword: "***ANALYZED***"
    on_success:
      # Run a Python script
      - action: "run_script"
        script: "./analyze.py"
        capture_output: true
        output_var: "analysis"
      
      # Use script output in next prompt
      - action: "send_prompt"
        prompt: "Fix these issues: ${analysis}"
```

## Key Design Decisions

1. **Keyword-based progression** - Simple, reliable way to detect completion
2. **YAML configuration** - Human-readable, version-controllable
3. **Action modularity** - Each action is independent and composable
4. **Context interpolation** - Powerful variable system using ${var} syntax
5. **Error resilience** - Configurable failure handling per action
6. **Parallel support** - Built-in concurrent execution

## Extending the System

### Add a New Action Type

1. Add handler to `action_executor.js`:
```javascript
this.handlers['my_action'] = this.handleMyAction.bind(this);

async handleMyAction(action) {
  // Your implementation
  return { success: true, data: "result" };
}
```

2. Use in workflows:
```yaml
- action: "my_action"
  param1: "value"
  output_var: "my_result"
```

### Add a New Trigger Type

Extend the keyword monitor to support patterns, webhooks, file watchers, etc.

## Best Practices

1. **Use clear, unique keywords**: `***TASK_COMPLETE***` not just `done`
2. **Set appropriate timeouts**: Balance between giving enough time and failing fast
3. **Capture outputs**: Use `output_var` to pass data between stages
4. **Handle errors gracefully**: Use `on_failure: "continue"` when appropriate
5. **Clean up resources**: Terminate instances when done
6. **Test incrementally**: Build workflows stage by stage

## Example Workflows Included

1. **`example_simple.yaml`** - Basic prompt chaining
2. **`example_code_analysis.yaml`** - Script execution, conditionals, file operations
3. **`example_parallel_review.yaml`** - Multiple instances working in parallel
4. **`example_test_generation.yaml`** - Iterative test generation with retries

## Future Enhancements

- Web UI for workflow design and monitoring
- Webhook triggers for external events
- Database persistence for workflow state
- Workflow composition (workflows calling workflows)
- Custom action marketplace
- Real-time progress dashboard

## Summary

This workflow system provides a powerful, flexible way to orchestrate Claude instances for complex multi-step tasks. By combining simple prompts with keyword detection and a rich action system, you can build sophisticated automation workflows without writing orchestration code.