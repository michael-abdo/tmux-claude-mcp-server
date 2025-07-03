# Shared Workspace Git Integration

This document describes the automated git integration features that solve collaboration challenges in shared workspace scenarios. These features eliminate manual git coordination and provide robust conflict detection and resolution.

## Overview

The git integration automates the critical workflow pain points identified in the workspace modes implementation:

- **Automatic Manager Branch Creation**: Each manager gets their own branch automatically
- **Smart Conflict Detection**: Proactive analysis of potential merge conflicts  
- **Coordinated Merging**: Executive-controlled merge orchestration with conflict resolution
- **Workspace State Monitoring**: Real-time visibility into collaboration status
- **Recovery Procedures**: Automated handling of failed merge scenarios

## Architecture

### Core Components

1. **SharedWorkspaceGitManager**: Core git operations and automation
2. **SharedWorkspaceMCPTools**: MCP tools for executive and manager coordination
3. **Extended InstanceManager**: Automatic git integration during workspace setup

### Workflow Integration

```
Executive Decision → Shared Workspace → Git Integration
       ↓                    ↓               ↓
   spawn(shared)    → Auto-init repo → Create manager branches
       ↓                    ↓               ↓
   Manager work     → Auto-commit    → Conflict detection
       ↓                    ↓               ↓
   Coordinated merge ← Smart resolution ← Executive oversight
```

## Features

### 1. Automatic Git Workspace Initialization

When the first manager is spawned in shared mode:

```javascript
// Automatic initialization happens during:
await spawn({
    role: 'manager',
    workspaceMode: 'shared',
    workDir: '/project/development',
    context: 'Implement authentication system'
});
```

**What happens automatically:**
- Git repository validation/initialization
- Shared workspace configuration (`.gitattributes`, merge strategies)
- Base branch identification (main/master)
- Clean working tree validation

### 2. Manager Branch Creation

Each manager automatically gets their own branch:

**Branch Naming Pattern**: `manager-{instanceId}`

**Example**: 
- Manager `mgr_123456` → Branch `manager-mgr_123456`
- Manager `mgr_789012` → Branch `manager-mgr_789012`

**Automatic Setup**:
- Branch from latest main/master
- Initial commit with manager context
- Remote tracking (if origin exists)
- Manager-specific workspace markers

### 3. Shared Workspace Markers

The system creates comprehensive workspace documentation:

**SHARED_WORKSPACE.md** (auto-updated):
```markdown
# Shared Manager Workspace

This is a shared workspace where all managers collaborate.

## Active Managers
- mgr_123456 (branch: manager-mgr_123456)
- mgr_789012 (branch: manager-mgr_789012)

## Git Branches
Each manager works on their own branch and merges back to main when ready.

### Active Branches
- manager-mgr_123456 (mgr_123456)
- manager-mgr_789012 (mgr_789012)

## Guidelines
- All managers can see and modify all files
- Use git branches for isolation: manager-{instanceId}
- Communicate major changes via MCP messages
- Check .managers/{instanceId}/CLAUDE.md for each manager's context
- Test changes before merging
- Use descriptive commit messages
```

## MCP Tools for Git Coordination

### For Executives

#### 1. `merge_manager_work`
Coordinate merge of completed manager work.

```javascript
await merge_manager_work({
    managerId: 'mgr_123456',
    targetBranch: 'main',        // default: 'main'
    strategy: 'auto',            // 'auto' | 'manual' | 'theirs' | 'ours'
    deleteBranch: false          // delete branch after merge
});
```

**Response:**
```javascript
{
    success: true,
    status: 'merged',            // 'merged' | 'conflicts_detected' | 'error'
    managerBranch: 'manager-mgr_123456',
    targetBranch: 'main',
    conflicts: [],               // conflicting files if any
    message: 'Merge completed successfully'
}
```

#### 2. `check_workspace_conflicts`
Proactively analyze potential conflicts between managers.

```javascript
await check_workspace_conflicts({
    workspaceDir: '/project/development',
    managerIds: ['mgr_123456', 'mgr_789012']
});
```

**Response:**
```javascript
{
    workspace: '/project/development',
    managers: [
        {
            managerId: 'mgr_123456',
            branch: 'manager-mgr_123456',
            hasConflicts: false,
            conflictingFiles: [],
            changedFiles: ['auth.js', 'utils.js']
        },
        {
            managerId: 'mgr_789012', 
            branch: 'manager-mgr_789012',
            hasConflicts: true,
            conflictingFiles: ['utils.js'],    // Both managers modified this
            changedFiles: ['roles.js', 'utils.js']
        }
    ],
    conflicts: ['utils.js'],
    recommendations: [
        'Coordinate with managers to resolve conflicts before merging',
        'Consider sequential merging instead of parallel development'
    ]
}
```

