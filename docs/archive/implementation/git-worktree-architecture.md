# Git Worktree Architecture for Specialist Isolation

## Overview

The tmux-claude MCP server uses Git worktrees to provide true file system isolation for specialist instances. This enables multiple specialists to work on different features concurrently without file conflicts.

## Benefits

### 1. **True Parallel Development**
- Multiple specialists can work on different features simultaneously
- Each specialist has their own isolated file system view
- No conflicts when specialists modify the same files for different features

### 2. **Clean Feature Branches**
- Each specialist automatically gets their own feature branch
- Branch naming convention: `specialist-{instanceId}-{taskId}-{feature}`
- Easy to track which specialist worked on which feature

### 3. **Automatic Cleanup**
- Worktrees are automatically removed when specialists terminate
- Associated branches can be cleaned up after merging
- No manual cleanup required

### 4. **Preserved Main Working Directory**
- Executive and Manager instances continue using the main project directory
- Only specialists get isolated worktrees
- Main branch stays clean and unaffected by specialist work

## Architecture

```
project-root/
├── .git/                    # Main git repository
├── src/                     # Main working directory (Executive/Manager)
├── tests/
└── project-root-worktrees/  # Worktree directory
    ├── spec_123_task_456/   # Specialist 1 worktree
    ├── spec_789_task_012/   # Specialist 2 worktree
    └── spec_345_task_678/   # Specialist 3 worktree
```

## Implementation Details

### Worktree Creation

When a Manager spawns a Specialist:

1. **Branch Creation**: A new branch is created from the current branch
   ```bash
   git worktree add "../project-worktrees/spec_123_task_456" \
     -b specialist-spec_123-task_456-feature-name
   ```

2. **Context Update**: The specialist's context includes its worktree path
   ```javascript
   context: `Your working directory is: ${worktreePath}
            You are working on branch: ${branchName}`
   ```

3. **Isolation Verification**: Each worktree is completely isolated
   - File changes in one worktree don't affect others
   - Each worktree can have different file contents

### Worktree Lifecycle

1. **Creation**: When specialist is spawned by Manager
2. **Active Use**: Specialist works in isolated directory
3. **Completion**: Specialist completes task and reports back
4. **Cleanup**: Manager removes worktree and optionally merges branch

### Integration with Orchestration

The worktree system integrates seamlessly with the hierarchical orchestration:

```
Executive (main directory)
    ├── Manager (main directory)
    │   ├── Specialist 1 (worktree 1)
    │   ├── Specialist 2 (worktree 2)
    │   └── Specialist 3 (worktree 3)
    └── Manager (main directory)
        ├── Specialist 4 (worktree 4)
        └── Specialist 5 (worktree 5)
```

## Usage Examples

### Manager Spawning Specialist with Worktree

```javascript
// In Manager code
const specialist = await tools.spawn({
    role: 'specialist',
    goal: 'Implement user authentication',
    context: `Task: Add login functionality
              Files to modify: src/auth.js, src/routes/login.js`,
    projectDir: this.projectDir  // Will be converted to worktree
});
```

### Specialist Working in Isolation

```javascript
// Specialist automatically works in worktree
// Can freely modify files without affecting other specialists
await tools.write({
    path: 'src/auth.js',  // Actually writes to worktree/src/auth.js
    contents: '// New authentication code'
});
```

### Manager Merging Specialist Work

```javascript
// After specialist completes
await gitManager.mergeSpecialistWork({
    branchName: 'specialist-spec_123-task_456-auth',
    deleteAfterMerge: true
});
```

## Configuration

Worktree behavior can be configured in the MCP server:

```javascript
{
    // Enable/disable worktrees for specialists
    useWorktreesForSpecialists: true,
    
    // Custom worktree directory name
    worktreeDirectory: 'project-worktrees',
    
    // Auto-cleanup on termination
    autoCleanupWorktrees: true,
    
    // Branch naming pattern
    branchPattern: 'specialist-{instanceId}-{taskId}-{feature}'
}
```

## Best Practices

1. **Feature Isolation**: Assign each specialist a specific feature to work on
2. **Clear Task Boundaries**: Define clear file sets for each specialist
3. **Regular Merging**: Merge specialist branches frequently to avoid conflicts
4. **Branch Cleanup**: Delete merged branches to keep repository clean
5. **Worktree Monitoring**: Use `git worktree list` to monitor active worktrees

## Troubleshooting

### Common Issues

1. **Worktree Already Exists**
   - Error: "worktree already exists"
   - Solution: Remove stale worktree with `git worktree remove`

2. **Branch Conflicts**
   - Error: "branch already exists"
   - Solution: Use unique task IDs or clean up old branches

3. **Disk Space**
   - Issue: Multiple worktrees consume disk space
   - Solution: Implement regular cleanup, use shallow clones

### Debugging Commands

```bash
# List all worktrees
git worktree list

# Remove specific worktree
git worktree remove ../project-worktrees/spec_123_task_456

# Prune stale worktrees
git worktree prune

# Check worktree status
cd ../project-worktrees/spec_123_task_456 && git status
```

## Future Enhancements

1. **Shallow Worktrees**: Use shallow clones for faster creation
2. **Worktree Templates**: Pre-configured worktrees for common tasks
3. **Parallel Merging**: Automated conflict resolution for parallel branches
4. **Worktree Pooling**: Reuse worktrees for similar tasks
5. **Remote Worktrees**: Support for distributed specialist execution