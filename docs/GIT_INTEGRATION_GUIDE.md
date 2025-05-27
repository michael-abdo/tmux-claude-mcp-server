# Git Integration Guide

This guide covers the automated git integration features in the tmux-claude MCP server, including workspace modes, automatic branch management, and conflict resolution.

## Table of Contents
- [Overview](#overview)
- [Workspace Modes](#workspace-modes)
- [Git Integration Features](#git-integration-features)
- [MCP Tools](#mcp-tools)
- [Architecture](#architecture)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

## Overview

The tmux-claude MCP server provides automated git integration for managing collaborative work between Claude instances. This feature is particularly important for Manager instances that coordinate multiple Specialists working on the same codebase.

### Key Benefits
- **Automatic branch management** - Each manager gets its own branch
- **Conflict detection** - Proactive identification of merge conflicts
- **Atomic operations** - All-or-nothing git operations with rollback
- **Graceful degradation** - Core functionality works even if git fails

## Workspace Modes

The system supports two workspace modes:

### 1. Isolated Mode (Default)
- Each instance gets its own subdirectory
- Complete isolation between instances
- No file sharing or conflicts
- Suitable for independent tasks

```javascript
// Spawn with isolated workspace (default)
await instanceManager.spawnInstance({
    role: 'specialist',
    project: '/path/to/project',
    task: 'Independent task'
});
```

### 2. Shared Mode
- All managers work in the same directory
- Enables code sharing and collaboration
- Automatic git branch creation
- Conflict detection and resolution

```javascript
// Spawn manager with shared workspace
await instanceManager.spawnInstance({
    role: 'manager',
    project: '/path/to/project',
    task: 'Coordinate feature implementation',
    workspaceMode: 'shared'  // Enable shared workspace
});
```

## Git Integration Features

### Automatic Branch Creation

When a manager instance is spawned with `workspaceMode: 'shared'`, the system automatically:

1. Initializes a shared workspace with git
2. Creates a unique branch for the manager
3. Sets up merge strategies for auto-resolvable files
4. Configures git user information

```javascript
// Automatic branch creation flow
const branch = await sharedWorkspaceGitManager.createManagerBranch(
    workspaceDir,
    'mgr_12345',
    'Implement user authentication'
);
// Result: mgr_12345_auth_feature_1748220123
```

### Conflict Detection

The system proactively detects conflicts between manager branches:

```javascript
const conflicts = await sharedWorkspaceGitManager.checkForConflicts(
    workspaceDir,
    'mgr_12345_feature',
    'mgr_67890_feature'
);

if (conflicts.hasConflicts) {
    console.log('Conflicting files:', conflicts.files);
    console.log('Auto-resolvable:', conflicts.autoResolvable);
}
```

### Auto-resolvable Files

Certain files are marked as auto-resolvable to prevent unnecessary conflicts:
- `README.md`
- `CHANGELOG.md`
- `TODO.md`
- `.gitignore`
- `package-lock.json`
- Documentation files (`*.md`)

### Atomic Git Operations

Critical git operations are wrapped in atomic transactions:

```javascript
const atomicOps = new AtomicGitOperations();
const result = await atomicOps.atomicOperation(
    workspaceDir,
    'create-feature-branch',
    [
        { name: 'create-branch', fn: async () => { /* ... */ } },
        { name: 'initial-commit', fn: async () => { /* ... */ } }
    ]
);

if (!result.success && result.rolledBack) {
    console.log('Operation failed but was safely rolled back');
}
```

## MCP Tools

Five new MCP tools are available for git integration:

### 1. git_status
Check the current git status of a shared workspace.

```javascript
{
    tool: 'git_status',
    arguments: {
        workspace_dir: '/path/to/workspace'
    }
}
```

### 2. git_branch
Create a new branch for a manager instance.

```javascript
{
    tool: 'git_branch',
    arguments: {
        workspace_dir: '/path/to/workspace',
        manager_id: 'mgr_12345',
        task_context: 'Implement feature X'
    }
}
```

### 3. git_conflicts
Check for conflicts between branches.

```javascript
{
    tool: 'git_conflicts',
    arguments: {
        workspace_dir: '/path/to/workspace',
        branch1: 'mgr_12345_feature',
        branch2: 'mgr_67890_feature'
    }
}
```

### 4. git_merge
Attempt to merge a manager's branch.

```javascript
{
    tool: 'git_merge',
    arguments: {
        workspace_dir: '/path/to/workspace',
        source_branch: 'mgr_12345_feature',
        target_branch: 'shared-base',
        strategy: 'auto'  // or 'manual'
    }
}
```

### 5. git_cleanup
Clean up completed branches.

```javascript
{
    tool: 'git_cleanup',
    arguments: {
        workspace_dir: '/path/to/workspace',
        branch: 'mgr_12345_feature',
        force: false
    }
}
```

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Instance Manager                        │
│  - Workspace mode detection                               │
│  - Shared workspace setup                                 │
│  - Git integration initialization                         │
└────────────────┬───────────────────────────┬─────────────┘
                 │                           │
    ┌────────────▼──────────┐   ┌───────────▼──────────────┐
    │ SharedWorkspaceGitMgr │   │ SharedWorkspaceMCPTools  │
    │ - Branch creation     │   │ - Tool implementations   │
    │ - Conflict detection  │   │ - Parameter validation   │
    │ - Status parsing      │   │ - Error handling         │
    └───────────┬───────────┘   └──────────────────────────┘
                │
    ┌───────────▼───────────┐
    │ AtomicGitOperations   │
    │ - Checkpoints         │
    │ - Rollback support    │
    │ - Transaction safety  │
    └───────────────────────┘
```

### Key Classes

1. **SharedWorkspaceGitManager** (`src/shared_workspace_git_manager.js`)
   - Singleton for managing git operations
   - Branch creation and management
   - Conflict detection algorithms
   - Git status parsing

2. **SharedWorkspaceMCPTools** (`src/shared_workspace_mcp_tools.js`)
   - MCP tool implementations
   - Parameter validation
   - Error handling and responses

3. **AtomicGitOperations** (`src/atomic_git_operations.js`)
   - Atomic transaction support
   - Checkpoint creation
   - Rollback mechanisms

### Graceful Degradation

The system implements graceful degradation for git failures:

```javascript
async setupSharedWorkspace(workspaceDir, instanceId, context) {
    // Phase 1: Core workspace setup (always succeeds)
    const workspace = await this.createCoreWorkspace(workspaceDir, instanceId, context);
    
    // Phase 2: Git integration (optional enhancement)
    try {
        workspace.git = await this.addGitIntegration(workspaceDir, instanceId, context);
        console.log('✓ Git integration enabled');
    } catch (error) {
        console.warn('⚠️ Git integration failed:', error.message);
        workspace.git = { enabled: false, error: error.message, fallbackMode: true };
    }
    
    return workspace;
}
```

## Testing

### Test Infrastructure

The project includes comprehensive test coverage:

1. **Unit Tests** (`tests/unit/test_git_manager_unit.js`)
   - 30 tests with mocked git operations
   - No actual git commands executed
   - Fast and reliable

2. **Integration Tests** (`tests/test_git_integration_isolated.js`)
   - Full git workflow testing
   - Isolated test environments
   - Real git operations

3. **Error Scenario Tests** (`tests/test_error_scenarios.js`)
   - 12 error scenarios
   - Edge case handling
   - Recovery mechanisms

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
node tests/unit/test_git_manager_unit.js
node tests/test_git_integration_isolated.js
node tests/test_error_scenarios.js
```

### Test Cleanup

The test infrastructure includes automatic cleanup:
- Tmux session termination
- Temporary directory removal
- Git worktree cleanup
- Process termination handlers

## Troubleshooting

### Common Issues

#### 1. "Not a git repository" Error
**Cause**: Workspace directory is not initialized with git.
**Solution**: Ensure git is initialized before git operations:
```bash
cd /path/to/workspace
git init
git config user.name "Your Name"
git config user.email "your@email.com"
```

#### 2. Branch Creation Fails
**Cause**: Invalid branch name or uncommitted changes.
**Solution**: 
- Check for valid branch name characters
- Commit or stash changes before branch operations

#### 3. Merge Conflicts
**Cause**: Conflicting changes between manager branches.
**Solution**:
- Use conflict detection tools before merging
- Coordinate work assignment to minimize conflicts
- Utilize auto-resolvable file patterns

#### 4. Git Integration Disabled
**Cause**: Git initialization or configuration failed.
**Solution**: 
- Check git installation: `git --version`
- Verify workspace permissions
- Review error logs for specific failure reasons

### Debug Mode

Enable debug logging for detailed git operation traces:

```javascript
// Set environment variable
process.env.GIT_DEBUG = 'true';

// Or in code
sharedWorkspaceGitManager.enableDebugLogging();
```

### Performance Considerations

- Branch operations are lightweight (< 100ms)
- Conflict detection scales with diff size
- Atomic operations add ~50ms overhead
- Status parsing optimized for large repositories

## Best Practices

1. **Work Assignment**
   - Assign non-overlapping files to specialists
   - Use clear task boundaries
   - Document file ownership in PR descriptions

2. **Branch Management**
   - Keep branches short-lived
   - Merge frequently to minimize conflicts
   - Clean up completed branches

3. **Error Handling**
   - Always check operation results
   - Implement retry logic for transient failures
   - Log git errors for debugging

4. **Testing**
   - Test git operations in isolation
   - Mock git commands in unit tests
   - Use temporary directories for integration tests

## Future Enhancements

1. **Intelligent Conflict Resolution**
   - AI-powered merge conflict resolution
   - Semantic understanding of code changes
   - Automatic resolution suggestions

2. **Advanced Branch Strategies**
   - Feature branch workflows
   - Release branch management
   - Hotfix branch automation

3. **Performance Optimizations**
   - Parallel git operations
   - Incremental diff calculations
   - Caching of git status

4. **Enhanced Monitoring**
   - Real-time conflict alerts
   - Branch activity dashboards
   - Merge success metrics