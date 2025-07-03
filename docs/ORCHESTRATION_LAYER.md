# The MCP Bridge Orchestration Layer

## Overview

The MCP Bridge is the **official orchestration interface** for the tmux-claude system. It provides a centralized, robust solution for managing Claude instances across the hierarchical architecture.

## Why the Bridge Exists

### The stdio Constraint

MCP (Model Control Protocol) servers communicate via stdin/stdout, creating a fundamental constraint:
- Only the primary Claude instance has direct MCP tool access
- Spawned instances (in tmux) are independent processes without stdio inheritance
- This is not a bug or limitation to work around - it's an architectural constraint

### The Bridge Solution

Rather than viewing this as a limitation, we've embraced it as an architectural advantage:
- **Centralized Control**: One MCP server manages all instances
- **Better Error Handling**: Consistent error patterns across all operations
- **Scalability**: No overhead from multiple MCP servers
- **Extensibility**: Easy to add features like queuing, retries, monitoring

## Architecture

```
┌─────────────────────────────────────────────────┐
│          Primary Claude Instance                 │
│         (Has Native MCP Access)                  │
│                                                  │
│  ┌─────────────────────────────────────────┐   │
│  │         MCP Server (stdio)               │   │
│  │  - spawn()  - list()   - send()         │   │
│  │  - read()   - terminate()               │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
                        │
                        ▼
        ┌──────────────────────────────┐
        │      MCP Bridge Layer        │
        │   (scripts/mcp_bridge.js)    │
        │                              │
        │  Translates Bash → MCP → JSON│
        └──────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
┌─────────────────┐            ┌─────────────────┐
│   Executive     │            │   Executive     │
│  (Uses Bridge)  │            │  (Uses Bridge)  │
│                 │            │                 │
│ Bash("node...")│            │ Bash("node...")│
└────────┬────────┘            └────────┬────────┘
         │                              │
    ┌────┴────┐                    ┌────┴────┐
    ▼         ▼                    ▼         ▼
┌────────┐ ┌────────┐          ┌────────┐ ┌────────┐
│Manager │ │Manager │          │Manager │ │Manager │
│(Bridge)│ │(Bridge)│          │(Bridge)│ │(Bridge)│
└───┬────┘ └───┬────┘          └───┬────┘ └───┬────┘
    │          │                    │          │
    ▼          ▼                    ▼          ▼
[Specialists] [Specialists]    [Specialists] [Specialists]
```

## Bridge Commands

### List Active Instances

```bash
Bash("cd ../.. && node scripts/mcp_bridge.js list '{}'")
```

**Response:**
```json
{
  "success": true,
  "instances": [
    {
      "instanceId": "exec_123",
      "role": "executive",
      "status": "active",
      "created": "2025-05-27T10:00:00Z"
    }
  ],
  "count": 1
}
```

### Spawn New Instance

```bash
Bash("cd ../.. && node scripts/mcp_bridge.js spawn '{
  \"role\": \"manager\",
  \"workDir\": \"/path/to/project\",
  \"context\": \"You are the Frontend Manager...\",
  \"parentId\": \"exec_123\"
}'")
```

**Response:**
```json
{
  "success": true,
  "instanceId": "mgr_123_456",
  "message": "Instance spawned successfully"
}
```

### Send Message

```bash
Bash("cd ../.. && node scripts/mcp_bridge.js send '{
  \"instanceId\": \"mgr_123_456\",
  \"text\": \"What is your progress?\"
}'")
```

**Response:**
```json
{
  "success": true,
  "message": "Message sent"
}
```

### Read Output

```bash
Bash("cd ../.. && node scripts/mcp_bridge.js read '{
  \"instanceId\": \"mgr_123_456\",
  \"lines\": 50
}'")
```

**Response:**
```json
{
  "success": true,
  "output": "Last 50 lines of instance output..."
}
```

### Terminate Instance

```bash
Bash("cd ../.. && node scripts/mcp_bridge.js terminate '{
  \"instanceId\": \"mgr_123_456\"
}'")
```

**Response:**
```json
{
  "success": true,
  "message": "Instance terminated"
}
```

## Usage Patterns

### Executive Pattern

