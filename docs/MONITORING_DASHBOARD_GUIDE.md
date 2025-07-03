# Monitoring Dashboard Guide

## Overview

The tmux-claude-mcp-server includes a comprehensive web-based monitoring dashboard for real-time system observation and control. The dashboard provides visibility into instance status, performance metrics, alerts, and optimization recommendations.

## Features

### Real-Time Monitoring
- **Live Instance Tracking**: See all active Claude instances with roles, status, and working directories
- **Performance Metrics**: Monitor spawn rates, message throughput, cache efficiency
- **Alert System**: Real-time alerts for performance issues and system problems
- **Git Operation Tracking**: View git operations and their performance
- **Resource Pools**: Monitor instance and worktree pool availability

### Performance Analysis
- **Performance Score**: 0-100 score indicating overall system health
- **Optimization Recommendations**: AI-powered suggestions for improving performance
- **Historical Metrics**: Track performance trends over time
- **Queue Monitoring**: See backlogs in spawn and git operation queues

### System Control
- **Instance Management**: Spawn and terminate instances from the dashboard
- **Settings Optimization**: Adjust performance settings in real-time
- **Alert Management**: Clear alerts and acknowledge issues
- **Batch Operations**: Trigger batch spawns and operations

## Getting Started

### Starting the Dashboard

```bash
# Start the monitoring dashboard
npm run dashboard

# Dashboard will be available at:
# http://localhost:3001
```

### Configuration

Environment variables:
```bash
# Dashboard port (default: 3001)
DASHBOARD_PORT=3001

# Enable debug logging
DEBUG=dashboard:*
```

## Dashboard Components

### 1. Performance Score
Central metric showing overall system health:
- **90-100**: Excellent (green) - System performing optimally
- **70-89**: Good (yellow-green) - Minor optimizations possible
- **50-69**: Fair (yellow) - Performance degradation detected
- **0-49**: Poor (red) - Immediate attention required

Score factors:
- Queue backlogs (spawn, git operations)
- Cache hit rate
- Instance count
- Redis connectivity

### 2. System Metrics
Key performance indicators:
- **Total Instances**: Number of active Claude instances
- **Active Spawns**: Currently spawning instances
- **Message Queue**: Pending messages for delivery
- **Cache Hit Rate**: Percentage of cached operations

### 3. Resource Pools
Available pre-warmed resources:
- **Instance Pool**: Pre-spawned instances ready for allocation
- **Worktree Pool**: Pre-created git worktrees
- **Redis Status**: Connection status to Redis server

### 4. Active Instances
List of all running instances showing:
- Instance ID (e.g., `spec_1_1_123456`)
- Role badge (Executive, Manager, Specialist)
- Working directory
- Status (active, idle, busy)
- Terminate button for cleanup

### 5. Alerts
Real-time system alerts:
- **Error** (red): Critical issues requiring immediate attention
- **Warning** (yellow): Performance degradation or potential issues
- **Info** (blue): Informational messages

Common alerts:
- Spawn queue backlog
- Git operation conflicts
- Low cache hit rate
- High instance count
- Redis disconnection

### 6. Git Operations
Recent git operations showing:
- Timestamp
- Total operations count
- Concurrent operations
- Average execution time

### 7. Optimization Recommendations
AI-powered suggestions based on current metrics:
- Priority level (high, medium, low)
- Specific optimization suggestion
- Expected impact

## WebSocket API

The dashboard uses WebSocket for real-time updates.

### Connection
```javascript
const ws = new WebSocket('ws://localhost:3001');
```

### Message Types

#### Subscribe to Updates
```json
{
  "type": "subscribe",
  "topics": ["instances", "performance", "alerts"]
}
```

#### Execute Commands
```json
{
  "type": "command",
  "command": "refresh",
  "params": {}
}
```

Available commands:
- `refresh`: Get full state update
- `clear-alerts`: Clear all alerts
- `get-logs`: Get instance logs (requires `instanceId` param)

### Event Types
- `initial`: Full state on connection
- `instances`: Instance list update
- `performance`: Performance metrics update
- `alerts`: Alert list update
- `alert`: Single new alert
- `git-operation`: New git operation
- `message`: Message batch event

## REST API Endpoints

