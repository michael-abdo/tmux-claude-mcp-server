# Prompt-Based Workflow System - Complete Guide

## Overview

This workflow system allows you to create complex, multi-stage automations using Claude instances. Each workflow is defined in YAML and consists of stages that send prompts to Claude, wait for keyword responses, and then execute actions like running scripts or sending more prompts.

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run a simple workflow**:
   ```bash
   npm run workflow:simple
   ```

3. **View the workflow definition**:
   ```bash
   cat workflows/example_simple.yaml
   ```

## How It Works

### 1. Define Stages in YAML
```yaml
stages:
  - id: "analyze"
    prompt: "Analyze this code. Say ***DONE*** when finished."
    trigger_keyword: "***DONE***"
    on_success:
      - action: "run_script"
        script: "./my-script.py"
```

### 2. Keyword Detection
The system monitors Claude's output for your specified keywords:
- `***DONE***` - Simple completion
- `***READY***|***SKIP***` - Multiple acceptable keywords
- `***ERROR:(.*)***` - Regex patterns (advanced)

### 3. Action Execution
When keywords are detected, actions execute:
- **send_prompt**: Send another prompt to Claude
- **run_script**: Execute any script (.py, .sh, .js, etc.)
- **spawn**: Create new Claude instances  
- **conditional**: Branch based on variables
- **parallel**: Run multiple actions concurrently

### 4. Context Flow
Variables flow between stages:
```yaml
- action: "run_script"
  script: "count_files.sh"
  output_var: "file_count"  # Store result

- action: "send_prompt"
  prompt: "Process these ${file_count} files"  # Use result
```

## Complete Action Reference

### Core Actions

#### send_prompt
```yaml
- action: "send_prompt"
  target: "same_instance"  # same_instance, new_instance, specific_id
  prompt: "Do something with ${variable}"
  wait_for_keyword: "***DONE***"  # Optional
  timeout: 300
  extract_pattern: "RESULT: (.*)"  # Optional regex extraction
  extract_var: "extracted_result"
```

#### run_script
```yaml
- action: "run_script"
  script: "./analyze.py"
  args: ["--input", "${input_file}"]
  target: "local"  # local, instance, new_shell
  working_dir: "./src"
  timeout: 120
  capture_output: true
  output_var: "script_result"
  expect_exit_code: 0
  on_failure: "continue"  # continue, abort, retry_once
  env:
    API_KEY: "${env.API_KEY}"
```

#### spawn
```yaml
- action: "spawn"
  role: "specialist"  # specialist, manager, executive
  workspace_mode: "isolated"  # isolated, shared
  context: "You are a ${role} working on ${task}"
  output_var: "new_instance"
```

#### conditional
```yaml
- action: "conditional"
  condition: "${test_results.exit_code} !== 0"
  if_true:
    - action: "send_prompt"
      prompt: "Fix the failing tests"
  if_false:
    - action: "log"
      message: "All tests passing!"
```

#### parallel
```yaml
- action: "parallel"
  max_concurrent: 3
  wait_all: true
  continue_on_failure: false
  actions:
    - action: "run_script"
      script: "./test1.sh"
    - action: "run_script"
      script: "./test2.sh"
```

### Utility Actions

#### save_file
```yaml
- action: "save_file"
  path: "./output/report_${timestamp}.md"
  content: "${report_data}"
```

#### read_file
```yaml
- action: "read_file"
  path: "./config.json"
  output_var: "config_data"
```

#### http_request
```yaml
- action: "http_request"
  method: "POST"
  url: "https://api.example.com/webhook"
  headers:
    Authorization: "Bearer ${api_token}"
  body:
    status: "completed"
    results: "${final_results}"
  output_var: "api_response"
```

#### template
```yaml
- action: "template"
  template_file: "./templates/report.md"
  # OR inline template:
  template: |
    # Report
    Files: ${file_count}
    Status: ${status}
  output_var: "rendered_content"
```

## Variable System

### Available Variables

- **workflow**: `${workflow.name}`, `${workflow.run_id}`, `${workflow.start_time}`
- **stage**: `${stage.id}`, `${stage.output}`, `${stage.status}`
- **instance**: `${instance.id}`, `${instance.role}`
- **actions**: `${actions.my_var}` (from `output_var`)
- **vars**: `${vars.custom}` (from `set_var` action)
- **env**: `${env.HOME}`, `${env.API_KEY}`

### Complex Expressions
```yaml
# Conditional
condition: "${test_results.exit_code} === 0 && ${file_count} > 10"

# Array access
prompt: "Process file: ${files[0]}"

# JSON operations
condition: "${JSON.parse(api_response.body).status} === 'success'"
```

## Example Workflows