#### 3. `get_workspace_status`
Get comprehensive workspace collaboration status.

```javascript
await get_workspace_status({
    workspaceDir: '/project/development'
});
```

**Response:**
```javascript
{
    workspace: '/project/development',
    currentBranch: 'main',
    managers: [
        {
            instanceId: 'mgr_123456',
            branch: 'manager-mgr_123456',
            branchExists: true,
            status: 'active'
        }
    ],
    branches: ['main', 'manager-mgr_123456', 'manager-mgr_789012'],
    status: 'active',
    conflicts: []
}
```

### For Managers

#### 1. `sync_manager_branch`
Keep manager branch updated with latest main branch changes.

```javascript
await sync_manager_branch({
    instanceId: 'mgr_123456',
    baseBranch: 'main'           // default: 'main'
});
```

**Use Case**: Before starting new work or before requesting merge.

#### 2. `commit_manager_work`
Commit work with proper git practices and enhanced commit messages.

```javascript
await commit_manager_work({
    instanceId: 'mgr_123456',
    message: 'Add user authentication system',
    files: ['auth.js', 'auth.test.js']  // optional, defaults to all changes
});
```

**Enhanced Commit Message**:
```
Add user authentication system

Manager: mgr_123456
Branch: manager-mgr_123456
Workspace: Shared collaboration
```

## Conflict Detection and Resolution

### Smart Conflict Analysis

The system analyzes conflicts at multiple levels:

1. **File-level conflicts**: Same files modified by multiple managers
2. **Content conflicts**: Actual merge conflicts within files  
3. **Dependency conflicts**: Changes that affect shared dependencies

### Auto-Resolution Strategies

**Auto-resolvable conflicts:**
- Documentation files (`.md`)
- Simple JSON files
- Non-critical configuration files

**Manual resolution required:**
- Source code files
- Package manifests (`package.json`)
- Critical configuration files

### Conflict Resolution Strategies

1. **`auto`** (default): Try smart resolution, fallback to manual
2. **`manual`**: Always require manual resolution
3. **`theirs`**: Prefer incoming manager's changes
4. **`ours`**: Prefer existing main branch changes

## Executive Orchestration Patterns

### Pattern 1: Sequential Development
Best for complex features with dependencies.

```javascript
// 1. Spawn managers sequentially
const mgr1 = await spawn({ role: 'manager', workspaceMode: 'shared', context: 'Core auth system' });
await checkWorkspaceConflicts({ workspaceDir, managerIds: [mgr1.instanceId] });

// 2. Complete and merge first manager
await mergeManagerWork({ managerId: mgr1.instanceId });

// 3. Spawn second manager with updated base
const mgr2 = await spawn({ role: 'manager', workspaceMode: 'shared', context: 'Auth UI components' });
```

### Pattern 2: Parallel Development with Coordination
Best for independent features.

```javascript
// 1. Spawn managers in parallel
const mgr1 = await spawn({ role: 'manager', workspaceMode: 'shared', context: 'Authentication backend' });
const mgr2 = await spawn({ role: 'manager', workspaceMode: 'shared', context: 'User roles system' });

// 2. Monitor for conflicts during development
setInterval(async () => {
    const conflicts = await checkWorkspaceConflicts({ 
        workspaceDir, 
        managerIds: [mgr1.instanceId, mgr2.instanceId] 
    });
    if (conflicts.conflicts.length > 0) {
        // Send coordination messages via MCP
        await send({ instanceId: mgr1.instanceId, text: 'Conflict detected in utils.js - coordinate with other manager' });
    }
}, 60000); // Check every minute

// 3. Merge in order of completion
await mergeManagerWork({ managerId: mgr1.instanceId });
await syncManagerBranch({ instanceId: mgr2.instanceId }); // Sync with mgr1's changes
await mergeManagerWork({ managerId: mgr2.instanceId });
```

### Pattern 3: Feature Branch Workflow
Best for larger features requiring multiple iterations.

```javascript
// 1. Create feature-specific workspace
const featureBranch = 'feature/user-management';
await exec(`git checkout -b ${featureBranch}`, { cwd: workspaceDir });

// 2. Spawn managers with feature context
const mgr1 = await spawn({ 
    role: 'manager', 
    workspaceMode: 'shared', 
    context: `User management - Authentication (base: ${featureBranch})` 
});

// 3. Manager branches from feature branch instead of main
// 4. Merge managers into feature branch
// 5. Final merge feature branch to main
```

## Error Recovery Procedures

### Failed Merge Recovery

