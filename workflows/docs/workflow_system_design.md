# Prompt-Based Workflow System Design

## Overview

A scalable infrastructure for building chain-based workflows using Claude instances, where each step monitors output for keywords and triggers subsequent actions.

## Core Components

### 1. Workflow Definition Schema (YAML)

```yaml
# Example workflow: code_review_workflow.yaml
name: "Code Review Workflow"
version: "1.0"
description: "Automated code review with multiple analysis stages"

# Global settings
settings:
  poll_interval: 5  # seconds
  timeout: 300      # seconds per stage
  instance_role: "specialist"
  workspace_mode: "isolated"

# Workflow stages
stages:
  - id: "analyze_structure"
    name: "Analyze Code Structure"
    prompt: |
      Analyze the code structure in the src/ directory. Look for:
      - Architecture patterns
      - File organization
      - Dependencies
      
      WHEN YOU ARE DONE YOU MUST SAY "***STRUCTURE_ANALYZED***"
    
    trigger_keyword: "***STRUCTURE_ANALYZED***"
    
    on_success:
      - action: "send_prompt"
        target: "same_instance"  # or "new_instance"
        next_stage: "check_patterns"
    
    on_timeout:
      - action: "terminate"
      - action: "notify"
        message: "Structure analysis timed out"

  - id: "check_patterns"
    name: "Check Design Patterns"
    prompt: |
      Based on your structure analysis, check for:
      - SOLID principles violations
      - Anti-patterns
      - Best practices
      
      WHEN YOU ARE DONE YOU MUST SAY "***PATTERNS_CHECKED***"
    
    trigger_keyword: "***PATTERNS_CHECKED***"
    
    on_success:
      - action: "run_script"
        script: "./scripts/generate_report.js"
        args: ["${instance_id}", "${workflow_run_id}"]
      - action: "send_prompt"
        target: "new_instance"
        role: "manager"
        next_stage: "summarize_findings"

  - id: "summarize_findings"
    name: "Summarize All Findings"
    prompt: |
      Read the analysis from the specialist instances and create a summary report.
      
      WHEN YOU ARE DONE YOU MUST SAY "***REVIEW_COMPLETE***"
    
    trigger_keyword: "***REVIEW_COMPLETE***"
    
    on_success:
      - action: "complete_workflow"
      - action: "save_output"
        path: "./reports/code_review_${timestamp}.md"
```

### 2. Workflow Engine Core

```javascript
// src/workflow/engine.js
class WorkflowEngine {
  constructor(workflowConfig, bridge) {
    this.config = workflowConfig;
    this.bridge = bridge;
    this.state = new WorkflowState(workflowConfig.name);
    this.monitors = new Map();
  }

  async start() {
    console.log(`Starting workflow: ${this.config.name}`);
    const firstStage = this.config.stages[0];
    await this.executeStage(firstStage);
  }

  async executeStage(stage) {
    this.state.setCurrentStage(stage.id);
    
    // Spawn instance if needed
    const instanceId = await this.getOrCreateInstance(stage);
    
    // Send the prompt
    await this.bridge.send({
      instanceId,
      text: this.interpolatePrompt(stage.prompt)
    });
    
    // Start monitoring for keyword
    const monitor = new KeywordMonitor(
      instanceId,
      stage.trigger_keyword,
      this.config.settings.poll_interval
    );
    
    monitor.on('keyword_detected', async (output) => {
      await this.handleStageSuccess(stage, instanceId, output);
    });
    
    monitor.on('timeout', async () => {
      await this.handleStageTimeout(stage, instanceId);
    });
    
    monitor.start();
    this.monitors.set(stage.id, monitor);
  }

  async handleStageSuccess(stage, instanceId, output) {
    this.state.completeStage(stage.id, output);
    
    for (const action of stage.on_success) {
      await this.executeAction(action, stage, instanceId);
    }
  }

  async executeAction(action, stage, instanceId) {
    const handlers = {
      'send_prompt': this.handleSendPrompt.bind(this),
      'run_script': this.handleRunScript.bind(this),
      'terminate': this.handleTerminate.bind(this),
      'complete_workflow': this.handleComplete.bind(this),
      'save_output': this.handleSaveOutput.bind(this)
    };
    
    const handler = handlers[action.action];
    if (handler) {
      await handler(action, stage, instanceId);
    }
  }
}
```

### 3. Keyword Monitor Service

```javascript
// src/workflow/keyword_monitor.js
class KeywordMonitor extends EventEmitter {
  constructor(instanceId, keyword, pollInterval = 5) {
    super();
    this.instanceId = instanceId;
    this.keyword = keyword;
    this.pollInterval = pollInterval * 1000;
    this.lastLineRead = 0;
    this.startTime = Date.now();
    this.bridge = new MCPBridge();
  }

  start() {
    this.interval = setInterval(() => this.checkOutput(), this.pollInterval);
  }

  async checkOutput() {
    try {
      const result = await this.bridge.read({
        instanceId: this.instanceId,
        lines: 100  // Read last 100 lines
      });
      
      if (result.output.includes(this.keyword)) {
        this.stop();
        this.emit('keyword_detected', result.output);
      }
      
      // Check timeout
      if (Date.now() - this.startTime > this.timeout) {
        this.stop();
        this.emit('timeout');
      }
    } catch (error) {
      this.emit('error', error);
    }
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }
}
```

