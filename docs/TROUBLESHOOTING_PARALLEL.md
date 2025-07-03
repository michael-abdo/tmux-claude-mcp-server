# Troubleshooting Guide for Parallel Execution Issues

## Common Issues and Solutions

### 1. Instance Creation Failures

#### Symptom
```
Error: Failed to create tmux session
Error: Claude instance failed to initialize
```

#### Causes & Solutions

**A. tmux not installed or not in PATH**
```bash
# Check tmux installation
which tmux
tmux -V

# Install if missing
# macOS
brew install tmux

# Ubuntu/Debian
sudo apt install tmux
```

**B. Claude CLI not installed**
```bash
# Check Claude CLI
which claude

# Install from Anthropic if missing
# Follow official installation guide
```

**C. Permission issues**
```bash
# Check directory permissions
ls -la /path/to/work/dir

# Fix permissions
chmod 755 /path/to/work/dir
```

### 2. Parallel Execution Not Working

#### Symptom
```
All tasks running sequentially despite Phase 3 configuration
Only one Specialist active at a time
```

#### Causes & Solutions

**A. Phase not set correctly**
```bash
# Check current phase
echo $PHASE

# Set to Phase 3
export PHASE=3

# Or start with Phase 3
PHASE=3 node src/simple_mcp_server.js
```

**B. Parallel executor not initialized**
```javascript
// Check logs for:
"Parallel executor initialized for Manager {id}"

// If missing, verify enhanced_mcp_tools.js is being used
```

**C. Manager concurrency limits**
```bash
# Check environment variables
echo $MAX_MANAGER_CONCURRENCY
echo $MAX_SPECIALISTS_PER_MANAGER

# Set appropriate limits
export MAX_MANAGER_CONCURRENCY=5
export MAX_SPECIALISTS_PER_MANAGER=4
```

### 3. Redis Connection Issues

#### Symptom
```
Redis unavailable, using JSON file fallback
Error: Connection refused
```

#### Causes & Solutions

**A. Redis not running**
```bash
# Check Redis status
redis-cli ping

# Start Redis
# macOS
brew services start redis

# Linux
sudo systemctl start redis

# Docker
docker start tmux-claude-redis
```

**B. Wrong connection URL**
```bash
# Check current URL
echo $REDIS_URL

# Set correct URL
export REDIS_URL="redis://localhost:6379"
# With password
export REDIS_URL="redis://:password@localhost:6379"
```

**C. Firewall blocking connection**
```bash
# Check if port is open
nc -zv localhost 6379

# Open port if needed
sudo ufw allow 6379
```

### 4. Instance Communication Failures

#### Symptom
```
Error: Instance not found
Failed to send message to instance
Cannot read from instance
```

#### Causes & Solutions

**A. Instance crashed or terminated**
```bash
# List tmux sessions
tmux list-sessions

# Check instance health
npm run dashboard
# Navigate to http://localhost:3000

# Restart crashed instance
const result = await instanceManager.restartInstance(instanceId);
```

**B. tmux session name mismatch**
```bash
# Check session naming
tmux list-sessions | grep claude

# Session names should follow pattern:
# claude_exec_123456
# claude_mgr_123456_789012
# claude_spec_123456_789012_345678
```

**C. Pane target incorrect**
```javascript
// Verify pane target format
console.log(instance.paneTarget); // Should be "session:window.pane"
// Example: "claude_exec_123456:0.0"
```

### 5. Job Queue Bottlenecks

#### Symptom
```
Jobs stuck in pending state
High memory usage
Slow task distribution
```

#### Causes & Solutions

**A. Too many pending jobs**
```javascript
// Check queue depth
const pendingCount = jobQueue.getPendingCount();
console.log(`Pending jobs: ${pendingCount}`);

// Implement backpressure
if (pendingCount > 1000) {
  // Pause job submission
  await new Promise(resolve => setTimeout(resolve, 5000));
}
```

**B. Manager overload**
```javascript
// Check Manager load
const managers = await instanceManager.listInstances('manager');
for (const manager of managers) {
  const load = await getManagerLoad(manager.instanceId);
  console.log(`${manager.instanceId}: ${load} active tasks`);
}

// Use auto-scaler
const autoScaler = new AutoScaler(instanceManager);
await autoScaler.startMonitoring();
```

### 6. Circuit Breaker Tripping

#### Symptom
```
Error: Circuit breaker OPEN for instance
Instance marked as unavailable
```

#### Causes & Solutions

**A. Too many failures**
```javascript
// Check circuit status
const status = circuitBreaker.getStatus(instanceId);
console.log(status);

// Reset circuit manually if needed
circuitBreaker.reset(instanceId);
```