```javascript
// If merge fails due to conflicts:
const mergeResult = await mergeManagerWork({ managerId: 'mgr_123456' });

if (!mergeResult.success && mergeResult.status === 'conflicts_detected') {
    // 1. Get conflict analysis
    const conflicts = await checkWorkspaceConflicts({ 
        workspaceDir, 
        managerIds: ['mgr_123456'] 
    });
    
    // 2. Manual resolution workflow
    await send({ 
        instanceId: 'mgr_123456', 
        text: `Merge conflicts detected in: ${conflicts.conflicts.join(', ')}. Please resolve and commit.` 
    });
    
    // 3. Retry merge after manual resolution
    const retryResult = await mergeManagerWork({ 
        managerId: 'mgr_123456',
        strategy: 'manual' 
    });
}
```

### Branch Synchronization Recovery

```javascript
// If manager branch gets out of sync:
try {
    await syncManagerBranch({ instanceId: 'mgr_123456' });
} catch (error) {
    // Force sync with conflict resolution
    await syncManagerBranch({ 
        instanceId: 'mgr_123456',
        strategy: 'theirs'  // Prefer manager's changes
    });
}
```

### Workspace State Recovery

```javascript
// If workspace gets into inconsistent state:
const status = await getWorkspaceStatus({ workspaceDir });

if (status.status === 'error') {
    // Re-initialize workspace
    await sharedWorkspaceGitManager.initializeSharedWorkspace(workspaceDir);
    
    // Recreate manager branches if needed
    for (const manager of status.managers) {
        if (!manager.branchExists) {
            await sharedWorkspaceGitManager.createManagerBranch({
                instanceId: manager.instanceId,
                workspaceDir,
                taskDescription: 'Recovery branch creation'
            });
        }
    }
}
```

## Performance Considerations

### Git Operations Optimization

- **Shallow clones**: Use `--depth 1` for large repositories
- **Sparse checkouts**: Only checkout necessary files
- **Batch operations**: Group multiple git commands
- **Background sync**: Async branch synchronization

### Conflict Detection Optimization

- **Incremental analysis**: Only check changed files
- **Cached merge-base**: Store common ancestors
- **Parallel branch analysis**: Check multiple managers concurrently

### Memory Management

- **Git object cleanup**: Regular `git gc` for large workspaces
- **Worktree cleanup**: Remove orphaned worktrees
- **Branch pruning**: Clean up merged manager branches

## Security Considerations

### Branch Protection

- **Pre-commit hooks**: Prevent direct commits to protected branches
- **Manager isolation**: Managers can't access other manager branches directly
- **Executive oversight**: Only executives can coordinate merges

### Access Control

- **Role-based git operations**: Git tools respect MCP role restrictions
- **Audit trail**: All git operations logged with manager context
- **Workspace boundaries**: Managers can't access other shared workspaces

## Monitoring and Observability

### Git Integration Metrics

```javascript
// Available via get_workspace_status
{
    metrics: {
        totalCommits: 15,
        activeBranches: 3,
        mergedBranches: 2,
        conflictResolutions: 1,
        averageMergeTime: '2.3 minutes',
        lastActivity: '2024-01-15T10:30:00Z'
    }
}
```

### Conflict Analytics

```javascript
{
    conflictHistory: [
        {
            date: '2024-01-15T10:00:00Z',
            managers: ['mgr_123456', 'mgr_789012'],
            files: ['utils.js'],
            resolution: 'manual',
            resolutionTime: '5 minutes'
        }
    ]
}
```

## Best Practices

### For Executives

1. **Plan Workspace Strategy**: Choose parallel vs sequential based on feature complexity
2. **Monitor Conflicts Proactively**: Regular conflict checks prevent merge issues
3. **Coordinate Manager Communication**: Use MCP messages for coordination
4. **Merge in Order**: Complete simpler features first to reduce conflicts

### For Managers

1. **Sync Before Major Work**: Always sync branch before starting new features
2. **Commit Frequently**: Small, focused commits reduce conflict complexity
3. **Test Before Commit**: Ensure code works before committing
4. **Descriptive Messages**: Clear commit messages help with conflict resolution

### For System Administrators

1. **Git Configuration**: Proper `.gitattributes` and merge drivers
2. **Repository Maintenance**: Regular cleanup of merged branches
3. **Monitoring Setup**: Track git integration metrics
4. **Backup Strategy**: Regular backups of shared workspaces

---

## Migration from Manual Git Workflows

### Step 1: Enable Git Integration
Update existing shared workspaces to use git integration:

```javascript
// For existing shared workspaces
await sharedWorkspaceGitManager.initializeSharedWorkspace(existingWorkspaceDir);

// Existing managers will automatically get branches on next operation
```

### Step 2: Train Teams
- Executives learn new MCP tools for merge coordination
- Managers learn sync and commit workflows
- Update documentation and procedures

### Step 3: Monitor and Optimize
- Track conflict rates and resolution times
- Adjust workspace strategies based on team patterns
- Optimize git configuration for team workflows

This git integration transforms shared workspace collaboration from a manual, error-prone process into an automated, robust system that scales with team complexity.