```javascript
// 1. List existing instances
const listResult = JSON.parse(
  Bash("cd ../.. && node scripts/mcp_bridge.js list '{}'")
);

// 2. Spawn a Manager
const spawnResult = JSON.parse(
  Bash("cd ../.. && node scripts/mcp_bridge.js spawn '{...}'")
);
const managerId = spawnResult.instanceId;

// 3. Monitor Manager
const output = JSON.parse(
  Bash(`cd ../.. && node scripts/mcp_bridge.js read '{"instanceId":"${managerId}"}'`)
);

// 4. Coordinate work
Bash(`cd ../.. && node scripts/mcp_bridge.js send '{"instanceId":"${managerId}","text":"Start phase 2"}'`);
```

### Manager Pattern

```javascript
// 1. Spawn Specialists
const spec1 = JSON.parse(
  Bash("cd ../.. && node scripts/mcp_bridge.js spawn '{
    \"role\":\"specialist\",
    \"context\":\"Implement authentication\",
    \"parentId\":\"mgr_123\"
  }'")
);

// 2. Monitor multiple Specialists
const specialists = [spec1.instanceId, spec2.instanceId];
for (const id of specialists) {
  const progress = JSON.parse(
    Bash(`cd ../.. && node scripts/mcp_bridge.js read '{"instanceId":"${id}"}'`)
  );
  // Process progress...
}
```

## Error Handling

The bridge provides consistent error responses:

```json
{
  "success": false,
  "error": "Instance not found: mgr_999"
}
```

Always check the `success` field before processing results.

## Best Practices

### 1. Always Parse JSON Responses
```javascript
const result = JSON.parse(Bash("..."));
if (!result.success) {
  // Handle error
}
```

### 2. Track Instance IDs
Maintain a registry of spawned instances for coordination:
```javascript
const myManagers = {
  frontend: "mgr_123_456",
  backend: "mgr_123_789",
  testing: "mgr_123_012"
};
```

### 3. Use Descriptive Contexts
Include clear instructions and expected responses:
```javascript
const context = `You are the Testing Manager.
Tasks:
1. Create unit tests
2. Run integration tests
3. Generate coverage report

When ready, respond: "READY: Testing Manager"`;
```

### 4. Monitor Regularly
Set up periodic monitoring for long-running tasks:
```javascript
// Check every 30 seconds
const checkProgress = () => {
  const output = JSON.parse(
    Bash(`cd ../.. && node scripts/mcp_bridge.js read '{"instanceId":"${id}"}'`)
  );
  // Process output...
};
```

## Implementation Details

### File Structure
```
scripts/
├── mcp_bridge.js           # The bridge implementation
src/
├── mcp_tools.js           # MCP tool implementations
├── instance_manager.js     # Instance registry
├── orchestration/
│   ├── executive_context_builder.js  # Context templates
│   └── spawn_helpers.js              # Spawning utilities
```

### State Management
- Instance registry stored in `state/instances.json`
- Automatic cleanup of stale instances
- Persistent across primary Claude restarts

## Migration Guide

### Old Pattern (Direct MCP)
```javascript
// This only works in primary Claude
const result = await mcp__tmux-claude__spawn({...});
```

### New Pattern (Bridge)
```javascript
// This works in any Claude instance
const result = JSON.parse(
  Bash("cd ../.. && node scripts/mcp_bridge.js spawn '{...}'")
);
```

## Future Enhancements

### Planned Features
1. **Queueing**: Handle concurrent operations gracefully
2. **Retries**: Automatic retry with exponential backoff
3. **Monitoring Dashboard**: Real-time instance status
4. **WebSocket Support**: For real-time updates
5. **CLI Interface**: `tmux-claude spawn manager --context "..."`

### Extension Points
The bridge architecture allows for easy additions:
- Custom health checks
- Performance metrics
- Advanced routing
- Load balancing

## Conclusion

The MCP Bridge is not a workaround - it's the architectural foundation of tmux-claude orchestration. By embracing the stdio constraint and building a robust bridge layer, we've created a system that's more scalable, maintainable, and extensible than distributed MCP servers would have been.

Remember: **The Bridge IS the Architecture**.