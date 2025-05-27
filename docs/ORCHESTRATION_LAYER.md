# MCP Bridge Orchestration Layer

## Overview

The MCP Bridge (`scripts/mcp_bridge.js`) is the **core orchestration layer** for managing Claude instances in the tmux-claude-mcp-server system. It provides a robust, centralized interface for inter-instance communication and control.

## Why the Bridge Architecture?

Due to stdio communication limitations, only the primary Claude instance has native MCP access. The bridge solves this architectural challenge by providing:

- **Centralized Control**: Single point of orchestration for all instances
- **Error Handling**: Robust error recovery and validation
- **Scalability**: Supports hierarchical instance management
- **Consistency**: Standardized interface for all orchestration operations

## Architecture Benefits

The bridge architecture is not a limitation but a **superior design choice**:

1. **Separation of Concerns**: Clean separation between instance logic and orchestration
2. **Debugging**: Easier to trace and debug inter-instance communication
3. **Flexibility**: Can evolve the orchestration layer without modifying instance code
4. **Security**: Controlled access to system operations

## Bridge Commands

### List Active Instances
View all currently running Claude instances:
```bash
cd ../.. && node scripts/mcp_bridge.js list '{}'
```

**Returns**: JSON array of active instances with their metadata

### Spawn New Instance
Create a new Claude instance with specific role and context:
```bash
cd ../.. && node scripts/mcp_bridge.js spawn '{
  "role": "manager",
  "workDir": "/path/to/workdir", 
  "context": "Instance instructions here",
  "parentId": "parent_instance_id"
}'
```

**Parameters**:
- `role`: Instance type (executive, manager, specialist)
- `workDir`: Working directory for the instance
- `context`: Instructions and context for the instance
- `parentId`: ID of the parent instance

### Send Message to Instance
Communicate with a specific instance:
```bash
cd ../.. && node scripts/mcp_bridge.js send '{
  "instanceId": "target_id",
  "text": "Your message here"
}'
```

**Parameters**:
- `instanceId`: Target instance ID
- `text`: Message to send

### Read Instance Output
Retrieve recent output from an instance:
```bash
cd ../.. && node scripts/mcp_bridge.js read '{
  "instanceId": "target_id",
  "lines": 50
}'
```

**Parameters**:
- `instanceId`: Target instance ID
- `lines`: Number of recent lines to read (default: 50)

### Terminate Instance
Gracefully shut down an instance:
```bash
cd ../.. && node scripts/mcp_bridge.js terminate '{
  "instanceId": "target_id"
}'
```

**Parameters**:
- `instanceId`: Instance to terminate

## Usage Patterns

### Executive Pattern
Executives use the bridge to manage their manager hierarchy:
```javascript
// Spawn a manager
const result = await Bash(`cd ../.. && node scripts/mcp_bridge.js spawn '${JSON.stringify({
  role: "manager",
  workDir: process.cwd(),
  context: managerInstructions,
  parentId: executiveId
})}'`);

const { instanceId } = JSON.parse(result);
```

### Manager Pattern
Managers coordinate specialist work through the bridge:
```javascript
// Check specialist progress
const output = await Bash(`cd ../.. && node scripts/mcp_bridge.js read '${JSON.stringify({
  instanceId: specialistId,
  lines: 30
})}'`);
```

### Error Handling
All bridge operations return structured responses:
```javascript
{
  "success": true|false,
  "data": { ... },
  "error": "Error message if applicable"
}
```

## Best Practices

1. **Always Parse Responses**: Bridge returns JSON for easy parsing
2. **Handle Errors**: Check the `success` field before using data
3. **Use Proper Escaping**: JSON stringify parameters properly
4. **Monitor Instance State**: Regularly check instance health
5. **Clean Up**: Always terminate instances when complete

## Troubleshooting

### Common Issues

**Instance Not Responding**
- Check if the instance is still active with `list`
- Verify the instanceId is correct
- Read recent output to diagnose issues

**Spawn Failures**
- Ensure workDir exists and is accessible
- Check that parentId is valid
- Verify role is one of: executive, manager, specialist

**Message Not Received**
- Confirm instance is active
- Check for special characters in message
- Verify JSON escaping is correct

### Debug Commands

View all instances and their state:
```bash
cd ../.. && node scripts/mcp_bridge.js list '{}' | jq '.'
```

Check specific instance health:
```bash
cd ../.. && node scripts/mcp_bridge.js read '{"instanceId":"exec_1","lines":10}'
```

## Integration with MCP Server

The bridge integrates seamlessly with the MCP server infrastructure:

1. **Primary Instance**: Has native MCP tools access
2. **Bridge Layer**: Provides orchestration for all instances
3. **Instance Registry**: Maintains state in `state/instances.json`
4. **tmux Backend**: Manages actual terminal sessions

## Quick Reference Card

| Command | Purpose | Key Parameters |
|---------|---------|----------------|
| `list` | View all instances | None |
| `spawn` | Create new instance | role, workDir, context, parentId |
| `send` | Send message | instanceId, text |
| `read` | Get output | instanceId, lines |
| `terminate` | Stop instance | instanceId |

## Architectural Principles

- The bridge is **THE** standard for orchestration, not a workaround
- All inter-instance communication flows through the bridge
- Specialists never have direct orchestration access
- The bridge provides centralized control and monitoring
- Bridge operations are atomic and return structured data

## Future Evolution

The bridge architecture allows for future enhancements:

- Performance monitoring and metrics
- Advanced routing and load balancing
- Plugin architecture for custom commands
- WebSocket support for real-time communication
- Distributed instance management

Remember: The MCP Bridge is the **architectural foundation** of the orchestration system, providing clean, reliable, and scalable instance management.