### 1. Basic Analysis
```yaml
name: "Code Analysis"
stages:
  - id: "analyze"
    prompt: "Analyze the code. Say ***DONE***"
    trigger_keyword: "***DONE***"
    on_success:
      - action: "complete_workflow"
```

### 2. Script Integration
```yaml
name: "Test and Fix"
stages:
  - id: "test"
    prompt: "Run tests. Say ***TESTED***"
    trigger_keyword: "***TESTED***"
    on_success:
      - action: "run_script"
        script: "npm test"
        capture_output: true
        output_var: "test_results"
      
      - action: "conditional"
        condition: "${test_results.exit_code} !== 0"
        if_true:
          - action: "send_prompt"
            prompt: "Fix these test failures: ${test_results.stderr}"
```

### 3. Parallel Processing
```yaml
name: "Multi-Aspect Review"
stages:
  - id: "review"
    prompt: "Ready for parallel review. Say ***READY***"
    trigger_keyword: "***READY***"
    on_success:
      - action: "parallel"
        actions:
          - action: "spawn"
            context: "Security review specialist"
            output_var: "security_instance"
          - action: "spawn"
            context: "Performance review specialist"
            output_var: "perf_instance"
      
      - action: "parallel"
        actions:
          - action: "send_prompt"
            target: "specific_id"
            instance_id: "${security_instance.instanceId}"
            prompt: "Check for security issues. Say ***SECURITY_DONE***"
            wait_for_keyword: "***SECURITY_DONE***"
          - action: "send_prompt"
            target: "specific_id"
            instance_id: "${perf_instance.instanceId}"
            prompt: "Check for performance issues. Say ***PERF_DONE***"
            wait_for_keyword: "***PERF_DONE***"
```

## Running Workflows

### Command Line
```bash
# Basic usage
node src/workflow/run_workflow.js workflows/my_workflow.yaml

# With environment variables
API_KEY=secret node src/workflow/run_workflow.js workflows/api_workflow.yaml

# Using npm scripts
npm run workflow:simple
npm run workflow:analysis
npm run workflow:parallel
```

### Programmatically
```javascript
const WorkflowEngine = require('./src/workflow/workflow_engine');

const engine = new WorkflowEngine('./workflows/my_workflow.yaml');
engine.on('workflow_complete', (result) => {
  console.log('Workflow completed!', result);
});

await engine.start();
```

## Best Practices

### 1. Keyword Design
- Use unique, obvious keywords: `***TASK_COMPLETE***`
- Avoid common words that might appear accidentally
- Use consistent naming patterns across workflows

### 2. Error Handling
```yaml
# Set appropriate timeouts
timeout: 300

# Handle script failures gracefully
on_failure: "continue"

# Provide fallback actions
on_timeout:
  - action: "log"
    message: "Stage timed out, continuing anyway"
```

### 3. Context Management
```yaml
# Capture important outputs
capture_output: true
output_var: "analysis_results"

# Use descriptive variable names
output_var: "security_scan_results"  # Not just "results"

# Clean up resources
on_success:
  - action: "terminate"
    instance_id: "${temp_instance.instanceId}"
```

### 4. Workflow Organization
- Break complex workflows into stages
- Use descriptive stage names
- Document your workflows with comments
- Version your workflow files

## Debugging

### Enable Verbose Logging
```bash
DEBUG=workflow:* node src/workflow/run_workflow.js workflows/debug.yaml
```

### Common Issues

1. **Keyword not detected**: Check Claude's actual output
2. **Script failures**: Verify paths and permissions
3. **Variable not found**: Check variable names and scope
4. **Timeout errors**: Increase timeout values

### Debug Actions
```yaml
- action: "log"
  message: "Current file count: ${file_count}"

- action: "save_file"
  path: "./debug_output.json"
  content: "${JSON.stringify(actions)}"
```

## Advanced Features

### Custom Actions
Extend the system by adding new action types to `action_executor.js`.

### Workflow Composition
Call other workflows from within workflows:
```yaml
- action: "run_script"
  script: "node src/workflow/run_workflow.js"
  args: ["workflows/sub_workflow.yaml"]
```

### External Integrations
Connect to any system via HTTP requests or custom scripts.

## Performance Tips

1. **Use parallel actions** for independent tasks
2. **Set appropriate timeouts** to fail fast
3. **Clean up instances** when done
4. **Capture only needed output** to reduce memory usage
5. **Use shared workspace mode** for collaborative instances

## Troubleshooting

### Instance Communication Issues
- Verify MCP bridge is working: `node scripts/mcp_bridge.js list '{}' `
- Check instance status in monitoring tools
- Ensure proper cleanup of terminated instances

### Variable Interpolation Problems
- Use `${JSON.stringify(variable)}` for debugging
- Check variable scope (workflow vs stage vs action)
- Verify variable names match exactly

This system provides a powerful foundation for building complex automation workflows with Claude instances while maintaining flexibility and scalability.