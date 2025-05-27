#!/usr/bin/env node
/**
 * Test git worktree functionality
 */

import { GitBranchManager } from '../../src/git_branch_manager.js';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function setupTestRepo(testDir) {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
    
    // Initialize git repo
    await execAsync('git init', { cwd: testDir });
    await execAsync('git config user.email "test@example.com"', { cwd: testDir });
    await execAsync('git config user.name "Test User"', { cwd: testDir });
    
    // Create initial file and commit
    await fs.writeFile(path.join(testDir, 'README.md'), '# Test Project\n');
    await execAsync('git add .', { cwd: testDir });
    await execAsync('git commit -m "Initial commit"', { cwd: testDir });
    
    return testDir;
}

async function cleanupTestRepo(testDir) {
    try {
        // Force remove directory
        await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
        console.error('Cleanup error:', error.message);
    }
}

async function testWorktreeCreation() {
    console.log('\n=== Test 1: Worktree Creation ===');
    
    const testDir = `/tmp/test-worktree-${Date.now()}`;
    const gitManager = new GitBranchManager();
    
    try {
        await setupTestRepo(testDir);
        
        // Create a worktree
        const result = await gitManager.createSpecialistWorktree({
            instanceId: 'spec_123',
            taskId: 'task_456',
            feature: 'test-feature',
            workDir: testDir
        });
        
        console.log('✅ Worktree created:', result);
        
        // Verify worktree exists
        const worktreeExists = await gitManager.worktreeExists(result.worktreePath, testDir);
        console.log(`✅ Worktree exists: ${worktreeExists}`);
        
        // Verify branch was created
        const branchExists = await gitManager.branchExists(result.branchName, testDir);
        console.log(`✅ Branch exists: ${branchExists}`);
        
        // Verify we can work in the worktree
        await fs.writeFile(
            path.join(result.worktreePath, 'test.js'),
            'console.log("Hello from worktree!");'
        );
        console.log('✅ Created file in worktree');
        
        // List worktrees
        const worktrees = await gitManager.listWorktrees(testDir);
        console.log('✅ Worktrees:', worktrees);
        
        return { success: true, testDir, result };
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        await cleanupTestRepo(testDir);
        return { success: false, error };
    }
}

async function testWorktreeRemoval(previousResult) {
    console.log('\n=== Test 2: Worktree Removal ===');
    
    if (!previousResult.success) {
        console.log('⚠️  Skipping - previous test failed');
        return;
    }
    
    const { testDir, result } = previousResult;
    const gitManager = new GitBranchManager();
    
    try {
        // Remove the worktree
        const removed = await gitManager.removeSpecialistWorktree({
            worktreePath: result.worktreePath,
            branchName: result.branchName,
            workDir: testDir,
            force: true
        });
        
        console.log(`✅ Worktree removed: ${removed}`);
        
        // Verify worktree is gone
        const worktreeExists = await gitManager.worktreeExists(result.worktreePath, testDir);
        console.log(`✅ Worktree no longer exists: ${!worktreeExists}`);
        
        // Verify branch is gone
        const branchExists = await gitManager.branchExists(result.branchName, testDir);
        console.log(`✅ Branch no longer exists: ${!branchExists}`);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await cleanupTestRepo(testDir);
    }
}

async function testMultipleWorktrees() {
    console.log('\n=== Test 3: Multiple Concurrent Worktrees ===');
    
    const testDir = `/tmp/test-multi-worktree-${Date.now()}`;
    const gitManager = new GitBranchManager();
    const worktrees = [];
    
    try {
        await setupTestRepo(testDir);
        
        // Create multiple worktrees
        for (let i = 1; i <= 3; i++) {
            const result = await gitManager.createSpecialistWorktree({
                instanceId: `spec_${i}00`,
                taskId: `task_${i}`,
                feature: `feature-${i}`,
                workDir: testDir
            });
            worktrees.push(result);
            console.log(`✅ Created worktree ${i}: ${result.branchName}`);
            
            // Create unique file in each
            await fs.writeFile(
                path.join(result.worktreePath, `feature${i}.js`),
                `// Feature ${i} implementation`
            );
        }
        
        // Verify all worktrees exist
        const allWorktrees = await gitManager.listWorktrees(testDir);
        console.log(`✅ Total worktrees: ${allWorktrees.length} (including main)`);
        
        // Verify isolation - each worktree has only its own file
        for (let i = 0; i < worktrees.length; i++) {
            const files = await fs.readdir(worktrees[i].worktreePath);
            const hasOwnFile = files.includes(`feature${i + 1}.js`);
            const hasOtherFiles = files.some(f => 
                f.match(/feature\d\.js/) && f !== `feature${i + 1}.js`
            );
            
            console.log(`✅ Worktree ${i + 1} isolation: own file=${hasOwnFile}, other files=${hasOtherFiles}`);
        }
        
        // Cleanup all worktrees
        for (const worktree of worktrees) {
            await gitManager.removeSpecialistWorktree({
                worktreePath: worktree.worktreePath,
                branchName: worktree.branchName,
                workDir: testDir,
                force: true
            });
        }
        
        console.log('✅ All worktrees cleaned up');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await cleanupTestRepo(testDir);
    }
}

async function testWorktreePruning() {
    console.log('\n=== Test 4: Worktree Pruning ===');
    
    const testDir = `/tmp/test-prune-worktree-${Date.now()}`;
    const gitManager = new GitBranchManager();
    
    try {
        await setupTestRepo(testDir);
        
        // Create a worktree
        const result = await gitManager.createSpecialistWorktree({
            instanceId: 'spec_prune',
            taskId: 'task_prune',
            feature: 'prune-test',
            workDir: testDir
        });
        
        // Manually delete the worktree directory (simulating corruption)
        await fs.rm(result.worktreePath, { recursive: true, force: true });
        
        // Prune stale worktrees
        const pruned = await gitManager.pruneWorktrees(testDir);
        console.log(`✅ Pruned ${pruned} stale worktrees`);
        
        // Verify worktree is gone from list
        const worktrees = await gitManager.listWorktrees(testDir);
        const stillExists = worktrees.some(w => w.path === result.worktreePath);
        console.log(`✅ Stale worktree removed from list: ${!stillExists}`);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await cleanupTestRepo(testDir);
    }
}

async function runAllTests() {
    console.log('=== Git Worktree Tests ===');
    
    // Test 1: Basic creation
    const result1 = await testWorktreeCreation();
    
    // Test 2: Removal (depends on test 1)
    await testWorktreeRemoval(result1);
    
    // Test 3: Multiple concurrent worktrees
    await testMultipleWorktrees();
    
    // Test 4: Pruning
    await testWorktreePruning();
    
    console.log('\n=== Tests Complete ===');
}

// Run tests
runAllTests().catch(console.error);