**B. Adjust thresholds**
```javascript
// Create with custom thresholds
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 10,    // Allow more failures
  successThreshold: 3,     // Require more successes
  timeout: 120000,         // Longer timeout
  resetTimeout: 180000     // Longer reset period
});
```

### 7. Performance Issues

#### Symptom
```
Slow task execution
High latency between operations
Memory leaks
```

#### Causes & Solutions

**A. Too many concurrent operations**
```bash
# Monitor system resources
top
htop

# Reduce concurrency
export MAX_SPECIALISTS_PER_MANAGER=2
export MAX_MANAGER_CONCURRENCY=3
```

**B. Memory leaks**
```javascript
// Monitor memory usage
setInterval(() => {
  const usage = process.memoryUsage();
  console.log(`Memory: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`);
}, 60000);

// Force garbage collection if needed
if (global.gc) {
  global.gc();
}
```

**C. Inefficient task distribution**
```javascript
// Use appropriate distribution strategy
const result = await mcpTools.distributeWork({
  tasks,
  strategy: 'least-loaded'  // or 'round-robin', 'capacity-aware'
});
```

### 8. Debugging Tools

#### A. Enable Debug Logging
```bash
# Set debug environment
export DEBUG=tmux-claude:*
export NODE_ENV=development

# Run with verbose logging
node --trace-warnings src/simple_mcp_server.js
```

#### B. Monitor tmux Sessions
```bash
# Watch tmux sessions in real-time
watch -n 1 'tmux list-sessions'

# Attach to a session for debugging
tmux attach -t claude_exec_123456

# Capture pane content
tmux capture-pane -t "session:0.0" -p
```

#### C. Use Dashboard
```bash
# Start monitoring dashboard
npm run dashboard

# Access at http://localhost:3000
# Features:
# - Real-time instance status
# - Performance metrics
# - System logs
# - Manual controls
```

#### D. Redis Monitoring
```bash
# Monitor Redis commands
redis-cli monitor

# Check Redis stats
redis-cli --stat

# Inspect keys
redis-cli --scan --pattern 'tmux-claude:*'
```

### 9. Recovery Procedures

#### A. Complete System Reset
```bash
#!/bin/bash
# reset-system.sh

# 1. Kill all tmux sessions
tmux kill-server 2>/dev/null || true

# 2. Clear Redis state
redis-cli FLUSHDB

# 3. Remove JSON state files
rm -rf state/*.json
rm -rf test-state*

# 4. Restart services
npm run start:phase3
```

#### B. Partial Recovery
```javascript
// Recover specific Manager and its Specialists
async function recoverManager(managerId) {
  const manager = await instanceManager.getInstance(managerId);
  if (!manager) return;
  
  // Restart Manager
  await instanceManager.restartInstance(managerId);
  
  // Restart its Specialists
  for (const specId of manager.children) {
    await instanceManager.restartInstance(specId);
  }
}
```

### 10. Prevention Best Practices

1. **Regular Health Checks**
   ```javascript
   // Enable health monitoring
   const healthMonitor = new HealthMonitor(instanceManager);
   await healthMonitor.startMonitoring(30000); // Every 30s
   ```

2. **Graceful Degradation**
   ```javascript
   // Implement fallback strategies
   try {
     result = await parallelExecute(tasks);
   } catch (error) {
     console.warn('Falling back to sequential execution');
     result = await sequentialExecute(tasks);
   }
   ```

3. **Resource Limits**
   ```javascript
   // Set conservative limits initially
   const config = {
     maxInstances: 20,
     maxConcurrentTasks: 50,
     taskTimeout: 300000,  // 5 minutes
     memoryLimit: '2GB'
   };
   ```

4. **Monitoring and Alerts**
   ```javascript
   // Set up alerts for critical metrics
   if (metrics.failureRate > 0.1) {
     console.error('High failure rate detected!');
     // Send alert notification
   }
   ```

## Getting Help

1. **Check Logs**
   - Application logs: `logs/` directory
   - tmux logs: `tmux show-messages`
   - Redis logs: `redis-cli monitor`

2. **Enable Verbose Mode**
   ```bash
   export VERBOSE=true
   export LOG_LEVEL=debug
   ```

3. **Community Support**
   - GitHub Issues: Report bugs and issues
   - Documentation: Check `/docs` directory
   - Examples: Review test files for usage patterns

Remember: The system is designed to be resilient. Most issues can be resolved by:
1. Checking environment variables
2. Verifying service status (tmux, Redis)
3. Using the built-in recovery mechanisms
4. Monitoring dashboard for real-time insights