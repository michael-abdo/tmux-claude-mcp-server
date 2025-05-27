# MCP Tool Invocation Fix

## Problem Analysis

From our empirical testing, we've discovered:

1. **MCP Configuration is Correct**
   - Global ~/.claude/settings.json has tmux-claude server
   - Instance settings.json has proper MCP configuration
   - ALLOWED_TOOLS includes spawn, send, read, list, terminate

2. **Executive Behavior**
   - Executive knows it should have MCP tools
   - It's looking for them but can't find them as functions
   - It's trying to use Bash as a workaround

3. **Breakthrough Commit Evidence**
   - The working commit mentioned: "Executive successfully used tmux-claude:list MCP tool"
   - This suggests the syntax is `toolServerName:toolName`
   - MCP servers must be "registered" not just configured

## Solution Hypothesis

Based on the evidence, MCP tools are likely invoked using one of these patterns:

### Pattern 1: Namespace Syntax
```javascript
tmux-claude:spawn({ role: 'manager', workDir: '...', context: '...' })
tmux-claude:list()
tmux-claude:send({ instanceId: '...', text: '...' })
```

### Pattern 2: Tool Wrapper Syntax
```javascript
Tool('tmux-claude:spawn', { role: 'manager', ... })
Tool('tmux-claude:list')
```

### Pattern 3: Direct Tool Access (if registered)
```javascript
spawn({ role: 'manager', ... })
list()
```

## Implementation Strategy

### Step 1: Update Executive Instructions
Modify CLAUDE.md to include explicit MCP tool invocation examples:

```markdown
## How to Use MCP Tools

The MCP tools are available through the tmux-claude server. Use them like this:

- List instances: `tmux-claude:list()`
- Spawn manager: `tmux-claude:spawn({ role: 'manager', workDir: '.', context: '...' })`
- Send message: `tmux-claude:send({ instanceId: 'mgr_123', text: '...' })`
- Read output: `tmux-claude:read({ instanceId: 'mgr_123' })`
- Terminate: `tmux-claude:terminate({ instanceId: 'mgr_123' })`
```

### Step 2: Test Different Invocation Methods
Create a test executive that tries all possible invocation patterns and reports which work.

### Step 3: MCP Registration Investigation
The breakthrough commit mentioned "claude mcp add" command. We need to:
1. Check if this command exists in current Claude CLI
2. Understand what registration does differently than config files
3. Find where registrations are stored

## Immediate Workaround

Since the executive can use Bash, we could create a wrapper script:

```bash
#!/bin/bash
# mcp-spawn.sh - Wrapper for MCP spawn tool

if [ "$1" == "spawn" ]; then
    # Call the MCP server's spawn endpoint directly
    node -e "
    import { MCPTools } from './src/mcp_tools.js';
    const tools = new MCPTools();
    tools.spawn($2).then(console.log).catch(console.error);
    "
fi
```

But this defeats the purpose of the MCP architecture.

## Root Cause

The issue appears to be that:
1. MCP servers in settings.json are loaded but not "activated" as callable tools
2. Claude needs an additional registration step to make tools callable
3. The registration binds the server's tools to the Claude function namespace

## Next Steps

1. **Research MCP Registration**
   - Find documentation on "claude mcp add"
   - Check Claude CLI help for MCP commands
   - Look for MCP registration files

2. **Test Tool Invocation Syntax**
   - Try `tmux-claude:spawn` syntax
   - Try with Tool() wrapper if it exists
   - Monitor Claude's error messages for hints

3. **Create Registration Script**
   - Automate whatever "claude mcp add" does
   - Ensure it runs before spawning instances
   - Add to instance initialization flow