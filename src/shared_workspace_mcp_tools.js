/**
 * Shared Workspace MCP Tools
 * 
 * Additional MCP tools specifically for shared workspace git coordination.
 * These tools enable managers to coordinate git operations, handle merges,
 * and resolve conflicts in shared workspace scenarios.
 */

import { sharedWorkspaceGitManager } from './shared_workspace_git_manager.js';

class SharedWorkspaceMCPTools {
    constructor(instanceManager) {
        this.instanceManager = instanceManager;
        this.gitManager = sharedWorkspaceGitManager;
    }

    /**
     * Tool: merge_manager_work
     * Coordinate merge of manager work back to main branch
     * 
     * Usage by Executives to coordinate manager work completion
     */
    async mergeManagerWork(params, callerRole = null) {
        const { 
            managerId, 
            targetBranch = null, 
            strategy = 'auto',
            deleteBranch = false 
        } = params;
        
        // Validate parameters
        if (!managerId) {
            throw new Error('Missing required parameter: managerId');
        }
        
        // Role-based access control - only executives can coordinate merges
        if (callerRole !== 'executive') {
            throw new Error('Only executives can coordinate manager merges');
        }
        
        try {
            // Get manager instance info
            const managerInstance = this.instanceManager.instances[managerId];
            if (!managerInstance) {
                throw new Error(`Manager instance ${managerId} not found`);
            }
            
            if (!managerInstance.isSharedWorkspace) {
                throw new Error(`Manager ${managerId} is not in a shared workspace`);
            }
            
            // Get the manager's branch name
            const managerBranch = `manager-${managerId}`;
            const workspaceDir = managerInstance.workDir;
            
            // Get the default branch if not specified
            const actualTargetBranch = targetBranch || await this.gitManager.getDefaultBranch(workspaceDir);
            
            // Perform coordinated merge
            const mergeResult = await this.gitManager.coordinatedMerge({
                managerBranch,
                targetBranch: actualTargetBranch,
                workspaceDir,
                strategy,
                deleteBranch
            });
            
            return {
                success: mergeResult.success,
                status: mergeResult.status,
                managerBranch,
                targetBranch,
                conflicts: mergeResult.conflicts || [],
                message: mergeResult.message || 'Merge completed successfully'
            };
        } catch (error) {
            throw new Error(`Failed to merge manager work: ${error.message}`);
        }
    }

    /**
     * Tool: check_workspace_conflicts
     * Analyze potential conflicts in shared workspace
     * 
     * Usage by Executives to proactively identify collaboration issues
     */
    async checkWorkspaceConflicts(params, callerRole = null) {
        const { workspaceDir, managerIds = [] } = params;
        
        if (!workspaceDir) {
            throw new Error('Missing required parameter: workspaceDir');
        }
        
        // Available to executives and managers
        if (!['executive', 'manager'].includes(callerRole)) {
            throw new Error('Only executives and managers can check workspace conflicts');
        }
        
        try {
            const conflictAnalysis = {
                workspace: workspaceDir,
                managers: [],
                conflicts: [],
                recommendations: []
            };
            
            // Analyze each manager's branch for conflicts
            for (const managerId of managerIds) {
                const managerBranch = `manager-${managerId}`;
                
                // Check if branch exists
                if (await this.gitManager.branchExists(managerBranch, workspaceDir)) {
                    // Get the default branch for conflict analysis
                    const defaultBranch = await this.gitManager.getDefaultBranch(workspaceDir);
                    const analysis = await this.gitManager.analyzeConflicts(
                        managerBranch, 
                        defaultBranch, 
                        workspaceDir
                    );
                    
                    conflictAnalysis.managers.push({
                        managerId,
                        branch: managerBranch,
                        hasConflicts: analysis.hasConflicts,
                        conflictingFiles: analysis.conflicts || [],
                        changedFiles: analysis.sourceChanges || []
                    });
                    
                    if (analysis.hasConflicts) {
                        conflictAnalysis.conflicts.push(...analysis.conflicts);
                    }
                }
            }
            
            // Generate recommendations
            if (conflictAnalysis.conflicts.length > 0) {
                conflictAnalysis.recommendations.push(
                    'Coordinate with managers to resolve conflicts before merging',
                    'Consider sequential merging instead of parallel development',
                    'Use MCP messages to communicate about file changes'
                );
            } else {
                conflictAnalysis.recommendations.push(
                    'No conflicts detected - ready for merging',
                    'Consider merging in order of completion'
                );
            }
            
            return conflictAnalysis;
        } catch (error) {
            throw new Error(`Failed to check workspace conflicts: ${error.message}`);
        }
    }

