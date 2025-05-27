# Workspace Modes

This document describes the workspace modes feature that enables proper collaboration between Manager instances while maintaining isolation for other workflows.

## Overview

The tmux-claude system supports two workspace modes:

- **Isolated Mode (default)**: Each instance gets its own subdirectory
- **Shared Mode (managers only)**: Multiple managers work in the same directory

## Workspace Modes

### Isolated Mode

**Default behavior** - maintains backward compatibility.

```javascript
await spawn({
    role: 'manager',
    workDir: '/project',
    context: 'Manager instructions...',
    // workspaceMode: 'isolated' is default
});
```

**Directory Structure:**
```
/project/
├── mgr_123456/          # Manager 1 isolated directory
│   ├── CLAUDE.md
│   └── .claude/settings.json
└── mgr_234567/          # Manager 2 isolated directory
    ├── CLAUDE.md
    └── .claude/settings.json
```

**Use Cases:**
- Single manager workflows
- Independent development tasks
- Maintaining strong isolation
- Legacy compatibility

### Shared Mode

**Collaboration enabled** - multiple managers work in same directory.

```javascript
await spawn({
    role: 'manager',
    workDir: '/project/development',
    context: 'Manager instructions...',
    workspaceMode: 'shared'
});
```

**Directory Structure:**
```
/project/development/
├── SHARED_WORKSPACE.md        # Tracks active managers
├── .managers/
│   ├── mgr_123456/
│   │   └── CLAUDE.md          # Manager 1 context
│   └── mgr_234567/
│       └── CLAUDE.md          # Manager 2 context
├── .claude/settings.json      # Shared MCP config
├── src/
│   └── auth.js               # Shared source files
└── package.json              # Shared project files
```

**Use Cases:**
- Multiple managers collaborating on same codebase
- Shared library development
- Code review and pair programming
- Complex feature development requiring coordination

## Implementation Details

### Workspace Mode Validation

1. **Role Restriction**: Only managers can use shared mode
2. **Parameter Validation**: workspaceMode must be 'isolated' or 'shared'
3. **Error Handling**: Clear error messages for invalid usage

```javascript
// ✅ Valid - Manager with shared mode
await spawn({
    role: 'manager',
    workspaceMode: 'shared',
    // ... other params
});

// ❌ Invalid - Specialist cannot use shared mode
await spawn({
    role: 'specialist',
    workspaceMode: 'shared',  // Throws error
    // ... other params
});
```

### File Organization

#### Isolated Mode
- Each instance gets `workDir/{instanceId}/` directory
- CLAUDE.md placed in instance directory
- Standard MCP configuration per instance

#### Shared Mode
- All managers share `workDir` directory
- Manager-specific CLAUDE.md in `.managers/{instanceId}/`
- Shared MCP configuration
- SHARED_WORKSPACE.md marker tracks active managers

### Git Integration

#### Shared Workspace Git Strategy
```bash
# Each manager should work on their own branch
git checkout -b manager-mgr_123456
# Make changes
git add .
git commit -m "Add authentication module"
# Merge when ready
git checkout main
git merge manager-mgr_123456
```

## Usage Examples

### Example 1: Executive Coordinating Multiple Managers

```javascript
// Executive spawns two managers for shared development
const mgr1 = await spawn({
    role: 'manager',
    workDir: '/project/development',
    context: 'Implement authentication system',
    parentId: 'exec_1',
    workspaceMode: 'shared'
});

const mgr2 = await spawn({
    role: 'manager',
    workDir: '/project/development',  // Same directory
    context: 'Implement user roles and permissions',
    parentId: 'exec_1',
    workspaceMode: 'shared'
});
```

### Example 2: Manager Creating Specialists (Always Isolated)

```javascript
// Managers always create specialists in isolated mode
const specialist = await spawn({
    role: 'specialist',
    workDir: '/project/development',
    context: 'Implement specific auth function',
    parentId: 'mgr_123456'
    // workspaceMode is ignored for specialists
});
```

## Configuration

### MCP Tool Configuration

The `spawn` tool accepts an optional `workspaceMode` parameter:

