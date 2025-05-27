#!/usr/bin/env node

/**
 * Test Atomic Git Operations
 * Tests the atomic git operations with rollback capability
 */

import { atomicGitOps } from '../../src/atomic_git_operations.js';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log('🧪 Testing Atomic Git Operations\n');

async function setupTestRepo(testDir) {
    // Clean and create test directory
    await fs.rm(testDir, { recursive: true, force: true });
    await fs.mkdir(testDir, { recursive: true });
    
    // Initialize git repo
    await execAsync('git init', { cwd: testDir });
    await execAsync('git config user.email "test@example.com"', { cwd: testDir });
    await execAsync('git config user.name "Test User"', { cwd: testDir });
    
    // Create initial commit
    await fs.writeFile(path.join(testDir, 'README.md'), '# Test Repository\n');
    await execAsync('git add README.md', { cwd: testDir });
    await execAsync('git commit -m "Initial commit"', { cwd: testDir });
    
    return testDir;
}

async function testSuccessfulOperation() {
    console.log('1️⃣ Testing successful atomic operation...');
    const testDir = path.join(process.cwd(), 'tests', 'test-atomic-success');
    
    try {
        await setupTestRepo(testDir);
        
        // Execute atomic operation
        const result = await atomicGitOps.atomicOperation(
            testDir,
            'test-successful-operation',
            [
                {
                    name: 'create-file',
                    fn: async () => {
                        await fs.writeFile(path.join(testDir, 'test.txt'), 'Test content');
                        return { file: 'test.txt' };
                    }
                },
                {
                    name: 'stage-file',
                    fn: async () => {
                        await execAsync('git add test.txt', { cwd: testDir });
                        return { staged: true };
                    }
                },
                {
                    name: 'commit-file',
                    fn: async () => {
                        await execAsync('git commit -m "Add test file"', { cwd: testDir });
                        return { committed: true };
                    }
                }
            ]
        );
        
        if (result.success) {
            console.log('   ✅ Atomic operation completed successfully');
            
            // Verify file exists and is committed
            const { stdout } = await execAsync('git log --oneline', { cwd: testDir });
            if (stdout.includes('Add test file')) {
                console.log('   ✅ Changes committed successfully');
                return true;
            }
        }
        
        return false;
    } finally {
        await fs.rm(testDir, { recursive: true, force: true });
    }
}

async function testFailedOperationWithRollback() {
    console.log('\n2️⃣ Testing failed operation with rollback...');
    const testDir = path.join(process.cwd(), 'tests', 'test-atomic-rollback');
    
    try {
        await setupTestRepo(testDir);
        
        // Get initial state
        const { stdout: initialCommit } = await execAsync('git rev-parse HEAD', { cwd: testDir });
        
        // Execute atomic operation that will fail
        const result = await atomicGitOps.atomicOperation(
            testDir,
            'test-failed-operation',
            [
                {
                    name: 'create-file',
                    fn: async () => {
                        await fs.writeFile(path.join(testDir, 'test.txt'), 'Test content');
                        return { file: 'test.txt' };
                    }
                },
                {
                    name: 'stage-file',
                    fn: async () => {
                        await execAsync('git add test.txt', { cwd: testDir });
                        return { staged: true };
                    }
                },
                {
                    name: 'commit-file',
                    fn: async () => {
                        await execAsync('git commit -m "Add test file"', { cwd: testDir });
                        return { committed: true };
                    }
                },
                {
                    name: 'failing-operation',
                    fn: async () => {
                        throw new Error('Simulated failure');
                    }
                }
            ]
        );
        
        if (!result.success && result.rolledBack) {
            console.log('   ✅ Operation failed as expected and rollback initiated');
            
            // Verify we're back to initial state
            const { stdout: currentCommit } = await execAsync('git rev-parse HEAD', { cwd: testDir });
            if (currentCommit.trim() === initialCommit.trim()) {
                console.log('   ✅ Successfully rolled back to initial state');
                
                // Verify test file was removed
                try {
                    await fs.access(path.join(testDir, 'test.txt'));
                    console.log('   ❌ Test file still exists after rollback');
                    return false;
                } catch {
                    console.log('   ✅ Test file removed after rollback');
                    return true;
                }
            }
        }
        
        return false;
    } finally {
        await fs.rm(testDir, { recursive: true, force: true });
    }
}

