# MCP Integration Solution

## Executive Summary

Through empirical testing, we've discovered that executives cannot access MCP tools as callable functions despite proper configuration. The issue persists even after registering the MCP server with `claude mcp add`.

## Key Findings

1. **MCP Server Registration**
   - `claude mcp add tmux-claude node src/simple_mcp_server.js` successfully registers the server
   - `claude mcp list` shows: `tmux-claude: node src/simple_mcp_server.js`
   - But executives still cannot access the tools as functions

2. **Configuration is Correct**
   - Global ~/.claude/settings.json has MCP server
   - Instance settings.json has proper configuration
   - ALLOWED_TOOLS includes all necessary tools
   - CLAUDE.md has proper instructions

3. **Executive Behavior**
   - Executives understand they should have MCP tools
   - They try to find them but report "not available through standard function interface"
   - They resort to using Bash as a workaround

4. **Breakthrough Commit Evidence**
   - Commit afead98 successfully enabled MCP tools
   - Executive "successfully used tmux-claude:list MCP tool"
   - 5 managers were spawned successfully

## Root Cause Analysis

The issue appears to be that MCP tools are not exposed as callable functions in the Claude interface. Based on the evidence:

1. MCP servers provide tools via a protocol, not direct function injection
2. The syntax might be `serverName:toolName` but Claude doesn't recognize it
3. There may be a missing initialization step or configuration

## Proposed Solutions

### Solution 1: Bridge Pattern (Recommended)
Create a bridge that executives can call via standard tools that internally uses MCP:

```javascript
// mcp_bridge.js - Executable via Bash
#!/usr/bin/env node

import { MCPTools } from './src/mcp_tools.js';
import { InstanceManager } from './src/instance_manager.js';

const command = process.argv[2];
const params = JSON.parse(process.argv[3] || '{}');

const manager = new InstanceManager();
const tools = new MCPTools(manager);

switch(command) {
    case 'spawn':
        const result = await tools.spawn(params);
        console.log(JSON.stringify(result));
        break;
    case 'list':
        const instances = await tools.list(params);
        console.log(JSON.stringify(instances));
        break;
    // ... other tools
}
```

Executives would use:
```bash
Bash("node mcp_bridge.js spawn '{\"role\":\"manager\",\"workDir\":\".\",\"context\":\"...\"}'")
```

### Solution 2: Custom Tool Registration
Research if Claude supports custom tool registration that would make MCP tools available as first-class functions.

### Solution 3: Protocol Investigation
Deep dive into how MCP tools are supposed to be invoked in Claude. The breakthrough commit suggests there's a way.

## Immediate Workaround

Since executives can use Bash and the MCP server works programmatically, create wrapper scripts:

```bash
# spawn_manager.sh
#!/bin/bash
node -e "
import { InstanceManager } from './src/instance_manager.js';
const m = new InstanceManager();
m.spawnInstance('manager', '$1', '$2', '$3').then(r => console.log(JSON.stringify(r)));
"
```

## Next Steps

1. **Implement Bridge Pattern**
   - Create mcp_bridge.js
   - Test with executive
   - Document usage

2. **Research MCP Protocol**
   - Find MCP specification
   - Understand tool invocation
   - Check Claude's MCP implementation

3. **Contact Support**
   - Ask Anthropic about MCP tool invocation
   - Report the integration issue
   - Get official guidance

## Conclusion

The delegation pattern works behaviorally - executives want to delegate and try to use MCP tools. The technical integration between Claude and MCP servers needs a bridge or proper protocol understanding to make the tools callable.