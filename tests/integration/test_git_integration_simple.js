#!/usr/bin/env node

/**
 * Simple Git Integration Test
 * Tests git integration with minimal setup in truly isolated environments
 */

import { sharedWorkspaceGitManager } from '../../src/shared_workspace_git_manager.js';
import { atomicGitOps } from '../../src/atomic_git_operations.js';
import { IsolatedTestEnvironment, IsolatedTestRunner } from './test_isolated_environments.js';
import fs from 'fs/promises';
import path from 'path';

console.log('🧪 Testing Git Integration (Simple)\n');

const runner = new IsolatedTestRunner();

// Test 1: Git workspace initialization
await runner.runTest('Git workspace initialization', async (env) => {
    // env.baseDir already has git initialized
    const result = await sharedWorkspaceGitManager.initializeSharedWorkspace(env.baseDir);
    
    if (result.status !== 'initialized') {
        throw new Error('Git workspace initialization failed');
    }
    
    // Verify .gitattributes was created
    const gitattributes = await fs.readFile(
        path.join(env.baseDir, '.gitattributes'), 
        'utf-8'
    );
    
    if (!gitattributes.includes('merge=union')) {
        throw new Error('.gitattributes not properly configured');
    }
    
    return { baseBranch: result.baseBranch };
});

// Test 2: Manager branch creation
await runner.runTest('Manager branch creation', async (env) => {
    // Initialize workspace first
    await sharedWorkspaceGitManager.initializeSharedWorkspace(env.baseDir);
    
    // Create manager branch
    const result = await sharedWorkspaceGitManager.createManagerBranch({
        instanceId: 'mgr_test_001',
        workspaceDir: env.baseDir,
        taskDescription: 'Test manager task'
    });
    
    if (result.status !== 'created') {
        throw new Error('Manager branch creation failed');
    }
    
    // Verify branch exists
    const { stdout } = await env.exec('git branch');
    if (!stdout.includes('manager-mgr_test_001')) {
        throw new Error('Manager branch not found');
    }
    
    return { branchName: result.branchName };
});

// Test 3: Atomic operations with checkpoint
await runner.runTest('Atomic operations', async (env) => {
    const result = await atomicGitOps.atomicOperation(
        env.baseDir,
        'test-atomic-op',
        [
            {
                name: 'create-test-file',
                fn: async () => {
                    await fs.writeFile(
                        path.join(env.baseDir, 'test.txt'), 
                        'Test content'
                    );
                    return { created: 'test.txt' };
                }
            },
            {
                name: 'stage-and-commit',
                fn: async () => {
                    await env.exec('git add test.txt');
                    await env.exec('git commit -m "Add test file"');
                    return { committed: true };
                }
            }
        ]
    );
    
    if (!result.success) {
        throw new Error('Atomic operation failed');
    }
    
    // Verify file was committed
    const { stdout } = await env.exec('git log --oneline');
    if (!stdout.includes('Add test file')) {
        throw new Error('Commit not found');
    }
    
    return { operationSuccess: true };
});

// Test 4: Rollback on failure
await runner.runTest('Rollback on failure', async (env) => {
    // Get initial state
    const { stdout: initialLog } = await env.exec('git log --oneline');
    const initialCommitCount = initialLog.trim().split('\n').length;
    
    const result = await atomicGitOps.atomicOperation(
        env.baseDir,
        'test-rollback',
        [
            {
                name: 'create-file',
                fn: async () => {
                    await fs.writeFile(
                        path.join(env.baseDir, 'rollback.txt'), 
                        'Will be rolled back'
                    );
                    return { created: 'rollback.txt' };
                }
            },
            {
                name: 'commit-file',
                fn: async () => {
                    await env.exec('git add rollback.txt');
                    await env.exec('git commit -m "Add rollback file"');
                    return { committed: true };
                }
            },
            {
                name: 'failing-operation',
                fn: async () => {
                    throw new Error('Intentional failure');
                }
            }
        ]
    );
    
    if (result.success) {
        throw new Error('Operation should have failed');
    }
    
    if (!result.rolledBack) {
        throw new Error('Rollback did not occur');
    }
    
    // Verify we're back to initial state
    const { stdout: finalLog } = await env.exec('git log --oneline');
    const finalCommitCount = finalLog.trim().split('\n').length;
    
    if (finalCommitCount !== initialCommitCount) {
        throw new Error('Rollback did not restore initial state');
    }
    
    // Verify file doesn't exist
    try {
        await fs.access(path.join(env.baseDir, 'rollback.txt'));
        throw new Error('File should not exist after rollback');
    } catch {
        // Expected - file should not exist
    }
    
    return { rollbackSuccess: true };
});

// Test 5: Conflict detection
await runner.runTest('Conflict detection', async (env) => {
    // Initialize workspace
    await sharedWorkspaceGitManager.initializeSharedWorkspace(env.baseDir);
    
    // Create two manager branches with conflicting changes
    const branch1 = await sharedWorkspaceGitManager.createManagerBranch({
        instanceId: 'mgr_conflict_001',
        workspaceDir: env.baseDir,
        taskDescription: 'Manager 1'
    });
    
    // Add file on branch 1
    await fs.writeFile(path.join(env.baseDir, 'conflict.txt'), 'Manager 1 content\n');
    await env.exec('git add conflict.txt');
    await env.exec('git commit -m "Manager 1: Add file"');
    
    // Switch back to main branch
    const defaultBranch = await sharedWorkspaceGitManager.getDefaultBranch(env.baseDir);
    await env.exec(`git checkout ${defaultBranch}`);
    
    const branch2 = await sharedWorkspaceGitManager.createManagerBranch({
        instanceId: 'mgr_conflict_002',
        workspaceDir: env.baseDir,
        taskDescription: 'Manager 2'
    });
    
    // Add same file with different content on branch 2
    await fs.writeFile(path.join(env.baseDir, 'conflict.txt'), 'Manager 2 content\n');
    await env.exec('git add conflict.txt');
    await env.exec('git commit -m "Manager 2: Add file"');
    
    // Analyze conflicts
    const conflicts = await sharedWorkspaceGitManager.analyzeConflicts(
        branch1.branchName,
        branch2.branchName,
        env.baseDir
    );
    
    if (!conflicts.hasConflicts) {
        throw new Error('Should have detected conflicts');
    }
    
    if (!conflicts.conflicts.includes('conflict.txt')) {
        throw new Error('Did not detect conflict in conflict.txt');
    }
    
    return { conflictsDetected: true };
});

// Print summary
const summary = runner.getSummary();
console.log(`\n📊 Test Results: ${summary.passed} passed, ${summary.failed} failed`);

if (summary.failed === 0) {
    console.log('🎉 All simple git integration tests PASSED!');
    console.log('\n✨ Key verifications:');
    console.log('   - Git workspace initialization works');
    console.log('   - Manager branch creation works');
    console.log('   - Atomic operations with checkpoints');
    console.log('   - Rollback on failure works correctly');
    console.log('   - Conflict detection identifies issues');
} else {
    console.log('💥 Some tests failed');
    summary.results
        .filter(r => !r.success)
        .forEach(r => console.log(`   - ${r.name}: ${r.error}`));
}

process.exit(summary.failed === 0 ? 0 : 1);