async function testCheckpointWithUncommittedChanges() {
    console.log('\n3️⃣ Testing checkpoint with uncommitted changes...');
    const testDir = path.join(process.cwd(), 'tests', 'test-atomic-checkpoint');
    
    try {
        await setupTestRepo(testDir);
        
        // Create uncommitted changes
        await fs.writeFile(path.join(testDir, 'uncommitted.txt'), 'Uncommitted content');
        await execAsync('git add uncommitted.txt', { cwd: testDir });
        
        // Create checkpoint
        const checkpoint = await atomicGitOps.createCheckpoint(testDir);
        console.log('   ✅ Created checkpoint with stash:', checkpoint.stashName);
        
        // Verify working tree is clean after checkpoint
        const { stdout: status } = await execAsync('git status --porcelain', { cwd: testDir });
        if (!status.trim()) {
            console.log('   ✅ Working tree clean after checkpoint');
            
            // Rollback to restore uncommitted changes
            await atomicGitOps.rollbackToCheckpoint(testDir, checkpoint);
            
            // Verify uncommitted changes are restored
            const { stdout: statusAfter } = await execAsync('git status --porcelain', { cwd: testDir });
            if (statusAfter.includes('uncommitted.txt')) {
                console.log('   ✅ Uncommitted changes restored after rollback');
                return true;
            }
        }
        
        return false;
    } finally {
        await fs.rm(testDir, { recursive: true, force: true });
    }
}

async function testValidationPreconditions() {
    console.log('\n4️⃣ Testing validation preconditions...');
    const testDir = path.join(process.cwd(), 'tests', 'test-atomic-validation');
    
    try {
        await setupTestRepo(testDir);
        
        // Test with clean working tree
        const cleanValidation = await atomicGitOps.validatePreconditions(testDir, [
            {
                name: 'Clean working tree',
                fn: () => atomicGitOps.validateCleanWorkingTree(testDir)
            },
            {
                name: 'Master branch exists',
                fn: () => atomicGitOps.validateBranchExists('master', testDir)
            }
        ]);
        
        if (cleanValidation.valid) {
            console.log('   ✅ Clean working tree validation passed');
        }
        
        // Create uncommitted changes
        await fs.writeFile(path.join(testDir, 'dirty.txt'), 'Dirty content');
        
        // Test with dirty working tree
        const dirtyValidation = await atomicGitOps.validatePreconditions(testDir, [
            {
                name: 'Clean working tree',
                fn: () => atomicGitOps.validateCleanWorkingTree(testDir)
            }
        ]);
        
        if (!dirtyValidation.valid) {
            console.log('   ✅ Dirty working tree validation failed as expected');
            return true;
        }
        
        return false;
    } finally {
        await fs.rm(testDir, { recursive: true, force: true });
    }
}

// Run all tests
async function runTests() {
    const tests = [
        testSuccessfulOperation,
        testFailedOperationWithRollback,
        testCheckpointWithUncommittedChanges,
        testValidationPreconditions
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        try {
            const result = await test();
            if (result) {
                passed++;
            } else {
                failed++;
            }
        } catch (error) {
            console.error(`   ❌ Test error: ${error.message}`);
            failed++;
        }
    }
    
    console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
    
    if (failed === 0) {
        console.log('🎉 All atomic git operation tests PASSED!');
        return true;
    } else {
        console.log('💥 Some tests failed');
        return false;
    }
}

// Run tests
runTests().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
});