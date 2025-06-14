# Advanced Workflow Action System

## Core Concept: Action Chains with Context Flow

Every action can produce output that flows into subsequent actions. This enables complex workflows where scripts generate data, prompts use that data, and decisions are made based on results.

## Enhanced Action Schema

```yaml
# Example: Complex multi-action workflow
stages:
  - id: "analyze_and_fix"
    name: "Analyze Code and Auto-fix Issues"
    prompt: |
      Analyze the codebase for issues.
      WHEN YOU ARE DONE YOU MUST SAY "***ANALYSIS_COMPLETE***"
    
    trigger_keyword: "***ANALYSIS_COMPLETE***"
    
    on_success:
      # Actions execute sequentially, each receiving context from previous
      - action: "run_script"
        script: "./scripts/extract_issues.py"
        args: ["${instance_id}"]
        target: "local"  # local, instance, or new_shell
        capture_output: true
        output_var: "issues_json"
      
      - action: "run_script"
        script: "./scripts/prioritize_issues.sh"
        stdin: "${issues_json}"  # Pipe previous output
        capture_output: true
        output_var: "priority_issues"
      
      - action: "conditional"
        condition: "${priority_issues.count} > 0"
        if_true:
          - action: "send_prompt"
            target: "same_instance"
            prompt: |
              Fix these high-priority issues:
              ${priority_issues}
              
              WHEN YOU ARE DONE YOU MUST SAY "***FIXES_APPLIED***"
            next_stage: "verify_fixes"
        if_false:
          - action: "log"
            message: "No high-priority issues found"
          - action: "complete_workflow"
      
      - action: "parallel"  # Run multiple actions simultaneously
        actions:
          - action: "run_script"
            script: "./notify_slack.py"
            args: ["Issues found: ${priority_issues.count}"]
          - action: "save_file"
            path: "./reports/issues_${timestamp}.json"
            content: "${issues_json}"

  - id: "verify_fixes"
    name: "Verify Applied Fixes"
    trigger_keyword: "***FIXES_APPLIED***"
    
    on_success:
      # Chain of verification actions
      - action: "run_script"
        script: "npm test"
        target: "instance"  # Run inside the Claude instance
        expect_exit_code: 0
        on_failure: "retry_once"  # or "continue", "abort"
      
      - action: "run_script"
        script: "./scripts/lint.sh"
        capture_output: true
        output_var: "lint_results"
      
      - action: "send_prompt"
        target: "new_instance"
        role: "manager"
        prompt: |
          Review the fixes and lint results:
          ${lint_results}
          
          Create a summary report.
          WHEN YOU ARE DONE YOU MUST SAY "***REPORT_READY***"
        next_stage: "finalize"
```

## Action Types

### 1. Script Execution Actions

```yaml
# Run any executable file
- action: "run_script"
  script: "./analyze.py"  # .py, .sh, .js, any executable
  args: ["${var1}", "--flag", "${var2}"]
  env:  # Optional environment variables
    API_KEY: "${secrets.api_key}"
    MODE: "production"
  target: "local"  # Where to run
  working_dir: "./src"  # Optional
  timeout: 60  # seconds
  capture_output: true  # Capture stdout/stderr
  output_var: "script_result"  # Store in context
  expect_exit_code: 0  # Expected success code
  on_failure: "abort"  # abort, continue, retry_once

# Run inside Claude instance
- action: "run_script"
  script: "python analyze.py"
  target: "instance"
  instance_id: "${current_instance}"  # or specific ID
```

### 2. Prompt Actions

```yaml
# Send prompt with interpolated context
- action: "send_prompt"
  target: "same_instance"  # same_instance, new_instance, specific_id
  prompt: |
    Based on the analysis results:
    ${script_result}
    
    And the previous findings:
    ${previous_stage.output}
    
    Please fix the issues.
    ***DONE_FIXING***
  
  # Optional: wait for keyword before continuing
  wait_for_keyword: "***DONE_FIXING***"
  timeout: 300
  
  # Optional: extract data from response
  extract_pattern: "SUMMARY: (.*?)END_SUMMARY"
  extract_var: "fix_summary"
```

### 3. Control Flow Actions

```yaml
# Conditional execution
- action: "conditional"
  condition: "${script_result.exit_code} == 0 && ${issues.count} > 5"
  if_true:
    - action: "send_prompt"
      prompt: "Many issues found, please review"
  if_false:
    - action: "log"
      message: "Few or no issues"

# Parallel execution
- action: "parallel"
  max_concurrent: 3
  actions:
    - action: "run_script"
      script: "./test_unit.sh"
    - action: "run_script"
      script: "./test_integration.sh"
    - action: "run_script"
      script: "./test_e2e.sh"
  wait_all: true  # Wait for all to complete
  continue_on_failure: false

# Loop execution
- action: "foreach"
  items: "${issues_json.issues}"
  item_var: "issue"
  actions:
    - action: "send_prompt"
      prompt: "Fix issue: ${issue.description}"
      wait_for_keyword: "***FIXED***"
```

### 4. Data Manipulation Actions