```json
{
    "role": "manager",
    "workDir": "/path/to/project",
    "context": "Manager instructions",
    "parentId": "exec_1",
    "workspaceMode": "shared"
}
```

### Environment Variables

No additional environment variables required. Workspace modes work with existing configuration.

## Best Practices

### When to Use Shared Mode

✅ **Good use cases:**
- Multiple managers need to modify the same files
- Building shared libraries or components
- Code review and collaborative development
- Complex features requiring tight coordination

❌ **Avoid shared mode for:**
- Single manager workflows
- Independent feature development
- Proof of concepts or experiments
- When strong isolation is required

### Git Workflow for Shared Workspaces

1. **Branch per Manager**: Each manager works on their own branch
2. **Descriptive Branch Names**: Use `manager-{instanceId}` pattern
3. **Regular Commits**: Commit frequently to avoid conflicts
4. **Communication**: Use MCP messages to coordinate major changes
5. **Merge Strategy**: Use merge commits to maintain history

### File Organization

```bash
# Shared workspace structure
/project/development/
├── SHARED_WORKSPACE.md          # Always check this file
├── .managers/                   # Manager-specific contexts
│   ├── mgr_123456/CLAUDE.md    # Don't modify other managers' contexts
│   └── mgr_234567/CLAUDE.md
├── src/                        # Shared source code
├── tests/                      # Shared tests  
└── docs/                       # Shared documentation
```

## Troubleshooting

### Common Issues

#### Issue: "Only managers can use shared workspace mode"
**Cause**: Trying to spawn non-manager with shared mode
**Solution**: Only use `workspaceMode: 'shared'` with `role: 'manager'`

#### Issue: Managers can't see each other's changes
**Cause**: Using isolated mode instead of shared
**Solution**: Ensure both managers use `workspaceMode: 'shared'` and same `workDir`

#### Issue: Git conflicts in shared workspace
**Cause**: Multiple managers modifying same files simultaneously
**Solution**: Use proper git branching strategy, communicate via MCP messages

#### Issue: Missing SHARED_WORKSPACE.md
**Cause**: First manager in shared workspace creates it automatically
**Solution**: Check if manager was actually spawned in shared mode

### Debug Commands

```bash
# Check if workspace is shared
ls -la /project/development/SHARED_WORKSPACE.md

# Check active managers
cat /project/development/SHARED_WORKSPACE.md

# Check manager-specific contexts
ls -la /project/development/.managers/

# Check git branches
git branch -a
```

## Migration Guide

### From Isolated to Shared Workspace

1. **Create new shared workspace directory**
2. **Spawn managers with `workspaceMode: 'shared'`**
3. **Copy relevant files to shared directory**
4. **Initialize git repository if needed**
5. **Update scripts/automation to use shared mode**

### From Shared to Isolated Workspace

1. **Ensure all work is committed to git**
2. **Spawn new managers without `workspaceMode` (defaults to isolated)**
3. **Copy shared files to individual manager directories**
4. **Update coordination strategy**

## Performance Considerations

- **Shared Mode**: Slightly more overhead due to marker file management
- **Isolated Mode**: Minimal overhead, same as original behavior
- **File I/O**: Shared mode creates additional marker files
- **Git Operations**: Shared mode may have more git conflicts to resolve

## Security Considerations

- **File Permissions**: All managers in shared workspace can access all files
- **Git History**: All managers can see full git history
- **Context Isolation**: Manager-specific contexts remain isolated in `.managers/`
- **No Cross-Instance Access**: Managers still cannot directly access other instances

## Future Enhancements

Potential future improvements:

1. **Workspace Templates**: Pre-configured shared workspace structures
2. **Real-time Collaboration**: File change notifications between managers
3. **Conflict Detection**: Automatic detection of simultaneous file edits
4. **Workspace Dashboard**: Web UI for monitoring shared workspace activity
5. **Role-based Permissions**: Fine-grained access control within shared workspaces

---

For implementation details, see `src/instance_manager.js` and `src/mcp_tools.js`.
For test examples, see `tests/test_workspace_modes.js`.