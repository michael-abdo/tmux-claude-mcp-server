#!/usr/bin/env node

/**
 * Atomic Git Operations
 * 
 * Provides atomic, all-or-nothing git operations with proper rollback capability.
 * Ensures git operations either complete fully or roll back to a clean state.
 * 
 * Key Features:
 * - Checkpoint creation before operations
 * - Automatic rollback on failure
 * - Operation logging and validation
 * - Clean error recovery
 */

import { GitBranchManager } from './git_branch_manager.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class AtomicGitOperations extends GitBranchManager {
    constructor() {
        super();
        this.checkpoints = new Map(); // Store checkpoints by workspace
    }

    /**
     * Create a checkpoint of current git state
     * @param {string} workspaceDir - Workspace directory
     * @returns {Promise<Object>} Checkpoint data
     */
    async createCheckpoint(workspaceDir) {
        try {
            // Get current branch
            const currentBranch = await this.getCurrentBranch(workspaceDir);
            
            // Get current commit SHA
            const { stdout: currentCommit } = await this.gitCommand('rev-parse HEAD', workspaceDir);
            
            // Get working tree status
            const { stdout: status } = await this.gitCommand('status --porcelain', workspaceDir);
            
            // Check for uncommitted changes
            const hasUncommittedChanges = status.trim().length > 0;
            
            // If there are uncommitted changes, stash them
            let stashName = null;
            if (hasUncommittedChanges) {
                stashName = `atomic-checkpoint-${Date.now()}`;
                await this.gitCommand(`stash push -m "${stashName}"`, workspaceDir);
                console.log(`Created stash: ${stashName}`);
            }
            
            const checkpoint = {
                workspaceDir,
                branch: currentBranch,
                commit: currentCommit.trim(),
                stashName,
                hasUncommittedChanges,
                timestamp: new Date().toISOString()
            };
            
            // Store checkpoint
            this.checkpoints.set(workspaceDir, checkpoint);
            
            console.log(`Created checkpoint at ${checkpoint.commit} on branch ${checkpoint.branch}`);
            return checkpoint;
        } catch (error) {
            throw new Error(`Failed to create checkpoint: ${error.message}`);
        }
    }

    /**
     * Rollback to a checkpoint
     * @param {string} workspaceDir - Workspace directory
     * @param {Object} checkpoint - Checkpoint to rollback to
     */
    async rollbackToCheckpoint(workspaceDir, checkpoint) {
        try {
            console.log(`Rolling back to checkpoint: ${checkpoint.commit} on ${checkpoint.branch}`);
            
            // First, ensure we're on the right branch
            const currentBranch = await this.getCurrentBranch(workspaceDir);
            if (currentBranch !== checkpoint.branch) {
                await this.gitCommand(`checkout ${checkpoint.branch}`, workspaceDir);
            }
            
            // Reset to checkpoint commit
            await this.gitCommand(`reset --hard ${checkpoint.commit}`, workspaceDir);
            
            // Restore stashed changes if any
            if (checkpoint.stashName) {
                try {
                    // Find the stash by name
                    const { stdout: stashList } = await this.gitCommand('stash list', workspaceDir);
                    const stashMatch = stashList.match(new RegExp(`(stash@\\{\\d+\\}).*${checkpoint.stashName}`));
                    
                    if (stashMatch) {
                        await this.gitCommand(`stash pop ${stashMatch[1]}`, workspaceDir);
                        console.log(`Restored stashed changes: ${checkpoint.stashName}`);
                    }
                } catch (error) {
                    console.warn(`Could not restore stash: ${error.message}`);
                }
            }
            
            console.log('Rollback completed successfully');
        } catch (error) {
            throw new Error(`Failed to rollback: ${error.message}`);
        }
    }

    /**
     * Execute atomic git operation
     * @param {string} workspaceDir - Workspace directory
     * @param {string} operationName - Name of the operation
     * @param {Array} operations - Array of operations to execute
     * @returns {Promise<Object>} Operation result
     */
    async atomicOperation(workspaceDir, operationName, operations) {
        const checkpoint = await this.createCheckpoint(workspaceDir);
        const results = [];
        
        try {
            console.log(`Starting atomic git operation: ${operationName}`);
            console.log(`Executing ${operations.length} operations...`);
            
            for (const [index, op] of operations.entries()) {
                const opName = op.name || `Operation ${index + 1}`;
                console.log(`  → Executing: ${opName}`);
                
                try {
                    const result = await op.fn();
                    results.push({ name: opName, success: true, result });
                    console.log(`  ✓ Completed: ${opName}`);
                } catch (error) {
                    console.error(`  ✗ Failed: ${opName} - ${error.message}`);
                    throw new Error(`Operation "${opName}" failed: ${error.message}`);
                }
            }
            
            console.log(`✓ Atomic operation completed: ${operationName}`);
            
            // Clear checkpoint on success
            this.checkpoints.delete(workspaceDir);
            
            return {
                success: true,
                operationName,
                results,
                checkpoint
            };
        } catch (error) {
            console.error(`✗ Atomic operation failed: ${operationName}`);
            console.error(`Error: ${error.message}`);
            console.log('Initiating rollback...');
            
            // Rollback on failure
            try {
                await this.rollbackToCheckpoint(workspaceDir, checkpoint);
                console.log('✓ Rollback completed');
            } catch (rollbackError) {
                console.error(`✗ Rollback failed: ${rollbackError.message}`);
                console.error('Manual intervention may be required');
            }
            
            return {
                success: false,
                operationName,
                error: error.message,
                results,
                checkpoint,
                rolledBack: true
            };
        }
    }

    /**
     * Validate operation preconditions
     * @param {string} workspaceDir - Workspace directory
     * @param {Array} validations - Array of validation functions
     * @returns {Promise<Object>} Validation result
     */
    async validatePreconditions(workspaceDir, validations) {
        const results = [];
        let allValid = true;
        
        console.log('Validating preconditions...');
        
        for (const validation of validations) {
            const name = validation.name || 'Validation';
            try {
                const result = await validation.fn(workspaceDir);
                if (result.valid) {
                    console.log(`  ✓ ${name}: ${result.message || 'Valid'}`);
                    results.push({ name, valid: true, message: result.message });
                } else {
                    console.log(`  ✗ ${name}: ${result.message || 'Invalid'}`);
                    results.push({ name, valid: false, message: result.message });
                    allValid = false;
                }
            } catch (error) {
                console.log(`  ✗ ${name}: ${error.message}`);
                results.push({ name, valid: false, error: error.message });
                allValid = false;
            }
        }
        
        return {
            valid: allValid,
            results
        };
    }

    /**
     * Common validation: Ensure clean working tree
     * @param {string} workspaceDir - Workspace directory
     * @returns {Promise<Object>} Validation result
     */
    async validateCleanWorkingTree(workspaceDir) {
        const { stdout: status } = await this.gitCommand('status --porcelain', workspaceDir);
        return {
            valid: status.trim().length === 0,
            message: status.trim() ? 'Working tree has uncommitted changes' : 'Working tree is clean'
        };
    }

    /**
     * Common validation: Ensure branch exists
     * @param {string} branch - Branch name
     * @param {string} workspaceDir - Workspace directory
     * @returns {Promise<Object>} Validation result
     */
    async validateBranchExists(branch, workspaceDir) {
        const exists = await this.branchExists(branch, workspaceDir);
        return {
            valid: exists,
            message: exists ? `Branch ${branch} exists` : `Branch ${branch} does not exist`
        };
    }

    /**
     * Common validation: Ensure no conflicts exist
     * @param {string} sourceBranch - Source branch
     * @param {string} targetBranch - Target branch
     * @param {string} workspaceDir - Workspace directory
     * @returns {Promise<Object>} Validation result
     */
    async validateNoConflicts(sourceBranch, targetBranch, workspaceDir) {
        try {
            // Attempt a dry-run merge
            await this.gitCommand(`merge --no-commit --no-ff ${sourceBranch}`, workspaceDir);
            // If successful, abort the merge
            await this.gitCommand('merge --abort', workspaceDir);
            return {
                valid: true,
                message: `No conflicts between ${sourceBranch} and ${targetBranch}`
            };
        } catch (error) {
            // Merge failed, likely due to conflicts
            try {
                await this.gitCommand('merge --abort', workspaceDir);
            } catch {}
            return {
                valid: false,
                message: `Conflicts detected between ${sourceBranch} and ${targetBranch}`
            };
        }
    }
}

// Export singleton instance
export const atomicGitOps = new AtomicGitOperations();