```yaml
# Transform data
- action: "transform"
  input: "${script_result}"
  operation: "json_parse"  # json_parse, regex_extract, template
  output_var: "parsed_result"

# Aggregate results
- action: "aggregate"
  inputs: ["${test1_result}", "${test2_result}", "${test3_result}"]
  operation: "merge_json"
  output_var: "all_results"

# Template rendering
- action: "template"
  template_file: "./templates/report.md"
  context:
    issues: "${issues_json}"
    fixes: "${fix_summary}"
    timestamp: "${workflow.timestamp}"
  output_var: "report_content"
```

### 5. External Integration Actions

```yaml
# HTTP requests
- action: "http_request"
  method: "POST"
  url: "https://api.example.com/workflow/complete"
  headers:
    Authorization: "Bearer ${secrets.api_token}"
  body:
    workflow_id: "${workflow.id}"
    results: "${final_results}"
  output_var: "api_response"

# Database operations
- action: "database"
  operation: "insert"
  connection: "${config.db_connection}"
  table: "workflow_runs"
  data:
    id: "${workflow.run_id}"
    status: "completed"
    results: "${final_results}"
```

## Context System

### Context Variables

Every action has access to:

```javascript
{
  // Workflow metadata
  workflow: {
    id: "workflow_123",
    name: "Code Review Workflow",
    run_id: "run_456",
    timestamp: "2024-01-13T10:30:00Z"
  },
  
  // Current stage info
  stage: {
    id: "analyze",
    name: "Analyze Code",
    iteration: 1
  },
  
  // Instance information
  instance: {
    id: "spec_1_1_1",
    role: "specialist",
    working_dir: "/path/to/project"
  },
  
  // Previous action outputs
  actions: {
    script_result: {
      stdout: "...",
      stderr: "...",
      exit_code: 0
    },
    api_response: {
      status: 200,
      body: {...}
    }
  },
  
  // Previous stage outputs
  stages: {
    analyze: {
      output: "...",
      duration: 45.2,
      keyword_detected: "***DONE***"
    }
  },
  
  // User-defined variables
  vars: {
    custom_var: "value"
  }
}
```

### Variable Interpolation

```yaml
# Simple interpolation
prompt: "Fix issue: ${issue.title}"

# Nested access
prompt: "Previous result: ${stages.analyze.output}"

# Array access
prompt: "First issue: ${issues[0].description}"

# Conditional interpolation
prompt: "Status: ${script_result.exit_code == 0 ? 'Success' : 'Failed'}"

# JSON stringification
prompt: "Data: ${JSON.stringify(api_response.body)}"
```

## Implementation Examples

### Example 1: Test → Fix → Verify Cycle

```yaml
stages:
  - id: "run_tests"
    prompt: "Run npm test and report results. Say ***TESTS_COMPLETE***"
    trigger_keyword: "***TESTS_COMPLETE***"
    
    on_success:
      - action: "run_script"
        script: "npm test"
        target: "instance"
        capture_output: true
        output_var: "test_results"
      
      - action: "conditional"
        condition: "${test_results.exit_code} != 0"
        if_true:
          - action: "send_prompt"
            target: "same_instance"
            prompt: |
              Tests are failing with:
              ${test_results.stderr}
              
              Please fix the failing tests.
              Say ***TESTS_FIXED*** when done.
            wait_for_keyword: "***TESTS_FIXED***"
          
          - action: "run_script"
            script: "npm test"
            target: "instance"
            expect_exit_code: 0
        
        if_false:
          - action: "log"
            message: "All tests passing!"
```

### Example 2: Multi-Script Pipeline

```yaml
stages:
  - id: "process_data"
    prompt: "Preparing data processing. Say ***READY***"
    trigger_keyword: "***READY***"
    
    on_success:
      # Extract data
      - action: "run_script"
        script: "./extract_data.py"
        args: ["--source", "database"]
        capture_output: true
        output_var: "raw_data"
      
      # Transform data
      - action: "run_script"
        script: "./transform_data.py"
        stdin: "${raw_data}"
        capture_output: true
        output_var: "transformed_data"
      
      # Validate data
      - action: "run_script"
        script: "./validate_data.sh"
        stdin: "${transformed_data}"
        expect_exit_code: 0
      
      # Load data with Claude's help
      - action: "save_file"
        path: "./temp/data.json"
        content: "${transformed_data}"
      
      - action: "send_prompt"
        prompt: |
          Review the transformed data in ./temp/data.json
          Generate a SQL script to load this data.
          Say ***SQL_READY*** when done.
        wait_for_keyword: "***SQL_READY***"
      
      # Execute the SQL
      - action: "run_script"
        script: "./execute_sql.py"
        args: ["./output/load_data.sql"]
```

## Benefits of This Design

1. **Maximum Flexibility**: Combine any actions in any order
2. **Data Flow**: Each action can use outputs from previous actions
3. **Error Handling**: Granular control over failure scenarios
4. **Parallel Processing**: Run multiple scripts/prompts simultaneously
5. **Conditional Logic**: Make decisions based on results
6. **External Integration**: Connect to any external system
7. **Testability**: Each action is isolated and testable