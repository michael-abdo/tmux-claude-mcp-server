# Phase 3: Full Parallel Execution

Phase 3 extends the tmux-claude MCP Server to support **full parallelism** with 10+ concurrent instances, distributed state management, and advanced orchestration capabilities.

## 🚀 Phase 3 Key Features

### 1. **Parallel Execution**
- Multiple Specialists working concurrently under each Manager
- Configurable concurrency limits per Manager
- Task queue management with automatic distribution
- Load balancing across available resources

### 2. **Distributed State Management**
- Redis-backed state store for concurrent access
- Fallback to JSON when Redis unavailable
- Distributed locking for race condition prevention
- Metrics collection and aggregation

### 3. **Enhanced Orchestration**
- Multiple Manager instances per Executive
- Work distribution strategies (round-robin, least-loaded, capacity-aware)
- Job queue with priority handling
- Automatic retry with exponential backoff

### 4. **Health Monitoring & Recovery**
- Continuous health checks on all instances
- Automatic restart of failed instances
- Stuck pattern detection
- Error pattern recognition

## 📁 New Components

### Core Modules

#### `parallel_executor.js`
Manages concurrent Specialist execution with:
- Task queue processing
- Concurrency limit enforcement  
- Progress monitoring
- Automatic retry on failure

#### `redis_state_store.js`
Provides distributed state management:
- Redis client with JSON fallback
- Atomic operations for concurrent access
- Distributed locking mechanism
- Metrics recording

#### `enhanced_mcp_tools.js`
Extends base MCP tools with:
- `executeParallel` - Run multiple tasks concurrently
- `distributeWork` - Distribute tasks across Managers
- `getParallelStatus` - Monitor parallel execution

#### `job_queue.js`
Priority-based job management:
- Job enqueueing with priorities (critical/high/medium/low)
- Automatic retry with backoff
- Job lifecycle tracking
- Statistics and reporting

#### `health_monitor.js`
Instance health monitoring:
- Periodic health checks
- Stuck/error pattern detection
- Automatic recovery attempts
- Health metrics collection

#### `phase3_manager.js`
Example Manager implementation showing:
- Parallel task coordination
- Progress reporting to Executive
- Error handling and recovery

## 🔧 Configuration

### Environment Variables

```bash
# Enable Phase 3
export PHASE=3

# Redis configuration (optional)
export REDIS_URL=redis://localhost:6379

# Concurrency limits
export MAX_MANAGER_CONCURRENCY=5
export MAX_SPECIALISTS_PER_MANAGER=3

# Health monitoring
export HEALTH_CHECK_INTERVAL=10000
export UNHEALTHY_THRESHOLD=3
```

### Starting the Server

```bash
# Phase 3 with Redis
PHASE=3 REDIS_URL=redis://localhost:6379 npm start

# Phase 3 with JSON fallback
PHASE=3 npm start
```

## 📊 Usage Examples

### Executive Spawning Multiple Managers

```javascript
// Executive creates 3 Managers for parallel work
const managers = [];
for (let i = 1; i <= 3; i++) {
    const manager = await mcp.spawn({
        role: "manager",
        workDir: "/jobs/big_project",
        context: `Manager ${i}: Handle parallel tasks`,
        parentId: "exec_1"
    });
    managers.push(manager);
}
```

### Manager Executing Tasks in Parallel

```javascript
// Manager runs 4 Specialists concurrently
const tasks = [
    { id: "db-setup", name: "Database Setup", context: "...", instruction: "..." },
    { id: "api-auth", name: "Auth API", context: "...", instruction: "..." },
    { id: "frontend", name: "Frontend", context: "...", instruction: "..." },
    { id: "tests", name: "Test Suite", context: "...", instruction: "..." }
];

const results = await mcp.executeParallel({
    managerId: "mgr_1_1",
    tasks: tasks,
    workDir: "/jobs/big_project"
});
```

### Executive Distributing Work

