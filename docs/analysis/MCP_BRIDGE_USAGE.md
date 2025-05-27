# MCP Bridge Orchestration Interface - Comprehensive Usage Guide

The MCP Bridge is the **official orchestration interface** for managing Claude instances. This guide provides comprehensive examples for executives and managers.

## Quick Reference

| Command | Purpose | Returns |
|---------|---------|---------|
| `list` | View all active instances | Array of instances |
| `spawn` | Create new instance | Instance ID |
| `send` | Send message to instance | Success status |
| `read` | Read instance output | Output text |
| `terminate` | Stop instance | Success status |

## Complete Examples

### 1. Starting Your Executive Session

```bash
# First, check what instances are already running
Bash("cd ../.. && node scripts/mcp_bridge.js list '{}'")

# Parse the response
# Returns: {"success":true,"instances":[...],"count":0}
```

### 2. Spawning Your First Manager

```bash
# Spawn a Frontend Manager with detailed context
Bash("cd ../.. && node scripts/mcp_bridge.js spawn '{
  \"role\": \"manager\",
  \"workDir\": \"/Users/Mike/project\",
  \"context\": \"You are the Frontend Manager. Tasks: 1) Build React UI, 2) Implement TypeScript components, 3) Create responsive design. Use the MCP Bridge to spawn specialists.\",
  \"parentId\": \"exec_123\"
}'")

# Returns: {"success":true,"instanceId":"mgr_123_456","message":"Instance spawned successfully"}
```

### 3. Complete Executive Workflow

```javascript
// Step 1: Check existing instances
const listResult = JSON.parse(
  Bash("cd ../.. && node scripts/mcp_bridge.js list '{}'")
);
console.log(`Found ${listResult.count} active instances`);

// Step 2: Spawn Frontend Manager
const frontendSpawn = JSON.parse(
  Bash("cd ../.. && node scripts/mcp_bridge.js spawn '{
    \"role\": \"manager\",
    \"workDir\": \"/Users/Mike/ecommerce-app\",
    \"context\": \"Frontend Manager for ecommerce app. Build: 1) Product catalog, 2) Shopping cart, 3) Checkout flow\",
    \"parentId\": \"exec_123\"
  }'")
);
const frontendId = frontendSpawn.instanceId;

// Step 3: Spawn Backend Manager
const backendSpawn = JSON.parse(
  Bash("cd ../.. && node scripts/mcp_bridge.js spawn '{
    \"role\": \"manager\",
    \"workDir\": \"/Users/Mike/ecommerce-app\",
    \"context\": \"Backend Manager for ecommerce app. Build: 1) REST API, 2) Database schema, 3) Authentication\",
    \"parentId\": \"exec_123\"
  }'")
);
const backendId = backendSpawn.instanceId;

// Step 4: Monitor both managers
const frontendOutput = JSON.parse(
  Bash(`cd ../.. && node scripts/mcp_bridge.js read '{\"instanceId\":\"${frontendId}\",\"lines\":30}'`)
);

const backendOutput = JSON.parse(
  Bash(`cd ../.. && node scripts/mcp_bridge.js read '{\"instanceId\":\"${backendId}\",\"lines\":30}'`)
);

// Step 5: Coordinate work
Bash(`cd ../.. && node scripts/mcp_bridge.js send '{
  \"instanceId\": \"${frontendId}\",
  \"text\": \"Backend API is ready at /api/v1. Please update your endpoints.\"
}'`);
```

### 4. Manager Spawning Specialists

```javascript
// As a Manager, spawn multiple specialists
const specialist1 = JSON.parse(
  Bash("cd ../.. && node scripts/mcp_bridge.js spawn '{
    \"role\": \"specialist\",
    \"workDir\": \"/Users/Mike/project\",
    \"context\": \"Implement user authentication with JWT tokens\",
    \"parentId\": \"mgr_123_456\"
  }'")
);

const specialist2 = JSON.parse(
  Bash("cd ../.. && node scripts/mcp_bridge.js spawn '{
    \"role\": \"specialist\",
    \"workDir\": \"/Users/Mike/project\",
    \"context\": \"Create product database schema and models\",
    \"parentId\": \"mgr_123_456\"
  }'")
);

// Monitor both specialists
const checkProgress = () => {
  const output1 = JSON.parse(
    Bash(`cd ../.. && node scripts/mcp_bridge.js read '{\"instanceId\":\"${specialist1.instanceId}\"}'`)
  );
  const output2 = JSON.parse(
    Bash(`cd ../.. && node scripts/mcp_bridge.js read '{\"instanceId\":\"${specialist2.instanceId}\"}'`)
  );
  
  console.log("Specialist 1:", output1.output.slice(-200));
  console.log("Specialist 2:", output2.output.slice(-200));
};
```

### 5. Error Handling

```javascript
// Always handle potential errors
try {
  const result = JSON.parse(
    Bash("cd ../.. && node scripts/mcp_bridge.js spawn '{...}'")
  );
  
  if (!result.success) {
    console.error(`Spawn failed: ${result.error}`);
    // Handle error - maybe retry or spawn different instance
  }
} catch (e) {
  console.error("Bridge command failed:", e);
}
```

### 6. Advanced Monitoring Pattern

```javascript
// Monitor multiple instances with status tracking
const instances = {
  frontend: "mgr_123_456",
  backend: "mgr_123_789",
  database: "mgr_123_012"
};