    /**
     * Tool: sync_manager_branch
     * Sync manager branch with latest main branch changes
     * 
     * Usage by Managers to stay current with shared workspace
     */
    async syncManagerBranch(params, callerRole = null) {
        const { instanceId, baseBranch = null } = params;
        
        if (!instanceId) {
            throw new Error('Missing required parameter: instanceId');
        }
        
        // Only managers can sync their own branches
        if (callerRole !== 'manager') {
            throw new Error('Only managers can sync their branches');
        }
        
        try {
            // Get manager instance
            const managerInstance = this.instanceManager.instances[instanceId];
            if (!managerInstance) {
                throw new Error(`Manager instance ${instanceId} not found`);
            }
            
            const workspaceDir = managerInstance.workDir;
            const managerBranch = `manager-${instanceId}`;
            
            // Get the default branch if not specified
            const actualBaseBranch = baseBranch || await this.gitManager.getDefaultBranch(workspaceDir);
            
            // Ensure we're on the manager branch
            await this.gitManager.gitCommand(`checkout ${managerBranch}`, workspaceDir);
            
            // Pull latest changes from base branch
            await this.gitManager.gitCommand(`checkout ${actualBaseBranch}`, workspaceDir);
            await this.gitManager.pullLatestChanges(actualBaseBranch, workspaceDir);
            
            // Merge base branch into manager branch
            await this.gitManager.gitCommand(`checkout ${managerBranch}`, workspaceDir);
            
            const mergeResult = await this.gitManager.gitCommand(
                `merge ${actualBaseBranch} -m "Sync with latest ${actualBaseBranch}"`, 
                workspaceDir
            );
            
            return {
                success: true,
                managerBranch,
                baseBranch,
                message: `Successfully synced ${managerBranch} with ${baseBranch}`
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: `Failed to sync branch: ${error.message}`
            };
        }
    }

    /**
     * Tool: commit_manager_work  
     * Commit current work with proper git practices
     * 
     * Usage by Managers to save work with good commit messages
     */
    async commitManagerWork(params, callerRole = null) {
        const { instanceId, message, files = [] } = params;
        
        if (!instanceId || !message) {
            throw new Error('Missing required parameters: instanceId, message');
        }
        
        // Only managers can commit their work
        if (callerRole !== 'manager') {
            throw new Error('Only managers can commit work');
        }
        
        try {
            // Get manager instance
            const managerInstance = this.instanceManager.instances[instanceId];
            if (!managerInstance) {
                throw new Error(`Manager instance ${instanceId} not found`);
            }
            
            const workspaceDir = managerInstance.workDir;
            const managerBranch = `manager-${instanceId}`;
            
            // Ensure we're on the correct branch
            await this.gitManager.gitCommand(`checkout ${managerBranch}`, workspaceDir);
            
            // Add files (all if none specified)
            if (files.length > 0) {
                for (const file of files) {
                    await this.gitManager.gitCommand(`add "${file}"`, workspaceDir);
                }
            } else {
                await this.gitManager.gitCommand('add .', workspaceDir);
            }
            
            // Create commit with enhanced message
            const enhancedMessage = `${message}

Manager: ${instanceId}
Branch: ${managerBranch}
Workspace: Shared collaboration
`;
            
            await this.gitManager.gitCommand(
                `commit -m "${enhancedMessage}"`, 
                workspaceDir
            );
            
            // Try to push to remote
            try {
                await this.gitManager.gitCommand(`push origin ${managerBranch}`, workspaceDir);
            } catch {
                // Ignore push errors (no remote)
            }
            
            return {
                success: true,
                instanceId,
                managerBranch,
                message: `Committed work: ${message}`,
                filesCommitted: files.length || 'all changes'
            };
        } catch (error) {
            throw new Error(`Failed to commit manager work: ${error.message}`);
        }
    }

    /**
     * Tool: get_workspace_status
     * Get comprehensive status of shared workspace
     * 
     * Usage by Executives and Managers to understand workspace state
     */
    async getWorkspaceStatus(params, callerRole = null) {
        const { workspaceDir } = params;
        
        if (!workspaceDir) {
            throw new Error('Missing required parameter: workspaceDir');
        }
        
        // Available to executives and managers
        if (!['executive', 'manager'].includes(callerRole)) {
            throw new Error('Only executives and managers can get workspace status');
        }
        
        try {
            const status = {
                workspace: workspaceDir,
                currentBranch: null,
                managers: [],
                branches: [],
                status: 'unknown',
                lastSync: null,
                conflicts: []
            };
            
            // Get current branch
            try {
                status.currentBranch = await this.gitManager.getCurrentBranch(workspaceDir);
            } catch {
                status.status = 'not_git_repo';
                return status;
            }
            
            // Get all branches
            const branchResult = await this.gitManager.gitCommand('branch -a', workspaceDir);
            status.branches = branchResult.stdout
                .split('\n')
                .map(b => b.trim().replace(/^\*?\s*/, ''))
                .filter(b => b);
            
            // Find manager branches and instances
            for (const [instanceId, instance] of Object.entries(this.instanceManager.instances)) {
                if (instance.isSharedWorkspace && instance.workDir === workspaceDir) {
                    const managerBranch = `manager-${instanceId}`;
                    const branchExists = status.branches.some(b => b.includes(managerBranch));
                    
                    status.managers.push({
                        instanceId,
                        branch: managerBranch,
                        branchExists,
                        status: instance.status
                    });
                }
            }
            
            status.status = 'active';
            return status;
        } catch (error) {
            throw new Error(`Failed to get workspace status: ${error.message}`);
        }
    }
}

// Export the class for instantiation
export { SharedWorkspaceMCPTools };