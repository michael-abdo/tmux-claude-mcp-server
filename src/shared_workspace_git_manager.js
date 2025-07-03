#!/usr/bin/env node

/**
 * Shared Workspace Git Manager
 * 
 * Implements automatic git branch management for shared workspace scenarios where
 * multiple managers collaborate in the same directory. Extends GitBranchManager
 * with manager-specific workflows and conflict resolution.
 * 
 * Key Features:
 * - Auto-create manager branches (manager-{instanceId})
 * - Conflict detection and smart merge strategies
 * - Coordinated workspace state management
 * - Recovery procedures for failed merges
 */

import { GitBranchManager } from './git_branch_manager.js';
import { atomicGitOps } from './atomic_git_operations.js';
import fs from 'fs/promises';
import path from 'path';

export class SharedWorkspaceGitManager extends GitBranchManager {
    constructor() {
        super();
        this.managerBranchPrefix = 'manager';
        this.conflictResolutionStrategies = ['auto', 'manual', 'theirs', 'ours'];
    }

    /**
     * Initialize a shared workspace for git collaboration
     * @param {string} workspaceDir - Shared workspace directory
     * @param {string} baseBranch - Base branch to work from (default: main/master)
     * @returns {Promise<Object>} Initialization result
     */
    async initializeSharedWorkspace(workspaceDir, baseBranch = null) {
        try {
            // Ensure git repository exists
            await this.ensureGitRepo(workspaceDir);
            
            // Get the base branch (main/master/current)
            const targetBranch = baseBranch || await this.getDefaultBranch(workspaceDir);
            
            // Ensure we're on the base branch and up to date
            await this.ensureCleanWorkingTree(workspaceDir);
            await this.gitCommand(`checkout ${targetBranch}`, workspaceDir);
            
            // Try to pull latest changes
            try {
                await this.gitCommand(`pull origin ${targetBranch}`, workspaceDir);
            } catch {
                console.log('No remote origin or pull failed - working locally');
            }
            
            // Create workspace git configuration
            await this.setupSharedWorkspaceGitConfig(workspaceDir);
            
            console.log(`Initialized shared workspace git at ${workspaceDir} with base branch ${targetBranch}`);
            
            return {
                workspaceDir,
                baseBranch: targetBranch,
                status: 'initialized'
            };
        } catch (error) {
            console.error(`Failed to initialize shared workspace: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create and checkout a manager branch for shared workspace collaboration
     * @param {Object} options - Manager branch options
     * @param {string} options.instanceId - Manager instance ID
     * @param {string} options.workspaceDir - Shared workspace directory
     * @param {string} options.baseBranch - Base branch to branch from
     * @param {string} options.taskDescription - Description of manager's task
     * @returns {Promise<Object>} Created branch info
     */
    async createManagerBranch(options) {
        const { instanceId, workspaceDir, baseBranch, taskDescription = 'Manager task' } = options;
        const branchName = this.generateManagerBranchName(instanceId);
        
        // Check if branch already exists
        if (await this.branchExists(branchName, workspaceDir)) {
            console.log(`Manager branch ${branchName} already exists, checking out...`);
            await this.gitCommand(`checkout ${branchName}`, workspaceDir);
            return {
                branchName,
                status: 'existing',
                workspaceDir
            };
        }
        
        // Use atomic operations for branch creation
        const targetBaseBranch = baseBranch || await this.getDefaultBranch(workspaceDir);
        
        const result = await atomicGitOps.atomicOperation(
            workspaceDir,
            `create-manager-branch-${instanceId}`,
            [
                {
                    name: 'checkout-base-branch',
                    fn: async () => {
                        await this.gitCommand(`checkout ${targetBaseBranch}`, workspaceDir);
                        return { branch: targetBaseBranch };
                    }
                },
                {
                    name: 'ensure-clean-tree',
                    fn: async () => {
                        await this.ensureCleanWorkingTree(workspaceDir);
                        return { status: 'clean' };
                    }
                },
                {
                    name: 'create-branch',
                    fn: async () => {
                        await this.gitCommand(`checkout -b ${branchName} ${targetBaseBranch}`, workspaceDir);
                        console.log(`Created and checked out branch: ${branchName}`);
                        return { branchName };
                    }
                },
                {
                    name: 'push-to-remote',
                    fn: async () => {
                        try {
                            await this.gitCommand(`push -u origin ${branchName}`, workspaceDir);
                            return { pushed: true };
                        } catch {
                            console.log('No remote origin - working locally');
                            return { pushed: false };
                        }
                    }
                },
                {
                    name: 'create-initial-commit',
                    fn: async () => {
                        await this.createManagerInitialCommit(instanceId, workspaceDir, taskDescription);
                        return { committed: true };
                    }
                }
            ]
        );
        
        if (result.success) {
            console.log(`Created manager branch: ${branchName}`);
            return {
                branchName,
                status: 'created',
                workspaceDir,
                baseBranch: targetBaseBranch
            };
        } else {
            throw new Error(`Failed to create manager branch: ${result.error}`);
        }
    }

    /**
     * Coordinate merge of manager work back to base branch
     * @param {Object} options - Merge options
     * @param {string} options.managerBranch - Manager branch to merge
     * @param {string} options.targetBranch - Target branch (usually main/master)
     * @param {string} options.workspaceDir - Workspace directory
     * @param {string} options.strategy - Merge strategy ('auto', 'manual', 'theirs', 'ours')
     * @param {boolean} options.deleteBranch - Delete branch after successful merge
     * @returns {Promise<Object>} Merge result
     */
    async coordinatedMerge(options) {
        const { 
            managerBranch, 
            targetBranch, 
            workspaceDir, 
            strategy = 'auto',
            deleteBranch = false 
        } = options;
        
        // Pre-merge validations
        const validationResult = await atomicGitOps.validatePreconditions(workspaceDir, [
            {
                name: 'Manager branch exists',
                fn: () => atomicGitOps.validateBranchExists(managerBranch, workspaceDir)
            },
            {
                name: 'Target branch exists',
                fn: () => atomicGitOps.validateBranchExists(targetBranch, workspaceDir)
            },
            {
                name: 'Working tree clean',
                fn: () => atomicGitOps.validateCleanWorkingTree(workspaceDir)
            }
        ]);
        
        if (!validationResult.valid) {
            const failedValidations = validationResult.results
                .filter(r => !r.valid)
                .map(r => r.message || r.error)
                .join(', ');
            return {
                success: false,
                status: 'validation_failed',
                error: `Pre-merge validation failed: ${failedValidations}`
            };
        }
        
        // Use atomic operations for the merge
        const mergeResult = await atomicGitOps.atomicOperation(
            workspaceDir,
            `merge-${managerBranch}-to-${targetBranch}`,
            [
                {
                    name: 'checkout-target-branch',
                    fn: async () => {
                        await this.gitCommand(`checkout ${targetBranch}`, workspaceDir);
                        return { branch: targetBranch };
                    }
                },
                {
                    name: 'pull-latest-changes',
                    fn: async () => {
                        await this.pullLatestChanges(targetBranch, workspaceDir);
                        return { updated: true };
                    }
                },
                {
                    name: 'analyze-conflicts',
                    fn: async () => {
                        const conflictAnalysis = await this.analyzeConflicts(managerBranch, targetBranch, workspaceDir);
                        
                        if (conflictAnalysis.hasConflicts && strategy === 'auto') {
                            const resolveResult = await this.smartConflictResolution(conflictAnalysis, workspaceDir);
                            if (!resolveResult.success) {
                                throw new Error(`Conflicts detected - manual resolution required: ${conflictAnalysis.conflicts.join(', ')}`);
                            }
                        }
                        
                        return { conflicts: conflictAnalysis.hasConflicts, resolved: true };
                    }
                },
                {
                    name: 'perform-merge',
                    fn: async () => {
                        const result = await this.performMerge(managerBranch, targetBranch, workspaceDir, strategy);
                        if (!result.success) {
                            throw new Error(`Merge failed: ${result.error}`);
                        }
                        return result;
                    }
                },
                {
                    name: 'post-merge-cleanup',
                    fn: async () => {
                        const cleanup = {};
                        
                        if (deleteBranch) {
                            await this.deleteManagerBranch(managerBranch, workspaceDir);
                            cleanup.branchDeleted = true;
                        }
                        
                        await this.updateWorkspaceAfterMerge(workspaceDir, managerBranch);
                        cleanup.workspaceUpdated = true;
                        
                        return cleanup;
                    }
                }
            ]
        );
        
        if (mergeResult.success) {
            console.log(`Successfully merged ${managerBranch} into ${targetBranch}`);
            return {
                success: true,
                status: 'merged',
                strategy: strategy,
                branchDeleted: deleteBranch,
                details: mergeResult.results
            };
        } else {
            console.error(`Coordinated merge failed: ${mergeResult.error}`);
            return {
                success: false,
                status: 'error',
                error: mergeResult.error,
                rolledBack: mergeResult.rolledBack
            };
        }
    }

    /**
     * Detect and analyze potential conflicts between branches
     * @param {string} sourceBranch - Source branch
     * @param {string} targetBranch - Target branch  
     * @param {string} workspaceDir - Workspace directory
     * @returns {Promise<Object>} Conflict analysis
     */
    async analyzeConflicts(sourceBranch, targetBranch, workspaceDir) {
        try {
            // Get merge base
            const mergeBase = await this.gitCommand(
                `merge-base ${targetBranch} ${sourceBranch}`, 
                workspaceDir
            );
            
            // Check for differences that might conflict
            const diffResult = await this.gitCommand(
                `diff --name-only ${mergeBase.stdout.trim()}...${sourceBranch}`,
                workspaceDir
            );
            
            const changedFiles = diffResult.stdout.trim().split('\n').filter(f => f);
            
            // Check if target branch has changes to same files
            const targetDiff = await this.gitCommand(
                `diff --name-only ${mergeBase.stdout.trim()}...${targetBranch}`,
                workspaceDir
            );
            
            const targetChangedFiles = targetDiff.stdout.trim().split('\n').filter(f => f);
            
            // Find overlapping files
            const conflictingFiles = changedFiles.filter(file => targetChangedFiles.includes(file));
            
            return {
                hasConflicts: conflictingFiles.length > 0,
                conflicts: conflictingFiles,
                sourceChanges: changedFiles,
                targetChanges: targetChangedFiles,
                mergeBase: mergeBase.stdout.trim()
            };
        } catch (error) {
            console.error(`Error analyzing conflicts: ${error.message}`);
            return { hasConflicts: false, conflicts: [], error: error.message };
        }
    }

    /**
     * Attempt smart conflict resolution
     * @param {Object} conflictAnalysis - Conflict analysis results
     * @param {string} workspaceDir - Workspace directory
     * @returns {Promise<Object>} Resolution result
     */
    async smartConflictResolution(conflictAnalysis, workspaceDir) {
        try {
            const { conflicts } = conflictAnalysis;
            const resolvableConflicts = [];
            const manualConflicts = [];
            
            for (const file of conflicts) {
                // Check if it's an auto-resolvable file type
                if (this.isAutoResolvable(file)) {
                    resolvableConflicts.push(file);
                } else {
                    manualConflicts.push(file);
                }
            }
            
            // If we have any manual conflicts, we can't auto-resolve
            if (manualConflicts.length > 0) {
                return {
                    success: false,
                    resolvable: resolvableConflicts,
                    manual: manualConflicts,
                    strategy: 'manual_required'
                };
            }
            
            // Try to auto-resolve all conflicts
            for (const file of resolvableConflicts) {
                await this.autoResolveFile(file, workspaceDir);
            }
            
            return {
                success: true,
                resolved: resolvableConflicts,
                strategy: 'auto_resolved'
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate manager branch name
     * @param {string} instanceId - Manager instance ID
     * @returns {string} Branch name
     */
    generateManagerBranchName(instanceId) {
        return `${this.managerBranchPrefix}-${instanceId}`;
    }

    /**
     * Get the default branch (main, master, or current)
     * @param {string} workspaceDir - Workspace directory
     * @returns {Promise<string>} Default branch name
     */
    async getDefaultBranch(workspaceDir) {
        try {
            // Try to get default branch from remote
            try {
                const result = await this.gitCommand('symbolic-ref refs/remotes/origin/HEAD', workspaceDir);
                return result.stdout.trim().replace('refs/remotes/origin/', '');
            } catch {
                // Fallback to common default branches
                for (const branch of ['main', 'master']) {
                    if (await this.branchExists(branch, workspaceDir)) {
                        return branch;
                    }
                }
                // Fallback to current branch
                return await this.getCurrentBranch(workspaceDir);
            }
        } catch (error) {
            throw new Error(`Could not determine default branch: ${error.message}`);
        }
    }

    /**
     * Parse git status output into structured data
     * @param {string} statusOutput - Raw git status --porcelain output
     * @returns {Array} Array of file status objects
     */
    parseGitStatus(statusOutput) {
        return statusOutput
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
                // Git status format: "XY filename" where XY are status codes
                const match = line.match(/^(.)(.) (.+)$/);
                if (!match) return null;
                
                const [, staged, unstaged, filename] = match;
                return {
                    filename,
                    staged: staged !== ' ',
                    unstaged: unstaged !== ' ',
                    isNew: staged === 'A' || unstaged === '?'
                };
            })
            .filter(Boolean);
    }

    /**
     * Check if a file is workspace-generated and should be auto-committed
     * @param {string} filename - File name to check
     * @returns {boolean} True if workspace-generated file
     */
    isWorkspaceGeneratedFile(filename) {
        const workspacePatterns = [
            /^\.claude\//,                        // Any file in .claude/ directory
            /^SHARED_WORKSPACE\.md$/,             // Workspace marker file
            /^\.managers\//,                      // Any file in .managers/ directory
            /^\.gitattributes$/                   // Git merge strategy file
        ];
        
        return workspacePatterns.some(pattern => pattern.test(filename));
    }

    /**
     * Commit workspace-generated files with proper verification
     * @param {string} workspaceDir - Workspace directory
     * @param {Array} workspaceFiles - Array of workspace files to commit
     */
    async commitWorkspaceFiles(workspaceDir, workspaceFiles) {
        try {
            // Stage only workspace files
            for (const file of workspaceFiles) {
                await this.gitCommand(`add "${file.filename}"`, workspaceDir);
            }
            
            // Commit with clear message
            await this.gitCommand(`commit -m "chore: Initialize shared workspace structure

Files created:
${workspaceFiles.map(f => `- ${f.filename}`).join('\n')}

This commit sets up the shared workspace infrastructure for manager collaboration."`, workspaceDir);
            
            console.log(`Committed ${workspaceFiles.length} workspace setup files`);
        } catch (error) {
            console.warn(`Could not commit workspace files: ${error.message}`);
            throw error;
        }
    }

    /**
     * Ensure working tree is clean (or handle auto-generated files)
     * @param {string} workspaceDir - Workspace directory
     */
    async ensureCleanWorkingTree(workspaceDir) {
        try {
            const status = await this.gitCommand('status --porcelain', workspaceDir);
            const files = this.parseGitStatus(status.stdout);
            
            const workspaceFiles = files.filter(f => this.isWorkspaceGeneratedFile(f.filename));
            const otherFiles = files.filter(f => !this.isWorkspaceGeneratedFile(f.filename));
            
            if (otherFiles.length > 0) {
                throw new Error(`Working tree has uncommitted changes: ${otherFiles.map(f => f.filename).join(', ')}`);
            }
            
            if (workspaceFiles.length > 0) {
                await this.commitWorkspaceFiles(workspaceDir, workspaceFiles);
            }
        } catch (error) {
            if (error.message.includes('Working tree has uncommitted changes')) {
                throw error;
            }
            // For other errors, log but don't fail
            console.warn(`Working tree check warning: ${error.message}`);
        }
    }

    /**
     * Setup git configuration for shared workspace
     * @param {string} workspaceDir - Workspace directory
     */
    async setupSharedWorkspaceGitConfig(workspaceDir) {
        try {
            // Create .gitattributes for better merge handling
            const gitattributes = `# Shared workspace merge strategies
*.md merge=union
*.json merge=union
package.json merge=ours
package-lock.json merge=ours
`;
            await fs.writeFile(path.join(workspaceDir, '.gitattributes'), gitattributes);
            
            // Set up merge drivers
            await this.gitCommand('config merge.ours.driver true', workspaceDir);
            
            console.log('Set up shared workspace git configuration');
        } catch (error) {
            console.warn(`Warning: Could not set up git config: ${error.message}`);
        }
    }

    /**
     * Check if a file type is auto-resolvable
     * @param {string} filename - File name
     * @returns {boolean} True if auto-resolvable
     */
    isAutoResolvable(filename) {
        const autoResolvableExtensions = ['.md', '.json', '.txt'];
        const nonResolvableFiles = ['package.json', 'package-lock.json', '.gitignore'];
        
        if (nonResolvableFiles.includes(path.basename(filename))) {
            return false;
        }
        
        const ext = path.extname(filename).toLowerCase();
        return autoResolvableExtensions.includes(ext);
    }

    /**
     * Create initial commit for manager branch
     * @param {string} instanceId - Manager instance ID
     * @param {string} workspaceDir - Workspace directory
     * @param {string} taskDescription - Task description
     */
    async createManagerInitialCommit(instanceId, workspaceDir, taskDescription) {
        try {
            // Create manager marker file
            const managerFile = path.join(workspaceDir, '.managers', instanceId, 'MANAGER_BRANCH.md');
            await fs.mkdir(path.dirname(managerFile), { recursive: true });
            
            const content = `# Manager Branch: ${instanceId}

## Task Description
${taskDescription}

## Branch Info
- Created: ${new Date().toISOString()}
- Manager: ${instanceId}
- Type: Shared workspace collaboration

## Guidelines
- This branch represents work by manager ${instanceId}
- Coordinate with other managers via MCP messages
- Use descriptive commit messages
- Test changes before merging
`;
            
            await fs.writeFile(managerFile, content);
            
            // Commit the marker file
            await this.gitCommand(`add "${managerFile}"`, workspaceDir);
            await this.gitCommand(
                `commit -m "feat: Initialize manager branch for ${instanceId}

${taskDescription}

Manager: ${instanceId}
Type: Shared workspace collaboration"`,
                workspaceDir
            );
            
            console.log(`Created initial commit for manager ${instanceId}`);
        } catch (error) {
            console.warn(`Could not create initial commit: ${error.message}`);
        }
    }

    /**
     * Additional helper methods for merge operations, conflict resolution, etc.
     * (Implementation continues with specific merge strategies, validation, cleanup, etc.)
     */

    async validateMergeConditions(sourceBranch, targetBranch, workspaceDir) {
        // Validate that branches exist, are up to date, etc.
        if (!await this.branchExists(sourceBranch, workspaceDir)) {
            throw new Error(`Source branch ${sourceBranch} does not exist`);
        }
        if (!await this.branchExists(targetBranch, workspaceDir)) {
            throw new Error(`Target branch ${targetBranch} does not exist`);
        }
    }

    async pullLatestChanges(branch, workspaceDir) {
        try {
            await this.gitCommand(`pull origin ${branch}`, workspaceDir);
        } catch (error) {
            console.log(`Could not pull from origin: ${error.message}`);
        }
    }

    async performMerge(sourceBranch, targetBranch, workspaceDir, strategy) {
        try {
            let mergeCommand = `merge --no-ff ${sourceBranch} -m "Merge manager branch ${sourceBranch} into ${targetBranch}"`;
            
            if (strategy === 'theirs') {
                mergeCommand = `merge -X theirs ${sourceBranch}`;
            } else if (strategy === 'ours') {
                mergeCommand = `merge -X ours ${sourceBranch}`;
            }
            
            await this.gitCommand(mergeCommand, workspaceDir);
            
            return {
                success: true,
                status: 'merged',
                strategy: strategy
            };
        } catch (error) {
            return {
                success: false,
                status: 'merge_failed',
                error: error.message
            };
        }
    }

    async deleteManagerBranch(branchName, workspaceDir) {
        try {
            await this.gitCommand(`branch -d ${branchName}`, workspaceDir);
            console.log(`Deleted manager branch: ${branchName}`);
        } catch (error) {
            console.warn(`Could not delete branch ${branchName}: ${error.message}`);
        }
    }

    async updateWorkspaceAfterMerge(workspaceDir, managerBranch) {
        // Update SHARED_WORKSPACE.md or other markers after successful merge
        console.log(`Updated workspace after merging ${managerBranch}`);
    }

    async autoResolveFile(filename, workspaceDir) {
        // Implement auto-resolution strategies for specific file types
        console.log(`Auto-resolving conflicts in ${filename}`);
    }
}

// Export singleton instance
export const sharedWorkspaceGitManager = new SharedWorkspaceGitManager();