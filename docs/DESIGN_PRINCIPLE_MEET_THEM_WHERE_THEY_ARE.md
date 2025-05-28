# Design Principle: "Meet Them Where They Are"

## Core Philosophy

When spawning Claude instances, we must step into THEIR world and provide everything they need to start working immediately. No assumptions, no context searching, no guesswork.

## The Problem We're Solving

❌ **Old Way**: Generic instructions that assume context
```
"Use the MCP bridge to spawn managers"
"Read the requirements file"  
"Navigate to the project directory"
```

✅ **New Way**: Context-aware, actionable instructions
```
"From your current directory (/path/to/exec_123), run: node ../scripts/mcp_bridge.js spawn {...}"
"Read requirements with: Read('../tests/requirements.md')"
"You are already in: /Users/Mike/project/exec_123"
```

## Implementation Checklist

### 1. Orientation Information
Every instance needs to know:
- [ ] Their exact working directory path
- [ ] Their instance ID
- [ ] Their parent's ID (if applicable)
- [ ] Where key resources are located relative to them

### 2. Copy-Paste Commands
Every command should be:
- [ ] Executable from their current location
- [ ] Include full relative paths
- [ ] Have placeholders clearly marked
- [ ] Include examples of replaced values

### 3. First Actions
Always provide:
- [ ] A "quick start" section with 2-3 immediate commands
- [ ] The most likely first action pre-formatted
- [ ] Verification commands to check their setup

## Examples in Practice

### Executive Spawning
```javascript
// Instead of:
context = "You are an executive. Spawn managers for the project."

// Do this:
const execId = 'exec_' + Date.now();
const workDir = `/path/to/project/${execId}`;
context = `
You are executive ${execId}

YOUR LOCATION: ${workDir}

FIRST COMMANDS:
1. pwd                                    # Verify you're in ${workDir}
2. ls -la                                # See your files
3. node ../scripts/mcp_bridge.js list {} # Check active instances

TO SPAWN A MANAGER:
node ../scripts/mcp_bridge.js spawn '{
  "role": "manager",
  "workDir": "${workDir}",
  "context": "[REPLACE WITH MANAGER TASK]",
  "parentId": "${execId}"
}'
`;
```

### Manager Instructions
```javascript
// Instead of:
"Implement the frontend components"

// Do this:
`Implement frontend components in ${workDir}

FILES TO CREATE:
- ${workDir}/index.html
- ${workDir}/styles.css
- ${workDir}/script.js

START WITH:
Write("index.html", """
<!DOCTYPE html>
<html>
...
</html>
""")
`
```

## Anti-Patterns to Avoid

### 1. Assuming Directory Navigation
❌ `cd ../.. && node scripts/mcp_bridge.js`
✅ `node ../scripts/mcp_bridge.js`

### 2. Generic File Paths
❌ "Read the design system file"
✅ `Read("DESIGN_SYSTEM.md")` or `Read("../DESIGN_SYSTEM.md")`

### 3. Unclear Placeholders
❌ `"instanceId": "manager_id"`
✅ `"instanceId": "[MANAGER_ID]" // e.g., mgr_exec123_456789`

### 4. Missing Context
❌ "Spawn specialists as needed"
✅ "To spawn a specialist from your location, use: [exact command]"

## Integration Points

### 1. Context Builders
- `executive_context_builder.js` - Builds exec contexts with paths
- `claude_md_builder.js` - Generates location-aware CLAUDE.md files

### 2. Role Templates  
- Update templates to include quick-start commands
- Add location awareness blocks
- Provide copy-paste ready examples

### 3. Spawn Scripts
- Pass working directory to context builders
- Include instance ID in context
- Provide initial orientation commands

## Validation Questions

Before deploying any instance context, ask:
1. If I knew nothing except what's in this context, could I start working?
2. Is every command copy-paste ready?
3. Are all paths relative to where I'll actually be?
4. Do I need to figure out anything, or is it all provided?

## Benefits

1. **Faster Onboarding**: Instances start working immediately
2. **Fewer Errors**: No wrong paths or missing context
3. **Better Autonomy**: Instances don't need to ask for clarification
4. **Easier Debugging**: Clear about what instance knows

## Remember

We are building a GPS, not a compass. Every instruction should be turn-by-turn, not "head northwest."

**The Golden Rule**: If an instance has to deduce, search, or guess, we've failed to meet them where they are.