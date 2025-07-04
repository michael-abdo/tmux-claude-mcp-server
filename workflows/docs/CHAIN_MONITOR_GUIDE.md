# 🔗 Chain Keyword Monitor - Complete Guide

## Overview

The Chain Keyword Monitor extends the debug keyword monitor to automatically send follow-up instructions when keywords are detected, enabling seamless workflow chaining. This allows you to create automated multi-stage workflows where each stage triggers the next.

## 🎯 Key Features

- **Automatic Stage Progression**: Detects completion keywords and automatically sends next instructions
- **Robust Keyword Detection**: Inherits sophisticated filtering from debug monitor (no false positives)
- **Error Recovery**: Retry logic with configurable attempts and delays
- **Event-Driven Architecture**: Full event system for monitoring progress
- **Flexible Configuration**: JSON-based configuration for easy setup
- **Status Monitoring**: Real-time status reporting and progress tracking

## 🚀 Quick Start

### 1. Create Configuration File

```json
{
  "instanceId": "spec_1_1_397923",
  "chains": [
    {
      "keyword": "STAGE1_COMPLETE",
      "instruction": "Excellent! Now move to Stage 2: Please analyze the requirements and create a detailed implementation plan. End by saying STAGE2_COMPLETE",
      "nextKeyword": "STAGE2_COMPLETE"
    },
    {
      "keyword": "STAGE2_COMPLETE", 
      "instruction": "Perfect! Now move to Stage 3: Begin the actual implementation based on your plan. End by saying STAGE3_COMPLETE",
      "nextKeyword": "STAGE3_COMPLETE"
    },
    {
      "keyword": "STAGE3_COMPLETE",
      "instruction": "Fantastic! Final stage: Please review your implementation, test it, and provide a summary. End by saying ALL_COMPLETE"
    }
  ],
  "options": {
    "pollInterval": 5,
    "timeout": 1800,
    "retryAttempts": 3,
    "retryDelay": 2
  }
}
```

### 2. Run the Monitor

```bash
node chain_keyword_monitor.js your_config.json
```

### 3. Start Your Initial Task

Send the first instruction to your Claude instance manually to begin the chain:

```bash
# Terminal 3 - Send initial prompt
INSTANCE_ID=$(node ../scripts/mcp_bridge.js list '{}' | jq -r '.instances[-1].instanceId') && \
echo "Sending to: $INSTANCE_ID" && \
node ../scripts/mcp_bridge.js send "{\"instanceId\":\"$INSTANCE_ID\",\"text\":\"Execute Stage 1: Create a plan for implementing a feature. End by saying STAGE1_COMPLETE\"}"
```

## 📋 Configuration Reference

### Required Fields

- **`instanceId`**: The Claude instance ID to monitor
- **`chains`**: Array of keyword→instruction mappings

### Chain Object

- **`keyword`**: The completion keyword to detect (e.g., "STAGE1_COMPLETE")
- **`instruction`**: The instruction to send when keyword is detected
- **`nextKeyword`** *(optional)*: The next keyword to monitor for (enables chaining)

### Options

- **`pollInterval`**: How often to check for keywords (seconds, default: 5)
- **`timeout`**: Total timeout for the entire chain (seconds, default: 600)
- **`retryAttempts`**: Number of retry attempts for sending instructions (default: 3)
- **`retryDelay`**: Delay between retries (seconds, default: 2)

## 🎛️ Advanced Usage

### Multi-Branch Workflows

You can create complex workflows with conditional branches:

```json
{
  "instanceId": "your_instance",
  "chains": [
    {
      "keyword": "ANALYSIS_COMPLETE",
      "instruction": "Based on your analysis, choose path A or B. If A, end with PATH_A_COMPLETE. If B, end with PATH_B_COMPLETE"
    },
    {
      "keyword": "PATH_A_COMPLETE",
      "instruction": "Execute Path A workflow: [instructions]. End with FINAL_COMPLETE"
    },
    {
      "keyword": "PATH_B_COMPLETE",
      "instruction": "Execute Path B workflow: [instructions]. End with FINAL_COMPLETE"
    },
    {
      "keyword": "FINAL_COMPLETE",
      "instruction": "Workflow complete! Provide summary."
    }
  ]
}
```

### Long-Running Workflows

