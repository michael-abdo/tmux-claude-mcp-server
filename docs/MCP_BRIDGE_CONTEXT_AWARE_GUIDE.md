# MCP Bridge Context-Aware Usage Guide

## Core Principle: "Meet Them Where They Are"

Every instance should receive instructions that are **immediately actionable from their exact context**, with zero assumptions about what they know or can figure out.

## Quick Start Template for Any Instance

```bash
# FIRST: Always check your location
pwd

# SECOND: Verify MCP bridge location (usually ../scripts/mcp_bridge.js)
ls ../scripts/mcp_bridge.js

# THIRD: Test the bridge
node ../scripts/mcp_bridge.js list '{}'
```

## Context-Aware Command Templates

### For Executives (in `/project/exec_XXXXX/`)

```bash
# Your bridge path
BRIDGE="../scripts/mcp_bridge.js"

# List instances (COPY THIS EXACTLY)
node $BRIDGE list '{}'

# Spawn Manager (COPY, MODIFY PLACEHOLDERS, RUN)
node $BRIDGE spawn '{
  "role": "manager",
  "workDir": "'$(pwd)'",
  "context": "[DESCRIBE MANAGER TASKS HERE]",
  "parentId": "[YOUR_EXEC_ID]"
}'

# Send message (COPY, MODIFY PLACEHOLDERS, RUN)
node $BRIDGE send '{
  "instanceId": "[TARGET_MANAGER_ID]",
  "text": "[YOUR MESSAGE HERE]"
}'
```

### For Managers (in `/project/mgr_XXXXX/`)

```bash
# Your bridge path
BRIDGE="../scripts/mcp_bridge.js"

# Spawn Specialist (COPY, MODIFY PLACEHOLDERS, RUN)
node $BRIDGE spawn '{
  "role": "specialist",
  "workDir": "'$(pwd)'",
  "context": "[SPECIFIC IMPLEMENTATION TASK]",
  "parentId": "[YOUR_MGR_ID]"
}'

# Monitor Specialist (COPY, MODIFY PLACEHOLDERS, RUN)
node $BRIDGE read '{
  "instanceId": "[SPECIALIST_ID]",
  "lines": 50
}'
```

## The Context-Aware Pattern

### 1. Location Block (Tell them where they are)
```
Your current directory: /Users/Mike/project/exec_123456
Bridge location: ../scripts/mcp_bridge.js
Your instance ID: exec_123456
```

### 2. Action Templates (Give them exact commands)
```bash
# Not this:
"Use the MCP bridge to spawn a manager"

# But this:
node ../scripts/mcp_bridge.js spawn '{"role":"manager","workDir":"'$(pwd)'","context":"...","parentId":"exec_123456"}'
```

### 3. Placeholder Guidance (Make substitution obvious)
```
Replace these placeholders:
- [YOUR_EXEC_ID] → Your actual ID (e.g., exec_123456)
- [MANAGER_TASKS] → Specific tasks for the manager
- [TARGET_DIR] → Run 'pwd' to get your current directory
```

## Common Patterns

### Pattern: Executive First Commands
```bash
# Executive's first actions after spawning
pwd                                          # Know where you are
ls -la                                       # See your files
node ../scripts/mcp_bridge.js list '{}'     # Check active instances
cat ../tests/requirements.md                 # Read project requirements
```

### Pattern: Manager First Commands
```bash
# Manager's first actions after spawning
pwd                                          # Know where you are
ls -la                                       # See available files
cat DESIGN_SYSTEM.md                         # Read design requirements
node ../scripts/mcp_bridge.js list '{}'     # See active instances
```

### Pattern: Spawning with Current Directory
```bash
# Always use $(pwd) to insert current directory
node ../scripts/mcp_bridge.js spawn '{
  "role": "manager",
  "workDir": "'$(pwd)'",  # This inserts your actual path
  "context": "...",
  "parentId": "..."
}'
```

## Error Prevention

### ❌ DON'T: Assume Directory Structure
```bash
# Bad: Assumes specific nesting
cd ../.. && node scripts/mcp_bridge.js list '{}'
```

### ✅ DO: Use Relative Paths from Current Location
```bash
# Good: Works from instance's actual location
node ../scripts/mcp_bridge.js list '{}'
```

### ❌ DON'T: Use Generic Placeholders
```bash
# Bad: Unclear what to replace
"workDir": "/full/path/to/workdir"
```

### ✅ DO: Provide Concrete Examples
```bash
# Good: Shows exactly how to get the value
"workDir": "'$(pwd)'",  # This will insert your current directory
```

## Implementation in Context Builders

When building contexts programmatically:

```javascript
// Include location awareness
const context = `
## 🗺️ YOUR CURRENT LOCATION
- Working directory: ${instanceWorkDir}
- MCP Bridge path: ../scripts/mcp_bridge.js
- Your instance ID: ${instanceId}

## 📋 COPY-PASTE COMMANDS
node ../scripts/mcp_bridge.js list '{}'
`;
```

## Testing Context-Awareness

Before spawning an instance, verify:
1. ✅ Does the context include the instance's working directory?
2. ✅ Are all commands copy-paste ready?
3. ✅ Are placeholders clearly marked with replacement instructions?
4. ✅ Is the first suggested command something that will work immediately?

## Summary

The goal is to eliminate all guesswork. Every instance should be able to:
1. Copy a command from their instructions
2. Replace clearly marked placeholders
3. Execute successfully on first try

No navigation, no searching, no deduction required. Just copy, paste, and run.