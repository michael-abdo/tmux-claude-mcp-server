# Orchestration User Guide

## Overview

The tmux-claude orchestration system enables hierarchical AI collaboration where Executive instances spawn Managers, and Managers spawn Specialists. This guide covers the improved orchestration patterns that ensure reliable communication and coordination.

## Key Improvements

### 1. Spawn Confirmation Pattern

All instances now confirm they understand their context before proceeding:

```javascript
// Executive spawning a Manager
const { instanceId } = await spawn({
    role: 'manager',
    workDir: '/path/to/project',
    context: 'Detailed manager instructions...'
});

// Wait for confirmation (handled automatically)
// Manager will reply: "READY: manager - understood X tasks"
```

### 2. Message Queuing

Messages between instances are queued for reliable delivery:

```javascript
// Enhanced send (if available)
await enhancedSend({
    targetInstanceId: instanceId,
    message: 'Important instruction',
    priority: 'high'
});

// Messages won't be lost even if instance is busy
```

### 3. Project State Management

Prevents file conflicts and shares knowledge:

```javascript
// Automatically tracks file modifications
// Prevents multiple specialists from editing same files
// Shares discoveries between instances
```

## Role-Specific Guidelines

### Executive Role

Executives orchestrate projects by:
1. Creating PROJECT_PLAN.md first
2. Spawning Managers one at a time
3. Verifying Manager understanding
4. Monitoring progress regularly

**CRITICAL RULES:**
- **YOU MUST DELEGATE ALL IMPLEMENTATION** - Never write code or implement features directly
- **ONLY use MCP tools** - Never use bash/shell commands for orchestration
- **DELEGATION IS MANDATORY** - If you find yourself writing code, STOP and spawn a Manager
- Always verify spawns with confirmation pattern
- Create project plan before spawning
- Monitor Manager progress every 5-10 minutes

**What Executives DO:**
- Plan project structure
- Break down work into Manager-sized chunks
- Spawn and coordinate Managers
- Monitor progress
- Resolve blockers
- Ensure quality and completion

**What Executives DON'T DO:**
- Write any implementation code
- Create UI components
- Implement features
- Fix bugs directly
- Make code changes

### Manager Role

Managers coordinate Specialists by:
1. Planning work breakdown first
2. Checking for file conflicts
3. Spawning 3-5 Specialists max
4. Monitoring and merging work

**Key Rules:**
- Prevent file conflicts between Specialists
- Use executeParallel for independent tasks
- Monitor Specialist progress every 2-3 minutes
- Merge branches in dependency order

### Specialist Role

Specialists implement specific tasks:
1. Work on assigned files only
2. Use feature branches
3. Make atomic commits
4. Report blockers via todos

**Key Rules:**
- NO access to MCP orchestration tools
- Create branch: specialist-{id}-{feature}
- Work only on assigned files
- Document blockers in todos

## Common Patterns

### Spawning with Verification

```javascript
// Executive spawning Manager
const { instanceId } = await spawn({
    role: 'manager',
    workDir: projectDir,
    context: `You are the UI Manager.

YOUR TASKS:
1. Create navigation component
2. Build homepage
3. Implement responsive design

IMPORTANT: As Manager, you will delegate ALL implementation to Specialists.
Do NOT implement code yourself - plan the work and spawn Specialists.

When ready, reply: "READY: UI Manager - understood 3 tasks"`
});
```

### Monitoring Progress

```javascript
// Check all instances
const progress = await monitorAllProgress(tools);

// Check specific Manager
const managerProgress = await getProgress({ 
    instanceId: managerId 
});
```

### Handling Blockers

```javascript
// Find blocked instances
const blocked = await findBlockedInstances(tools);

// Send resolution
await send({
    instanceId: blockedId,
    text: 'RESOLUTION: Use alternative approach...'
});
```

## Best Practices

### 1. Project Structure

```
/project-root/
  ├── PROJECT_PLAN.md         # Created by Executive
  ├── .claude-state.json      # Managed by ProjectState
  ├── exec_[id]/              # Executive workspace
  ├── mgr_[id]/               # Manager workspaces
  └── spec_[id]/              # Specialist workspaces
```

### 2. Communication Flow

```
Executive
  ├─→ "Create PROJECT_PLAN.md"
  ├─→ Manager 1: "READY: confirmed"
  │     ├─→ Specialist 1.1: "READY: confirmed"
  │     └─→ Specialist 1.2: "READY: confirmed"
  └─→ Manager 2: "READY: confirmed"
        └─→ Specialist 2.1: "READY: confirmed"
```

### 3. Error Recovery

If an instance fails:
1. Check instance health
2. Use restart tool with --continue
3. Send RESOLUTION message for blockers
4. Redistribute work if needed

## Troubleshooting

### Instance Not Responding

```bash
# Check tmux session
tmux list-sessions | grep claude_

# Check instance output
tmux capture-pane -t claude_[instanceId] -p | tail -50

# Send health check
await send({
    instanceId: instanceId,
    text: 'HEALTH_CHECK: Please respond with HEALTHY'
});
```

### Spawn Failures

Common issues:
- **"Instance failed to confirm"** - Instance didn't reply with READY
- **"File conflict"** - Another Specialist working on same files
- **"Missing MCP tools"** - Specialist trying to use orchestration tools

### Progress Not Updating

- Todos are monitored from ~/.claude/todos/
- Each project has separate todo file
- Updates every 5 seconds

## Advanced Features

### Parallel Execution (Managers)

```javascript
await executeParallel([
    { role: 'specialist', context: 'Task 1...' },
    { role: 'specialist', context: 'Task 2...' },
    { role: 'specialist', context: 'Task 3...' }
]);
```

### Knowledge Sharing

```javascript
// Record discovery
await projectState.recordKnowledge('api.endpoint', 'https://...');

// Query knowledge
const apiInfo = await projectState.getKnowledge('api');
```

### Dependency Management

```javascript
// Executive coordinating dependencies
await coordinateDependency(
    'UI Manager',
    'API Manager',
    'Wait for API endpoints to be defined'
);
```

## Example Workflow

1. **User Request**: "Build a task management app"

2. **Executive Actions**:
   ```
   - Create PROJECT_PLAN.md
   - Spawn Backend Manager
   - Spawn Frontend Manager
   - Monitor progress
   ```

3. **Manager Actions**:
   ```
   - Plan specialist tasks
   - Check file conflicts
   - Spawn specialists
   - Monitor and merge
   ```

4. **Specialist Actions**:
   ```
   - Create feature branch
   - Implement assigned task
   - Test changes
   - Mark todos complete
   ```

## Tips for Success

1. **Always verify understanding** - Use confirmation pattern
2. **Plan before executing** - Create plans/todos first
3. **Monitor regularly** - Check progress frequently
4. **Handle conflicts early** - Detect file conflicts before spawning
5. **Document blockers** - Use todos for communication
6. **Use atomic commits** - Small, focused changes
7. **Test before marking complete** - Ensure quality

The orchestration system is designed to enable reliable, scalable AI collaboration. Following these patterns ensures smooth project execution!