### GET Endpoints

#### Get Full State
```
GET /api/state
```
Returns complete dashboard state including all metrics.

#### Get Instances
```
GET /api/instances
```
Returns active instance list.

#### Get Performance Report
```
GET /api/performance
```
Returns performance report with 5-minute summary.

#### Get Metrics
```
GET /api/metrics
```
Returns current performance metrics.

#### Get Recommendations
```
GET /api/recommendations
```
Returns optimization recommendations.

### POST Endpoints

#### Spawn Instance
```
POST /api/spawn
Content-Type: application/json

{
  "role": "specialist",
  "workDir": "/project",
  "context": "Feature development",
  "parentId": "mgr_1",
  "options": {
    "workspaceMode": "shared"
  }
}
```

#### Spawn Batch
```
POST /api/spawn-batch
Content-Type: application/json

{
  "instances": [
    {
      "role": "specialist",
      "workDir": "/project",
      "context": "Task 1"
    },
    // ... more instances
  ]
}
```

#### Send Message
```
POST /api/send-message
Content-Type: application/json

{
  "instanceId": "spec_1_1_123456",
  "message": "Please implement the login feature",
  "options": {
    "batch": true
  }
}
```

#### Optimize Settings
```
POST /api/optimize
Content-Type: application/json

{
  "settings": {
    "maxConcurrentSpawns": 10,
    "messageBatchSize": 20,
    "messageBatchDelay": 200
  }
}
```

### DELETE Endpoints

#### Terminate Instance
```
DELETE /api/instance/:id
```
Terminates specified instance.

## Performance Optimization Tips

### Using the Dashboard for Optimization

1. **Monitor Performance Score**
   - Keep score above 80 for optimal performance
   - Address alerts immediately when score drops

2. **Watch Queue Sizes**
   - Spawn queue > 10: Increase `maxConcurrentSpawns`
   - Git queue > 20: Increase `maxConcurrentGitOps`

3. **Optimize Cache Usage**
   - Cache hit rate < 50%: Review operation patterns
   - Increase cache TTL for frequently accessed data

4. **Manage Instance Count**
   - > 50 instances: Consider batch operations
   - Use instance pooling for faster spawning

5. **Follow Recommendations**
   - High priority: Implement immediately
   - Medium priority: Plan for implementation
   - Low priority: Consider during maintenance

## Troubleshooting

### Dashboard Not Loading
1. Check if server is running: `npm run dashboard`
2. Verify port availability: `lsof -i :3001`
3. Check browser console for errors
4. Ensure WebSocket connection is established

### No Real-Time Updates
1. Check WebSocket connection in browser dev tools
2. Verify no firewall/proxy blocking WebSocket
3. Look for connection errors in server logs

### Missing Metrics
1. Ensure instances are running
2. Check if monitoring is started
3. Verify Redis connection if using Redis

### Performance Issues
1. Reduce update frequency if needed
2. Limit number of displayed instances
3. Clear old alerts regularly

## Advanced Usage

### Custom Dashboards
Create custom views by subscribing to specific topics:
```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  topics: ['performance', 'alerts']  // Only get performance and alerts
}));
```

### Automated Monitoring
Use the REST API for automated monitoring:
```bash
# Check performance score
curl http://localhost:3001/api/performance | jq '.performance.score'

# Get recommendations
curl http://localhost:3001/api/recommendations | jq '.[].suggestion'
```

### Integration with CI/CD
Monitor deployments by checking metrics:
```javascript
const response = await fetch('http://localhost:3001/api/metrics');
const metrics = await response.json();

if (metrics.instances.total > 100) {
  console.warn('High instance count detected');
}
```

## Security Considerations

1. **Access Control**: Dashboard has no authentication by default
2. **Network Security**: Bind to localhost only in production
3. **CORS**: Configure CORS appropriately for your environment
4. **Rate Limiting**: Consider adding rate limits for API endpoints

## Conclusion

The monitoring dashboard provides essential visibility into tmux-claude-mcp-server operations. Use it to:
- Monitor system health in real-time
- Identify and resolve performance bottlenecks
- Optimize settings based on workload
- Maintain high availability for large teams

Regular monitoring and following optimization recommendations will ensure optimal performance for your Claude instance orchestration.