For extensive workflows, increase timeout and adjust polling:

```json
{
  "options": {
    "pollInterval": 10,
    "timeout": 3600,
    "retryAttempts": 5,
    "retryDelay": 3
  }
}
```

## 🔧 Running Multiple Monitors

You can run multiple chain monitors for different workflows:

```bash
# Terminal 1 - Monitor workflow A
node chain_keyword_monitor.js workflow_a_config.json

# Terminal 2 - Monitor workflow B  
node chain_keyword_monitor.js workflow_b_config.json

# Terminal 3 - Send commands as needed
```

## 📊 Monitoring and Events

The chain monitor emits detailed events for integration:

```javascript
import { ChainKeywordMonitor } from './chain_keyword_monitor.js';

const monitor = new ChainKeywordMonitor(config);

monitor.on('started', () => console.log('Monitor started'));
monitor.on('chain_executed', ({ keyword, instruction, chainIndex }) => {
  console.log(`Chain ${chainIndex + 1} executed: ${keyword}`);
});
monitor.on('chain_complete', ({ totalStages }) => {
  console.log(`All ${totalStages} stages completed!`);
});
monitor.on('chain_failed', ({ keyword, instruction }) => {
  console.error(`Failed at: ${keyword}`);
});
monitor.on('timeout', ({ currentChain, executedChains }) => {
  console.log(`Timeout at chain ${currentChain}, executed ${executedChains}`);
});
```

## 🛡️ Error Handling

### Common Issues and Solutions

**Issue**: "Config file not found"
```bash
# Solution: Check file path
ls -la your_config.json
```

**Issue**: "Instance not found"
```bash
# Solution: List active instances
node ../scripts/mcp_bridge.js list '{}'
```

**Issue**: "Keyword not detected"
- Check if keyword format matches exactly
- Verify instance is actually outputting the keyword
- Check debug logs for filtering reasons

### Debugging

Enable verbose logging:
```bash
DEBUG=1 node chain_keyword_monitor.js config.json
```

## 🎯 Best Practices

### Keyword Design
- Use distinctive patterns: `STAGE_NAME_COMPLETE`
- Avoid common words that might appear in regular output
- Include stage numbers for clarity: `STAGE1_COMPLETE`

### Instruction Writing
- Be explicit about what to do next
- Always specify the expected completion keyword
- Keep instructions focused and actionable

### Chain Design
- Start with simple linear chains
- Test each stage individually first
- Design fallback strategies for errors

### Performance
- Use reasonable poll intervals (5-10 seconds)
- Set appropriate timeouts for your workflow complexity
- Monitor system resources for long-running chains

## 📚 Examples

### Simple 3-Stage Workflow
```json
{
  "instanceId": "your_instance",
  "chains": [
    {
      "keyword": "PLAN_COMPLETE",
      "instruction": "Great! Now implement the plan. End with IMPLEMENTATION_COMPLETE",
      "nextKeyword": "IMPLEMENTATION_COMPLETE"
    },
    {
      "keyword": "IMPLEMENTATION_COMPLETE",
      "instruction": "Perfect! Now test and validate. End with TESTING_COMPLETE",
      "nextKeyword": "TESTING_COMPLETE"
    },
    {
      "keyword": "TESTING_COMPLETE",
      "instruction": "Excellent! Provide final summary and documentation."
    }
  ]
}
```

### Code Review Workflow
```json
{
  "instanceId": "your_instance", 
  "chains": [
    {
      "keyword": "CODE_READY",
      "instruction": "Please review the code for bugs, security issues, and best practices. End with REVIEW_COMPLETE",
      "nextKeyword": "REVIEW_COMPLETE"
    },
    {
      "keyword": "REVIEW_COMPLETE",
      "instruction": "Based on your review, create unit tests. End with TESTS_COMPLETE",
      "nextKeyword": "TESTS_COMPLETE"
    },
    {
      "keyword": "TESTS_COMPLETE",
      "instruction": "Generate documentation for the code. End with DOCS_COMPLETE"
    }
  ]
}
```

## 🎊 Success! 

You now have a powerful workflow automation system that can chain together complex multi-stage tasks automatically. The monitor will handle all the keyword detection and instruction sending, allowing you to create sophisticated automated workflows with Claude instances.