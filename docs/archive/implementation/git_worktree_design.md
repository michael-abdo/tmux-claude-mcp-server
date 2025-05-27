# Git Worktree Design for Specialist Isolation

## Current Git Branch Strategy Limitations

### How It Works Now
1. All specialists work in the **same directory** (e.g., `/tmp/project/spec_123/`)
2. Each specialist creates a branch: `specialist-{id}-{task}-{feature}`
3. Specialists must `git checkout` to switch branches
4. Only one specialist can work at a time in each directory

### Problems with Current Approach

1. **File System Conflicts**
   - Multiple specialists editing same files cause conflicts
   - Changes from one specialist can affect another
   - File watchers and build tools get confused

2. **Branch Switching Overhead**
   - Each `git checkout` changes all files
   - Build caches invalidated
   - IDE/editor confusion with changing files

3. **No True Parallelism**
   - Specialists must take turns
   - Can't have 3 specialists editing different files simultaneously
   - Manager becomes a bottleneck coordinating access

4. **Merge Conflicts**
   - Hard to preview changes before merging
   - Specialists can't see each other's work
   - Testing requires branch switching

## Git Worktree Solution

### What Are Git Worktrees?
Git worktrees allow multiple working directories for the same repository, each on a different branch.

```bash
# Instead of switching branches in one directory:
cd /project
git checkout feature-1  # Changes all files
git checkout feature-2  # Changes all files again

# With worktrees, each branch has its own directory:
/project (main branch)
/project-worktrees/feature-1 (feature-1 branch)
/project-worktrees/feature-2 (feature-2 branch)
```

### Benefits for Specialist Isolation

1. **True Parallel Work**
   - Each specialist gets their own directory
   - No file system conflicts
   - Real concurrent editing

2. **Better Performance**
   - No branch switching overhead
   - Build caches preserved
   - File watchers work correctly

3. **Easier Testing**
   - Manager can test all specialist work simultaneously
   - Side-by-side comparison of changes
   - No context switching

4. **Cleaner Merges**
   - Preview merge conflicts before merging
   - Test integration in Manager's directory
   - Keep specialist work isolated until ready

## Implementation Architecture

### Directory Structure
```
/project (main branch - Manager's workspace)
/project-worktrees/
  ├── spec_123_task1/ (specialist-spec_123-task1-feature)
  ├── spec_124_task2/ (specialist-spec_124-task2-feature)
  └── spec_125_task3/ (specialist-spec_125-task3-feature)
```

### Workflow

1. **Manager Spawns Specialist**
   ```javascript
   const specialist = await spawn({
       role: 'specialist',
       workDir: '/project',  // Main project dir
       context: 'Implement feature X'
   });
   ```

2. **System Creates Worktree**
   ```bash
   # Automatically executed by system
   git worktree add /project-worktrees/spec_123_task1 -b specialist-spec_123-task1-feature
   ```

3. **Specialist Works in Isolation**
   - Specialist's Claude instance runs in `/project-worktrees/spec_123_task1`
   - Complete isolation from other specialists
   - Can run tests, builds, etc. independently

4. **Manager Reviews and Merges**
   ```bash
   # Manager can inspect all specialist work
   ls /project-worktrees/
   
   # Test integration
   cd /project
   git merge specialist-spec_123-task1-feature
   ```

5. **Cleanup After Merge**
   ```bash
   git worktree remove /project-worktrees/spec_123_task1
   git branch -d specialist-spec_123-task1-feature
   ```

### Implementation Changes

1. **Update GitBranchManager**
   - Add `createWorktree()` method
   - Add `removeWorktree()` method
   - Modify `createSpecialistBranch()` to use worktrees

2. **Update InstanceManager**
   - Change specialist working directory to worktree path
   - Update project directory tracking

3. **Update Specialist Prompts**
   - Explain they have their own isolated directory
   - No need for branch switching commands
   - Direct file editing without conflicts

4. **Add Cleanup Logic**
   - Remove worktree on specialist termination
   - Prune stale worktrees periodically

### Code Example

```javascript
class GitBranchManager {
    async createSpecialistWorktree(options) {
        const { instanceId, taskId, feature, baseDir } = options;
        
        // Generate branch and worktree names
        const branchName = this.generateBranchName(instanceId, taskId, feature);
        const worktreePath = path.join(baseDir, '..', `${baseDir}-worktrees`, `${instanceId}_${taskId}`);
        
        // Create worktree with new branch
        await this.gitCommand(
            `worktree add "${worktreePath}" -b ${branchName}`,
            baseDir
        );
        
        return {
            branchName,
            worktreePath,
            worktreeRelative: path.relative(baseDir, worktreePath)
        };
    }
    
    async removeSpecialistWorktree(worktreePath, branchName) {
        // Remove worktree
        await this.gitCommand(`worktree remove "${worktreePath}"`, '.');
        
        // Delete branch
        await this.gitCommand(`branch -d ${branchName}`, '.');
    }
}
```

## Migration Path

1. **Phase 1**: Add worktree support alongside existing branch strategy
2. **Phase 2**: Update specialists to use worktrees by default
3. **Phase 3**: Remove old branch-switching code
4. **Phase 4**: Add advanced features (worktree templates, etc.)

## Expected Benefits

1. **3-5x Performance Improvement**
   - No branch switching overhead
   - Parallel file operations
   - Better resource utilization

2. **Fewer Conflicts**
   - True file system isolation
   - No accidental overwrites
   - Cleaner merge process

3. **Better Developer Experience**
   - Specialists work naturally
   - Manager has better visibility
   - Easier debugging and testing

4. **Scalability**
   - Support more concurrent specialists
   - Larger projects feasible
   - Better resource management