const checkAllProgress = () => {
  const status = {};
  
  for (const [name, id] of Object.entries(instances)) {
    try {
      const output = JSON.parse(
        Bash(`cd ../.. && node scripts/mcp_bridge.js read '{\"instanceId\":\"${id}\",\"lines\":10}'`)
      );
      
      // Check for completion markers
      if (output.output.includes("COMPLETED")) {
        status[name] = "completed";
      } else if (output.output.includes("ERROR")) {
        status[name] = "error";
      } else {
        status[name] = "in_progress";
      }
    } catch (e) {
      status[name] = "unreachable";
    }
  }
  
  return status;
};
```

### 7. Cleanup Pattern

```javascript
// Terminate instances when done
const cleanup = async () => {
  // List all instances
  const listResult = JSON.parse(
    Bash("cd ../.. && node scripts/mcp_bridge.js list '{}'")
  );
  
  // Filter instances owned by this executive
  const myInstances = listResult.instances.filter(
    inst => inst.parentId === "exec_123"
  );
  
  // Terminate each one
  for (const inst of myInstances) {
    Bash(`cd ../.. && node scripts/mcp_bridge.js terminate '{\"instanceId\":\"${inst.instanceId}\"}'`);
    console.log(`Terminated ${inst.instanceId}`);
  }
};
```

## Best Practices

### 1. Context Templates

```javascript
const createManagerContext = (role, tasks) => {
  return `You are the ${role} Manager.
  
Your tasks:
${tasks.map((t, i) => `${i+1}. ${t}`).join('\\n')}

Use the MCP Bridge to spawn specialists:
Bash("cd ../.. && node scripts/mcp_bridge.js spawn '{...}'")

Report "READY: ${role} Manager" when you understand.`;
};
```

### 2. Response Validation

```javascript
const spawnWithValidation = (params) => {
  const result = JSON.parse(
    Bash(`cd ../.. && node scripts/mcp_bridge.js spawn '${JSON.stringify(params)}'`)
  );
  
  if (!result.success || !result.instanceId) {
    throw new Error(`Invalid spawn response: ${JSON.stringify(result)}`);
  }
  
  return result.instanceId;
};
```

### 3. Batched Monitoring

```javascript
// Check multiple instances efficiently
const batchMonitor = (instanceIds) => {
  return instanceIds.map(id => {
    try {
      const output = JSON.parse(
        Bash(`cd ../.. && node scripts/mcp_bridge.js read '{\"instanceId\":\"${id}\",\"lines\":20}'`)
      );
      return { id, status: 'active', lastOutput: output.output };
    } catch (e) {
      return { id, status: 'error', error: e.message };
    }
  });
};
```

## Common Patterns

### Executive → Manager Communication
```bash
# Send specific instructions
Bash("cd ../.. && node scripts/mcp_bridge.js send '{
  \"instanceId\": \"mgr_123\",
  \"text\": \"Frontend is ready. Please integrate with backend API at port 3000.\"
}'")
```

### Manager → Specialist Delegation
```bash
# Delegate specific file to specialist
Bash("cd ../.. && node scripts/mcp_bridge.js spawn '{
  \"role\": \"specialist\",
  \"workDir\": \"/project\",
  \"context\": \"Implement src/components/UserAuth.tsx with login/logout functionality\",
  \"parentId\": \"mgr_123\"
}'")
```

### Progress Checking Loop
```javascript
// Check progress every 30 seconds
const monitorLoop = (instanceId) => {
  const interval = setInterval(() => {
    const output = JSON.parse(
      Bash(`cd ../.. && node scripts/mcp_bridge.js read '{\"instanceId\":\"${instanceId}\"}'`)
    );
    
    if (output.output.includes("TASK COMPLETE")) {
      clearInterval(interval);
      console.log("Task completed!");
    }
  }, 30000);
};
```

## Troubleshooting

### Instance Not Responding
```javascript
// Verify instance is active
const isActive = (instanceId) => {
  const list = JSON.parse(Bash("cd ../.. && node scripts/mcp_bridge.js list '{}'"));
  return list.instances.some(inst => inst.instanceId === instanceId);
};
```

### Bridge Command Fails
```bash
# Check if in correct directory
Bash("pwd")  # Should show instance directory

# Verify bridge exists
Bash("ls -la ../../scripts/mcp_bridge.js")

# Test with simple command
Bash("cd ../.. && node scripts/mcp_bridge.js list '{}'")
```

Remember: The MCP Bridge is the **official orchestration interface** - use it for all instance management!