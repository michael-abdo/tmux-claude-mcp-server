# Workflow System Examples

This directory contains example workflow definitions that demonstrate various features of the prompt-based workflow system.

## Running Workflows

```bash
# Basic usage
node src/workflow/run_workflow.js workflows/example_simple.yaml

# With environment variables
API_KEY=your-key node src/workflow/run_workflow.js workflows/example_api_integration.yaml
```

## Example Workflows

### 1. `example_simple.yaml`
A basic workflow that demonstrates:
- Simple prompt chaining
- Keyword detection
- Stage transitions

### 2. `example_code_analysis.yaml`
An intermediate workflow showing:
- Script execution (local)
- Conditional branching
- File operations
- Output capture and variable storage
- Error handling with retry

### 3. `example_parallel_review.yaml`
An advanced workflow featuring:
- Parallel instance spawning
- Concurrent prompt execution
- Multi-instance coordination
- Instance cleanup
- Report consolidation

## Workflow Structure

Every workflow consists of:

1. **Metadata**: Name, version, description
2. **Settings**: Global configuration (timeouts, polling intervals)
3. **Stages**: Sequential steps with prompts and actions

## Key Concepts

### Keyword Detection
Each stage waits for a specific keyword in the Claude instance output:
```yaml
trigger_keyword: "***DONE***"
```

### Actions
Actions execute after keyword detection:
- `send_prompt`: Send a prompt to an instance
- `run_script`: Execute scripts locally or in instance
- `spawn`: Create new Claude instances
- `terminate`: Clean up instances
- `save_file`: Write data to disk
- `conditional`: Branch based on conditions
- `parallel`: Run multiple actions concurrently

### Context Variables
Access data throughout the workflow:
- `${workflow.run_id}`: Unique run identifier
- `${stage.output}`: Previous stage output
- `${actions.my_var}`: Stored action results
- `${vars.custom}`: Custom variables

### Error Handling
Control failure behavior:
- `on_failure: "abort"`: Stop workflow (default)
- `on_failure: "continue"`: Ignore error
- `on_failure: "retry_once"`: Retry the action

## Creating Your Own Workflows

1. Copy an example as a starting point
2. Define your stages with clear prompts
3. Always include trigger keywords
4. Chain stages with `next_stage`
5. Use variables to pass data between stages
6. Test incrementally

## Best Practices

1. **Clear Keywords**: Use unique, obvious keywords like `***TASK_COMPLETE***`
2. **Timeout Values**: Set reasonable timeouts for each stage
3. **Error Recovery**: Plan for failures with appropriate `on_failure` settings
4. **Instance Management**: Clean up instances when done
5. **Output Capture**: Save important results for debugging
6. **Incremental Development**: Test each stage before adding the next

## Debugging

- Check `workflow_state/` for saved context
- Use `action: "log"` liberally
- Monitor instance output with bridge commands
- Set shorter timeouts during development
- Use `on_failure: "continue"` to see full execution

## Advanced Patterns

### Dynamic Prompts
```yaml
prompt: |
  Fix these issues:
  ${issues_json.map(i => '- ' + i.title).join('\n')}
```

### Conditional Workflows
```yaml
- action: "conditional"
  condition: "${test_results.failed} > 0"
  if_true:
    - action: "send_prompt"
      next_stage: "fix_tests"
  if_false:
    - action: "complete_workflow"
```

### Parallel Processing
```yaml
- action: "foreach"
  items: "${files_to_process}"
  item_var: "file"
  actions:
    - action: "run_script"
      script: "./process.py"
      args: ["${file}"]
```

## Limitations

- Keywords must appear in instance output (not internal)
- Complex data requires JSON serialization
- Parallel actions share the same context
- Script timeouts are enforced strictly