```javascript
// Distribute 20 tasks across available Managers
const distribution = await mcp.distributeWork({
    tasks: allTasks,
    strategy: "least-loaded"  // or "round-robin", "capacity-aware"
});
```

### Monitoring Parallel Execution

```javascript
// Get status of all instances with parallel execution info
const instances = await mcp.list({});

instances.forEach(inst => {
    if (inst.parallelExecution) {
        console.log(`${inst.instanceId}: ${inst.parallelExecution.active} active tasks`);
    }
});
```

## 🏗️ Architecture Comparison

### Phase 2 (Sequential)
```
Executive → Manager → Specialist (one at a time)
```

### Phase 3 (Parallel)
```
Executive → Manager 1 → Specialist 1.1 (concurrent)
                     → Specialist 1.2 (concurrent)
                     → Specialist 1.3 (concurrent)
         → Manager 2 → Specialist 2.1 (concurrent)
                     → Specialist 2.2 (concurrent)
         → Manager 3 → Specialist 3.1 (concurrent)
                     → Specialist 3.2 (concurrent)
```

## 🧪 Testing

### Run Phase 3 Tests
```bash
cd tmux-claude-mcp-server

# Unit tests
PHASE=3 node tests/phase3_integration_test.js

# Parallel execution demo
PHASE=3 node tests/phase3_parallel_demo.js
```

### Test Scenarios Covered
- Priority-based job queuing
- Work distribution strategies
- Concurrent execution limits
- Redis failover to JSON
- Distributed locking
- Health monitoring
- Auto-recovery

## 📈 Performance Benefits

### Execution Time Comparison
- **Phase 2**: 4 tasks × 5 min/task = 20 minutes (sequential)
- **Phase 3**: 4 tasks ÷ 3 parallel = ~7 minutes (3x faster)

### Scalability
- **Phase 2**: Limited by sequential execution
- **Phase 3**: Scales with available resources
  - 10+ concurrent Specialists
  - Multiple Managers per Executive
  - Distributed across machines (with Redis)

## 🔍 Monitoring & Debugging

### Health Status
```javascript
const healthMonitor = new HealthMonitor(mcp);
await healthMonitor.startMonitoring();

// Get health summary
const health = healthMonitor.getHealthSummary();
console.log(`Healthy: ${health.healthy}/${health.total}`);
```

### Metrics Collection
All operations record metrics for analysis:
- Task completion times
- Success/failure rates  
- Instance health scores
- Recovery attempts

## 🚦 Migration Guide

### From Phase 2 to Phase 3

1. **No Code Changes Required** - The MCP interface remains the same
2. **Set Environment Variable** - `export PHASE=3`
3. **Optional: Add Redis** - For true distributed execution
4. **Monitor Performance** - Use health monitoring and metrics

### Rollback to Phase 2
Simply unset or change the PHASE variable:
```bash
export PHASE=2  # or unset PHASE
```

## 🎯 Best Practices

1. **Start Conservative** - Begin with 2-3 Specialists per Manager
2. **Monitor Resources** - Watch CPU/memory usage
3. **Use Appropriate Strategy** - Choose work distribution based on task types
4. **Enable Health Monitoring** - Catch and recover from failures early
5. **Set Realistic Timeouts** - Account for parallel execution overhead

## 🔧 Troubleshooting

### Common Issues

**Issue**: Redis connection failures
- **Solution**: Server falls back to JSON automatically

**Issue**: Too many concurrent instances
- **Solution**: Adjust `MAX_SPECIALISTS_PER_MANAGER`

**Issue**: Specialists getting stuck
- **Solution**: Health monitor will detect and restart

**Issue**: Uneven work distribution
- **Solution**: Try different distribution strategies

## 🎉 Summary

Phase 3 transforms the tmux-claude system from sequential to parallel execution while maintaining the same simple MCP interface. The architecture scales automatically based on configuration, supports distributed execution with Redis, and includes robust health monitoring and recovery mechanisms.

The beauty of the design: **Phase 1 code works unchanged in Phase 3** - only the execution strategy differs!