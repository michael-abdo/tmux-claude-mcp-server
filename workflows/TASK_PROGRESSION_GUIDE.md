# 📋 Task Progression System - Guide

## Overview

The Task Progression System allows you to define a task once and automatically guide it through multiple stages (implement → test → finalize). The task description is reused in each stage's instruction, ensuring consistency.

## 🚀 Quick Start

### Method 1: Using the Launcher (Recommended)

```bash
# Run with automatic instance detection
node task_chain_launcher.js simple_task_progression.json

# Or specify an instance ID
node task_chain_launcher.js simple_task_progression.json spec_1_1_123456
```

The launcher will:
1. Load your task configuration
2. Send the initial prompt automatically
3. Start monitoring for stage progression
4. Guide the task through all stages

### Method 2: Manual Setup

```bash
# 1. Edit the config file with your instance ID
# 2. Run the chain monitor
node chain_keyword_monitor.js simple_task_progression.json

# 3. Manually send the initial prompt with task description
TASK="Create a function that validates email addresses using regex"
INSTANCE_ID=spec_1_1_123456
node ../scripts/mcp_bridge.js send "{\"instanceId\":\"$INSTANCE_ID\",\"text\":\"Please implement the following: '$TASK'. Create a working solution and show the code. When done, say IMPLEMENTED\"}"
```

## 📄 Configuration Format

```json
{
  "instanceId": "YOUR_INSTANCE_ID",
  "taskDescription": "Your task description here",
  "initialPrompt": "Please implement: '{{TASK}}'. When done, say IMPLEMENTED",
  "chains": [
    {
      "keyword": "IMPLEMENTED",
      "instruction": "Now test '{{TASK}}' by...",
      "nextKeyword": "TESTED"
    }
  ]
}
```

### Key Features:
- **`{{TASK}}`** placeholder is replaced with `taskDescription` in all instructions
- Define the task once, reference it everywhere
- Consistent context through all stages

## 🎯 Example Workflows

### 1. Simple Implementation Flow
```json
{
  "taskDescription": "Create a function that validates email addresses",
  "chains": [
    { "keyword": "IMPLEMENTED", "instruction": "Test '{{TASK}}'...", "nextKeyword": "TESTED" },
    { "keyword": "TESTED", "instruction": "Document '{{TASK}}'...", "nextKeyword": "COMPLETE" }
  ]
}
```

### 2. Code Review Flow
```json
{
  "taskDescription": "Refactor the user authentication module for better security",
  "chains": [
    { "keyword": "REFACTORED", "instruction": "Review '{{TASK}}' for security issues...", "nextKeyword": "REVIEWED" },
    { "keyword": "REVIEWED", "instruction": "Test '{{TASK}}' changes...", "nextKeyword": "TESTED" },
    { "keyword": "TESTED", "instruction": "Create PR for '{{TASK}}'...", "nextKeyword": "PR_CREATED" }
  ]
}
```

### 3. Bug Fix Flow
```json
{
  "taskDescription": "Fix the memory leak in the image processing function",
  "chains": [
    { "keyword": "DIAGNOSED", "instruction": "Implement fix for '{{TASK}}'...", "nextKeyword": "FIXED" },
    { "keyword": "FIXED", "instruction": "Verify '{{TASK}}' is resolved...", "nextKeyword": "VERIFIED" },
    { "keyword": "VERIFIED", "instruction": "Document '{{TASK}}' resolution...", "nextKeyword": "DOCUMENTED" }
  ]
}
```

## 🛠️ Creating Custom Workflows

1. **Define Clear Stages**: Each stage should have a specific purpose
2. **Use Action Keywords**: IMPLEMENTED, TESTED, REVIEWED, DOCUMENTED, etc.
3. **Include Specific Instructions**: Tell Claude exactly what to do at each stage
4. **Reference the Task**: Use {{TASK}} to maintain context

## 📊 Stage Patterns

### Standard Development Flow
1. **Implement** → IMPLEMENTED
2. **Test** → TESTED  
3. **Document** → DOCUMENTED
4. **Commit** → COMMITTED

### Review and Refactor Flow
1. **Analyze** → ANALYZED
2. **Plan** → PLANNED
3. **Refactor** → REFACTORED
4. **Validate** → VALIDATED

### Debug Flow
1. **Reproduce** → REPRODUCED
2. **Diagnose** → DIAGNOSED
3. **Fix** → FIXED
4. **Verify** → VERIFIED

## 🎨 Best Practices

1. **Keep Tasks Focused**: One clear objective per task
2. **Make Stages Meaningful**: Each stage should add value
3. **Use Descriptive Keywords**: Make it clear what each stage accomplished
4. **Include Success Criteria**: Tell Claude how to know when each stage is complete
5. **Add Validation Steps**: Include testing/verification stages

## 🔧 Advanced Features

### Dynamic Task Loading
```bash
# Create task on the fly
TASK="Implement user profile avatar upload"
cat > dynamic_task.json << EOF
{
  "instanceId": "$(node ../scripts/mcp_bridge.js list '{}' | jq -r '.instances[-1].instanceId')",
  "taskDescription": "$TASK",
  "initialPrompt": "Implement: '{{TASK}}'. Say DONE when complete",
  "chains": [
    { "keyword": "DONE", "instruction": "Test '{{TASK}}'", "nextKeyword": "TESTED" }
  ]
}
EOF

node task_chain_launcher.js dynamic_task.json
```

### Conditional Branching
```json
{
  "chains": [
    {
      "keyword": "NEEDS_REFACTOR",
      "instruction": "Refactor '{{TASK}}' following clean code principles..."
    },
    {
      "keyword": "LOOKS_GOOD", 
      "instruction": "Proceed with testing '{{TASK}}'..."
    }
  ]
}
```

## 🎉 Success!

You now have a powerful system for guiding tasks through consistent, well-defined stages. The task context is maintained throughout the entire workflow, ensuring Claude always knows what it's working on!