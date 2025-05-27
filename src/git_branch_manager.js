#!/usr/bin/env node

/**
 * Git Branch Manager
 * 
 * Implements automatic branch creation and management for specialist instances.
 * Follows the pattern: specialist-{instance_id}-{task_id}-{feature}
 * 
 * From architecture docs: "Branch-first Git strategy for parallel-ready development"
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export class GitBranchManager {
    constructor() {
        this.branchPrefix = 'specialist';
        this.worktreeSuffix = '-worktrees';
    }

    /**
     * Create a worktree for a specialist with isolated workspace
     * @param {Object} options - Worktree creation options
     * @param {string} options.instanceId - Instance ID
     * @param {string} options.taskId - Task ID
     * @param {string} options.feature - Feature name
     * @param {string} options.workDir - Base working directory
     * @param {string} options.baseBranch - Base branch to create from (default: current)
     * @returns {Promise<Object>} Created worktree info {branchName, worktreePath}
     */
    async createSpecialistWorktree(options) {
        const { instanceId, taskId, feature, workDir, baseBranch } = options;
        
        // Generate branch name
        const branchName = this.generateBranchName(instanceId, taskId, feature);
        
        // Generate worktree path
        const worktreeDir = `${path.basename(workDir)}${this.worktreeSuffix}`;
        const worktreePath = path.join(path.dirname(workDir), worktreeDir, `${instanceId}_${taskId}`);
        
        try {
            // Ensure we're in a git repository
            await this.ensureGitRepo(workDir);
            
            // Fetch latest changes (only if origin exists)
            try {
                await this.gitCommand('remote get-url origin', workDir);
                await this.gitCommand('fetch origin', workDir);
            } catch {
                // No origin remote, working locally
                console.log('Working in local repository (no origin)');
            }
            
            // Get current branch if no base branch specified
            const currentBranch = baseBranch || await this.getCurrentBranch(workDir);
            
            // Ensure worktree parent directory exists
            const worktreeParentDir = path.dirname(worktreePath);
            await fs.mkdir(worktreeParentDir, { recursive: true });
            
            // Create worktree with new branch
            await this.gitCommand(
                `worktree add "${worktreePath}" -b ${branchName} ${currentBranch}`,
                workDir
            );
            
            console.log(`Created worktree at: ${worktreePath}`);
            console.log(`With branch: ${branchName}`);
            
            return {
                branchName,
                worktreePath,
                worktreeRelative: path.relative(workDir, worktreePath)
            };
        } catch (error) {
            console.error(`Error creating worktree: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create and checkout a new branch for a specialist (legacy method)
     * @deprecated Use createSpecialistWorktree instead
     * @param {Object} options - Branch creation options
     * @param {string} options.instanceId - Instance ID
     * @param {string} options.taskId - Task ID
     * @param {string} options.feature - Feature name
     * @param {string} options.workDir - Working directory
     * @param {string} options.baseBranch - Base branch to create from (default: current)
     * @returns {Promise<string>} Created branch name
     */
    async createSpecialistBranch(options) {
        const { instanceId, taskId, feature, workDir, baseBranch } = options;
        
        // Generate branch name
        const branchName = this.generateBranchName(instanceId, taskId, feature);
        
        try {
            // Ensure we're in a git repository
            await this.ensureGitRepo(workDir);
            
            // Fetch latest changes (only if origin exists)
            try {
                await this.gitCommand('remote get-url origin', workDir);
                await this.gitCommand('fetch origin', workDir);
            } catch {
                // No origin remote, working locally
                console.log('Working in local repository (no origin)');
            }
            
            // Get current branch if no base branch specified
            const currentBranch = baseBranch || await this.getCurrentBranch(workDir);
            
            // Create and checkout new branch
            await this.gitCommand(`checkout -b ${branchName} ${currentBranch}`, workDir);
            
            console.log(`Created and checked out branch: ${branchName}`);
            
            // Set upstream for easy pushing
            await this.gitCommand(`branch --set-upstream-to=origin/${currentBranch} ${branchName}`, workDir).catch(() => {
                // Ignore error if upstream doesn't exist
            });
            
            return branchName;
        } catch (error) {
            console.error(`Error creating branch: ${error.message}`);
            throw error;
        }
    }

    /**
     * Generate branch name following the pattern
     * @param {string} instanceId - Instance ID
     * @param {string} taskId - Task ID
     * @param {string} feature - Feature name
     * @returns {string} Branch name
     */
    generateBranchName(instanceId, taskId, feature) {
        // Sanitize inputs
        const sanitizedFeature = feature
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        
        return `${this.branchPrefix}-${instanceId}-${taskId}-${sanitizedFeature}`;
    }

    /**
     * Get current branch name
     * @param {string} workDir - Working directory
     * @returns {Promise<string>} Current branch name
     */
    async getCurrentBranch(workDir) {
        const result = await this.gitCommand('rev-parse --abbrev-ref HEAD', workDir);
        return result.stdout.trim();
    }

    /**
     * Check if a branch exists
     * @param {string} branchName - Branch name
     * @param {string} workDir - Working directory
     * @returns {Promise<boolean>} True if branch exists
     */
    async branchExists(branchName, workDir) {
        try {
            await this.gitCommand(`rev-parse --verify ${branchName}`, workDir);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Ensure directory is a git repository
     * @param {string} workDir - Working directory
     */
    async ensureGitRepo(workDir) {
        try {
            await this.gitCommand('rev-parse --git-dir', workDir);
        } catch {
            throw new Error(`Not a git repository: ${workDir}`);
        }
    }

    /**
     * Execute git command
     * @param {string} command - Git command
     * @param {string} workDir - Working directory
     * @returns {Promise<Object>} Command output
     */
    async gitCommand(command, workDir) {
        const fullCommand = `git ${command}`;
        console.log(`Executing: ${fullCommand} in ${workDir}`);
        
        const result = await execAsync(fullCommand, {
            cwd: workDir,
            encoding: 'utf-8'
        });
        
        return result;
    }

    /**
     * Setup branch protection for specialists
     * @param {string} instanceId - Instance ID
     * @param {string} workDir - Working directory
     */
    async setupBranchProtection(instanceId, workDir) {
        try {
            // Add pre-commit hook to prevent direct commits to main/master
            const hookContent = `#!/bin/sh
# Prevent specialists from committing to main/master
current_branch=$(git rev-parse --abbrev-ref HEAD)
protected_branches="main master"

for branch in $protected_branches; do
    if [ "$current_branch" = "$branch" ]; then
        echo "Error: Direct commits to $branch are not allowed for specialist ${instanceId}"
        echo "Please use your designated branch"
        exit 1
    fi
done
`;
            
            const hookPath = path.join(workDir, '.git', 'hooks', 'pre-commit');
            await fs.writeFile(hookPath, hookContent);
            await fs.chmod(hookPath, '755');
            
            console.log(`Set up branch protection for ${instanceId}`);
        } catch (error) {
            console.error(`Error setting up branch protection: ${error.message}`);
        }
    }

    /**
     * Merge specialist branch back to parent
     * @param {Object} options - Merge options
     * @param {string} options.branchName - Branch to merge
     * @param {string} options.targetBranch - Target branch
     * @param {string} options.workDir - Working directory
     * @param {boolean} options.deleteBranch - Delete branch after merge
     * @returns {Promise<boolean>} True if merge successful
     */
    async mergeSpecialistWork(options) {
        const { branchName, targetBranch, workDir, deleteBranch = false } = options;
        
        try {
            // Checkout target branch
            await this.gitCommand(`checkout ${targetBranch}`, workDir);
            
            // Pull latest changes
            await this.gitCommand(`pull origin ${targetBranch}`, workDir).catch(() => {
                // Ignore if no upstream
            });
            
            // Merge specialist branch
            await this.gitCommand(`merge --no-ff ${branchName} -m "Merge ${branchName} into ${targetBranch}"`, workDir);
            
            console.log(`Successfully merged ${branchName} into ${targetBranch}`);
            
            // Delete branch if requested
            if (deleteBranch) {
                await this.gitCommand(`branch -d ${branchName}`, workDir);
                console.log(`Deleted branch ${branchName}`);
            }
            
            return true;
        } catch (error) {
            console.error(`Error merging branch: ${error.message}`);
            return false;
        }
    }

    /**
     * Remove a specialist worktree and optionally its branch
     * @param {Object} options - Removal options
     * @param {string} options.worktreePath - Path to the worktree
     * @param {string} options.branchName - Branch name
     * @param {string} options.workDir - Base working directory
     * @param {boolean} options.force - Force removal even if there are changes
     * @returns {Promise<boolean>} True if removal successful
     */
    async removeSpecialistWorktree(options) {
        const { worktreePath, branchName, workDir, force = false } = options;
        
        try {
            // Remove the worktree
            const forceFlag = force ? '--force' : '';
            await this.gitCommand(`worktree remove ${forceFlag} "${worktreePath}"`, workDir);
            console.log(`Removed worktree: ${worktreePath}`);
            
            // Try to delete the branch (may fail if not fully merged)
            try {
                await this.gitCommand(`branch -d ${branchName}`, workDir);
                console.log(`Deleted branch: ${branchName}`);
            } catch (error) {
                if (force) {
                    await this.gitCommand(`branch -D ${branchName}`, workDir);
                    console.log(`Force deleted branch: ${branchName}`);
                } else {
                    console.log(`Branch ${branchName} not deleted (not fully merged)`);
                }
            }
            
            return true;
        } catch (error) {
            console.error(`Error removing worktree: ${error.message}`);
            return false;
        }
    }

    /**
     * List all worktrees
     * @param {string} workDir - Working directory
     * @returns {Promise<Array>} List of worktrees with their details
     */
    async listWorktrees(workDir) {
        try {
            const result = await this.gitCommand('worktree list --porcelain', workDir);
            const worktrees = [];
            const lines = result.stdout.split('\n');
            
            let currentWorktree = {};
            for (const line of lines) {
                if (line.startsWith('worktree ')) {
                    if (currentWorktree.path) {
                        worktrees.push(currentWorktree);
                    }
                    currentWorktree = { path: line.substring(9) };
                } else if (line.startsWith('HEAD ')) {
                    currentWorktree.head = line.substring(5);
                } else if (line.startsWith('branch ')) {
                    currentWorktree.branch = line.substring(7);
                } else if (line.startsWith('detached')) {
                    currentWorktree.detached = true;
                }
            }
            
            if (currentWorktree.path) {
                worktrees.push(currentWorktree);
            }
            
            return worktrees;
        } catch (error) {
            console.error(`Error listing worktrees: ${error.message}`);
            return [];
        }
    }

    /**
     * Prune stale worktrees
     * @param {string} workDir - Working directory
     * @returns {Promise<number>} Number of pruned worktrees
     */
    async pruneWorktrees(workDir) {
        try {
            const result = await this.gitCommand('worktree prune -v', workDir);
            const pruned = (result.stdout.match(/Removing worktrees/g) || []).length;
            console.log(`Pruned ${pruned} stale worktrees`);
            return pruned;
        } catch (error) {
            console.error(`Error pruning worktrees: ${error.message}`);
            return 0;
        }
    }

    /**
     * Check if a worktree exists
     * @param {string} worktreePath - Path to check
     * @param {string} workDir - Working directory
     * @returns {Promise<boolean>} True if worktree exists
     */
    async worktreeExists(worktreePath, workDir) {
        const worktrees = await this.listWorktrees(workDir);
        return worktrees.some(w => w.path === worktreePath);
    }

    /**
     * List all specialist branches
     * @param {string} workDir - Working directory
     * @returns {Promise<Array>} List of specialist branches
     */
    async listSpecialistBranches(workDir) {
        const result = await this.gitCommand('branch -a', workDir);
        const branches = result.stdout
            .split('\n')
            .map(b => b.trim().replace('* ', ''))
            .filter(b => b.startsWith(this.branchPrefix));
        
        return branches;
    }
}

// Export singleton instance
export const gitBranchManager = new GitBranchManager();

// Import fs for branch protection
import fs from 'fs/promises';