### 4. Action Handlers

```javascript
// src/workflow/actions/index.js
class ActionHandlers {
  constructor(bridge, state) {
    this.bridge = bridge;
    this.state = state;
  }

  async sendPrompt({ target, next_stage, role }, currentStage, instanceId) {
    let targetInstance = instanceId;
    
    if (target === 'new_instance') {
      targetInstance = await this.bridge.spawn({
        role: role || 'specialist',
        workDir: process.cwd(),
        context: `Continuing workflow: ${this.state.workflowName}`,
        parentId: instanceId
      });
    }
    
    const nextStageConfig = this.state.getStage(next_stage);
    if (nextStageConfig) {
      await new WorkflowEngine().executeStage(nextStageConfig);
    }
  }

  async runScript({ script, args }, stage, instanceId) {
    const interpolatedArgs = args.map(arg => 
      arg.replace('${instance_id}', instanceId)
         .replace('${workflow_run_id}', this.state.runId)
    );
    
    const { spawn } = require('child_process');
    return new Promise((resolve, reject) => {
      const proc = spawn(script, interpolatedArgs);
      proc.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`Script failed with code ${code}`));
      });
    });
  }

  async terminate({ cascade = true }, stage, instanceId) {
    await this.bridge.terminate({ instanceId, cascade });
  }

  async saveOutput({ path }, stage, instanceId) {
    const output = await this.bridge.read({ 
      instanceId, 
      lines: -1  // Read all
    });
    
    const timestamp = new Date().toISOString();
    const finalPath = path.replace('${timestamp}', timestamp);
    
    await fs.writeFile(finalPath, output.output);
  }
}
```

### 5. Workflow State Management

```javascript
// src/workflow/state.js
class WorkflowState {
  constructor(workflowName) {
    this.workflowName = workflowName;
    this.runId = `run_${Date.now()}`;
    this.stages = new Map();
    this.currentStage = null;
    this.startTime = Date.now();
  }

  setCurrentStage(stageId) {
    this.currentStage = stageId;
    this.stages.set(stageId, {
      status: 'running',
      startTime: Date.now()
    });
  }

  completeStage(stageId, output) {
    const stage = this.stages.get(stageId);
    stage.status = 'completed';
    stage.endTime = Date.now();
    stage.output = output;
  }

  getProgress() {
    return {
      workflow: this.workflowName,
      runId: this.runId,
      currentStage: this.currentStage,
      stages: Array.from(this.stages.entries()).map(([id, data]) => ({
        id,
        ...data,
        duration: data.endTime ? data.endTime - data.startTime : null
      }))
    };
  }

  save() {
    const statePath = `./workflow_state/${this.runId}.json`;
    fs.writeFileSync(statePath, JSON.stringify(this.getProgress(), null, 2));
  }
}
```

## Usage Examples

### 1. Simple Linear Workflow
```yaml
name: "Simple Analysis"
stages:
  - id: "analyze"
    prompt: "Analyze this code. Say ***DONE*** when finished."
    trigger_keyword: "***DONE***"
    on_success:
      - action: "complete_workflow"
```

### 2. Branching Workflow
```yaml
name: "Conditional Review"
stages:
  - id: "initial_check"
    prompt: "Check if refactoring needed. Say ***NEEDS_REFACTOR*** or ***LOOKS_GOOD***"
    trigger_keyword: "***NEEDS_REFACTOR***|***LOOKS_GOOD***"
    on_success:
      - action: "conditional"
        conditions:
          - keyword: "***NEEDS_REFACTOR***"
            actions:
              - action: "send_prompt"
                next_stage: "suggest_refactoring"
          - keyword: "***LOOKS_GOOD***"
            actions:
              - action: "complete_workflow"
```

### 3. Parallel Workflow
```yaml
name: "Parallel Analysis"
stages:
  - id: "spawn_analyzers"
    prompt: "Starting parallel analysis. Say ***READY***"
    trigger_keyword: "***READY***"
    on_success:
      - action: "parallel"
        stages: ["security_check", "performance_check", "style_check"]
      - action: "wait_all"
      - action: "send_prompt"
        next_stage: "consolidate_results"
```

## Implementation Plan

1. **Phase 1: Core Engine**
   - Workflow parser (YAML → Config)
   - Basic stage execution
   - Simple keyword monitoring

2. **Phase 2: Action System**
   - Pluggable action handlers
   - Built-in actions (send_prompt, run_script, etc.)
   - Custom action support

3. **Phase 3: Advanced Features**
   - Conditional branching
   - Parallel execution
   - Error recovery
   - Workflow composition

4. **Phase 4: UI & Monitoring**
   - Web dashboard
   - Real-time progress
   - Workflow designer
   - Analytics

## Benefits

1. **Declarative**: Define workflows in YAML, no coding required
2. **Modular**: Swap actions, add new handlers easily
3. **Scalable**: Run dozens of workflows concurrently
4. **Resilient**: Built-in timeout, retry, and recovery
5. **Observable**: Track progress, debug issues
6. **Reusable**: Share workflow definitions, build libraries