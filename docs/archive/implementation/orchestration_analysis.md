# Orchestration Design Analysis & Improvement Plan

## Current State Analysis

### 1. Role Communication Flow

```
Executive
    │
    ├─→ Manager 1
    │      ├─→ Specialist 1.1
    │      ├─→ Specialist 1.2
    │      └─→ Specialist 1.3
    │
    └─→ Manager 2
           ├─→ Specialist 2.1
           └─→ Specialist 2.2
```

### 2. Current Design Strengths ✅

1. **Clear role separation**: Each role has well-defined responsibilities
2. **Git branch isolation**: Specialists work on isolated branches preventing conflicts
3. **Tool access control**: Specialists can't spawn instances, preventing runaway orchestration
4. **State persistence**: Redis provides distributed state management
5. **Progress tracking**: Todo monitoring gives free visibility into work progress

### 3. Critical Issues Discovered 🚨

#### A. Communication Bottlenecks

**Problem**: Polling-based message passing with no queuing
```javascript
// Current problematic pattern:
await send({ targetInstanceId, message }); // Fire and forget
// ... time passes ...
const response = await read({ instanceId }); // May miss messages!
```

**Real Example**: In the Desktop UI project, the Executive tried to spawn Managers but couldn't verify success because it didn't know how to poll for responses.

#### B. Context Loss Between Layers

**Problem**: Each spawn creates isolated context with no shared knowledge
```javascript
// Current context passing:
spawn({
    role: 'manager',
    context: 'You are a UI Manager...' // Static, one-way context
});
```

**Real Example**: When the Executive completed the UI implementation, future Managers wouldn't know what was already built.

#### C. Work Overlap & Conflicts

**Problem**: No coordination mechanism between parallel workers
- Manager spawns multiple Specialists without checking for task dependencies
- No way to prevent duplicate work on same files
- Branch merging strategy unclear

#### D. State Synchronization Issues

**Problem**: Distributed state without proper synchronization
- Redis updates not immediately visible to all instances
- Todo files can have race conditions
- No global view of system state

### 4. Concrete Problems from Desktop UI Implementation

1. **Executive couldn't spawn Managers**: Tried using 'mcp' as bash command instead of MCP tools
2. **No progress visibility**: Executive completed work but no way to communicate completion
3. **Context isolation**: Each instance starts fresh without knowledge of prior work
4. **Missing orchestration feedback**: No confirmation when spawn operations succeed/fail
5. **CRITICAL: Executive implemented instead of delegating**: Executive wrote code directly instead of spawning Managers
6. **Role confusion**: Executives and Managers don't understand delegation is mandatory

## Proposed Solutions

### Solution 1: Event-Driven Message Bus

Replace polling with event-driven architecture:

```javascript
// New event-driven pattern:
class MessageBus {
    async publish(topic, message) {
        // Redis Pub/Sub or similar
        await redis.publish(`tmux-claude:${topic}`, JSON.stringify({
            from: this.instanceId,
            timestamp: Date.now(),
            message
        }));
    }
    
    async subscribe(topic, callback) {
        // Real-time message delivery
        redis.subscribe(`tmux-claude:${topic}`, callback);
    }
}
```

### Solution 2: Shared Knowledge Store

Create a centralized knowledge repository:

```javascript
// Shared context accessible by all instances
class KnowledgeStore {
    async recordDiscovery(key, value, instanceId) {
        await redis.hset('knowledge', key, JSON.stringify({
            value,
            discoveredBy: instanceId,
            timestamp: Date.now()
        }));
    }
    
    async getKnowledge(pattern) {
        // Allow instances to query shared learnings
        return await redis.hgetall('knowledge');
    }
}
```

### Solution 3: Work Coordination Service

Prevent overlap and manage dependencies:

```javascript
class WorkCoordinator {
    async claimTask(taskId, instanceId) {
        // Atomic operation to prevent duplicate work
        const claimed = await redis.set(
            `task:${taskId}:owner`,
            instanceId,
            'NX', // Only set if not exists
            'EX', 3600 // Expire after 1 hour
        );
        return claimed === 'OK';
    }
    
    async declareFileDependency(instanceId, filePath) {
        // Track which instance is modifying which files
        await redis.sadd(`file:${filePath}:workers`, instanceId);
    }
}
```

### Solution 4: Enhanced Prompts for Each Role

#### Executive Prompt Enhancement
```
You are an Executive orchestrating a complex project. 

CRITICAL ORCHESTRATION RULES:
1. Before spawning Managers, check existing work via getProgress
2. Always wait for spawn confirmation using the returned instanceId
3. Use send + read pattern to verify Manager understanding
4. Document discovered project structure in shared knowledge
5. Create a project roadmap BEFORE spawning any Managers

COMMUNICATION PATTERN:
const { instanceId } = await spawn({...});
await send({ targetInstanceId: instanceId, message: "Report when ready" });
// Wait 2-3 seconds
const response = await read({ instanceId });
```

#### Manager Prompt Enhancement
```
You are a Manager coordinating Specialists.

CRITICAL COORDINATION RULES:
1. Query shared knowledge before assigning tasks
2. Check file dependencies before parallel execution
3. Create task dependency graph before spawning
4. Monitor Specialist progress every 30 seconds
5. Merge branches in dependency order

SPECIALIST COORDINATION:
- Maximum 3-5 Specialists active simultaneously
- Assign non-overlapping file sets to each
- Use executeParallel for independent tasks only
```

#### Specialist Prompt Enhancement
```
You are a Specialist working on a specific task.

CRITICAL WORK RULES:
1. Record all discoveries in commit messages
2. Work ONLY on assigned files
3. Create atomic, focused commits
4. Test changes before marking complete
5. Document any blockers or dependencies

GIT WORKFLOW:
- You are on branch: specialist-{instanceId}-{taskId}-{feature}
- Commit frequently with descriptive messages
- Your work will be merged by your Manager
```

### Solution 5: Orchestration Monitoring Dashboard

Create real-time visibility into the system:

```javascript
// Enhanced dashboard showing:
- Instance hierarchy visualization
- Message flow diagram
- File modification conflicts
- Task completion progress
- System resource usage
- Failed instance recovery options
```

## Implementation Roadmap

### Phase 1: Message Bus (1 week)
- Implement Redis Pub/Sub for real-time messaging
- Add message persistence and replay
- Create subscription management

### Phase 2: Knowledge Store (1 week)
- Design knowledge schema
- Implement storage and retrieval APIs
- Add knowledge querying to MCP tools

### Phase 3: Work Coordinator (2 weeks)
- Task claiming mechanism
- File dependency tracking
- Conflict detection and resolution
- Work redistribution on failure

### Phase 4: Enhanced Prompts (1 week)
- Update role definitions with new patterns
- Add orchestration examples
- Include error handling guidance

### Phase 5: Monitoring & Recovery (2 weeks)
- Real-time monitoring dashboard
- Automatic failure detection
- Work redistribution system
- Audit trail implementation

## Success Metrics

1. **Message Delivery Rate**: >99.9% of messages successfully delivered
2. **Work Overlap**: <5% of tasks have file conflicts
3. **Recovery Time**: <30 seconds to detect and redistribute failed work
4. **Context Sharing**: >80% of discoveries accessible across instances
5. **Orchestration Efficiency**: 50% reduction in redundant work

## Next Steps

1. Create proof-of-concept for event-driven messaging
2. Design knowledge store schema
3. Test work coordination with sample project
4. Update Executive role to use new patterns
5. Build monitoring dashboard MVP