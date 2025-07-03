#!/usr/bin/env node

/**
 * Git Integration Test with Isolated Environments
 * Tests the complete git integration workflow using fully isolated test environments
 */

import { InstanceManager } from '../../src/instance_manager.js';
import { EnhancedMCPTools } from '../../src/enhanced_mcp_tools.js';
import { sharedWorkspaceGitManager } from '../../src/shared_workspace_git_manager.js';
import { IsolatedTestEnvironment, IsolatedTestRunner } from './test_isolated_environments.js';
import fs from 'fs/promises';
import path from 'path';

console.log('🧪 Testing Git Integration with Isolated Environments\n');

const runner = new IsolatedTestRunner();

// Test 1: Basic git workspace initialization
await runner.runTest('Git workspace initialization', async (env) => {
    const workspaceDir = await env.createSubdir('shared-workspace');
    const stateDir = await env.createSubdir('state');
    
    // Initialize git in the workspace subdirectory
    await env.exec('git init', { cwd: workspaceDir });
    await env.exec('git config user.email "test@example.com"', { cwd: workspaceDir });
    await env.exec('git config user.name "Test User"', { cwd: workspaceDir });
    
    // Create initial commit to establish branch
    await env.exec('touch .gitkeep', { cwd: workspaceDir });
    await env.exec('git add .gitkeep', { cwd: workspaceDir });
    await env.exec('git commit -m "Initial commit"', { cwd: workspaceDir });
    
    const instanceManager = new InstanceManager(stateDir);
    
    // Initialize git workspace
    const gitInit = await sharedWorkspaceGitManager.initializeSharedWorkspace(workspaceDir);
    
    if (gitInit.status !== 'initialized') {
        throw new Error('Git workspace initialization failed');
    }
    
    // Verify git configuration
    const { stdout } = await env.exec('git config merge.ours.driver', { cwd: workspaceDir });
    if (stdout.trim() !== 'true') {
        throw new Error('Git merge driver not configured');
    }
    
    return { baseBranch: gitInit.baseBranch };
});

// Test 2: Manager branch creation in isolation
await runner.runTest('Manager branch creation', async (env) => {
    const workspaceDir = await env.createSubdir('shared-workspace');
    const stateDir = await env.createSubdir('state');
    
    // Initialize git in the workspace subdirectory
    await env.exec('git init', { cwd: workspaceDir });
    await env.exec('git config user.email "test@example.com"', { cwd: workspaceDir });
    await env.exec('git config user.name "Test User"', { cwd: workspaceDir });
    
    // Create initial commit to establish branch
    await env.exec('touch .gitkeep', { cwd: workspaceDir });
    await env.exec('git add .gitkeep', { cwd: workspaceDir });
    await env.exec('git commit -m "Initial commit"', { cwd: workspaceDir });
    
    const instanceManager = new InstanceManager(stateDir);
    
    // Setup shared workspace
    const managerId = 'mgr_test_001';
    await instanceManager.setupSharedWorkspace(workspaceDir, managerId, 'Test task', {
        role: 'manager',
        parentId: 'exec_test'
    });
    
    // Verify manager branch was created
    const { stdout } = await env.exec('git branch', { cwd: workspaceDir });
    if (!stdout.includes(`manager-${managerId}`)) {
        throw new Error('Manager branch not created');
    }
    
    // Verify clean working tree
    const { stdout: status } = await env.exec('git status --porcelain', { cwd: workspaceDir });
    if (status.trim()) {
        throw new Error('Working tree not clean after setup');
    }
    
    return { branches: stdout.trim().split('\n').length };
});

// Test 3: Multiple managers in same workspace
await runner.runTest('Multiple managers collaboration', async (env) => {
    const workspaceDir = await env.createSubdir('shared-workspace');
    const stateDir = await env.createSubdir('state');
    
    const instanceManager = new InstanceManager(stateDir);
    
    // Create two managers
    const manager1 = 'mgr_iso_001';
    const manager2 = 'mgr_iso_002';
    
    await instanceManager.setupSharedWorkspace(workspaceDir, manager1, 'Feature A', {
        role: 'manager'
    });
    
    await instanceManager.setupSharedWorkspace(workspaceDir, manager2, 'Feature B', {
        role: 'manager'
    });
    
    // Verify both branches exist
    const { stdout } = await env.exec('git branch', { cwd: workspaceDir });
    const branches = stdout.trim().split('\n');
    
    const hasBranch1 = branches.some(b => b.includes(`manager-${manager1}`));
    const hasBranch2 = branches.some(b => b.includes(`manager-${manager2}`));
    
    if (!hasBranch1 || !hasBranch2) {
        throw new Error('Not all manager branches created');
    }
    
    // Verify workspace marker has both managers
    const markerContent = await fs.readFile(
        path.join(workspaceDir, 'SHARED_WORKSPACE.md'), 
        'utf-8'
    );
    
    if (!markerContent.includes(manager1) || !markerContent.includes(manager2)) {
        throw new Error('Workspace marker missing manager info');
    }
    
    return { 
        managerCount: 2,
        branchCount: branches.length 
    };
});

// Test 4: Conflict detection between managers
await runner.runTest('Conflict detection', async (env) => {
    const workspaceDir = await env.createSubdir('shared-workspace');
    const stateDir = await env.createSubdir('state');
    
    const instanceManager = new InstanceManager(stateDir);
    const sharedWorkspaceMCPTools = new EnhancedMCPTools(instanceManager);
    
    // Create two managers
    const manager1 = 'mgr_conflict_001';
    const manager2 = 'mgr_conflict_002';
    
    await instanceManager.setupSharedWorkspace(workspaceDir, manager1, 'Edit file', {
        role: 'manager'
    });
    
    // Manager 1 creates a file
    // First check if the branch exists
    const { stdout: branches1 } = await env.exec('git branch', { cwd: workspaceDir });
    if (!branches1.includes(`manager-${manager1}`)) {
        // If git integration failed, create the branch manually
        await env.exec(`git checkout -b manager-${manager1}`, { cwd: workspaceDir });
    } else {
        await env.exec(`git checkout manager-${manager1}`, { cwd: workspaceDir });
    }
    await fs.writeFile(path.join(workspaceDir, 'shared.txt'), 'Manager 1 content\n');
    await env.exec('git add shared.txt', { cwd: workspaceDir });
    await env.exec('git commit -m "Manager 1: Add shared file"', { cwd: workspaceDir });
    
    // Switch to master
    await env.exec('git checkout master', { cwd: workspaceDir });
    
    // Manager 2 setup
    await instanceManager.setupSharedWorkspace(workspaceDir, manager2, 'Edit same file', {
        role: 'manager'
    });
    
    // Manager 2 creates same file with different content
    await env.exec(`git checkout manager-${manager2}`, { cwd: workspaceDir });
    await fs.writeFile(path.join(workspaceDir, 'shared.txt'), 'Manager 2 content\n');
    await env.exec('git add shared.txt', { cwd: workspaceDir });
    await env.exec('git commit -m "Manager 2: Add shared file"', { cwd: workspaceDir });
    
    // Check for conflicts
    const conflicts = await sharedWorkspaceMCPTools.checkWorkspaceConflicts(
        { managerId: 'all' }, 
        'executive'
    );
    
    // Should detect potential conflict in shared.txt
    const hasConflict = conflicts.conflicts.length > 0 || 
        conflicts.managers.some(m => m.conflictingFiles.length > 0);
    
    if (!hasConflict) {
        throw new Error('Conflict detection failed - should detect shared.txt conflict');
    }
    
    return { 
        conflictsDetected: true,
        conflictCount: conflicts.conflicts.length 
    };
});

// Test 5: Atomic merge operation
await runner.runTest('Atomic merge operation', async (env) => {
    const workspaceDir = await env.createSubdir('shared-workspace');
    const stateDir = await env.createSubdir('state');
    
    const instanceManager = new InstanceManager(stateDir);
    const sharedWorkspaceMCPTools = new EnhancedMCPTools(instanceManager);
    
    // Create manager with some work
    const managerId = 'mgr_merge_001';
    await instanceManager.setupSharedWorkspace(workspaceDir, managerId, 'Add feature', {
        role: 'manager'
    });
    
    // Add manager's work
    await env.exec(`git checkout manager-${managerId}`, { cwd: workspaceDir });
    await fs.writeFile(path.join(workspaceDir, 'feature.js'), 'console.log("feature");');
    await env.exec('git add feature.js', { cwd: workspaceDir });
    await env.exec('git commit -m "Add feature implementation"', { cwd: workspaceDir });
    
    // Test atomic merge
    const defaultBranch = await sharedWorkspaceGitManager.getDefaultBranch(workspaceDir);
    const mergeResult = await sharedWorkspaceGitManager.coordinatedMerge({
        managerBranch: `manager-${managerId}`,
        targetBranch: defaultBranch,
        workspaceDir,
        strategy: 'auto'
    });
    
    if (!mergeResult.success) {
        throw new Error(`Merge failed: ${mergeResult.error}`);
    }
    
    // Verify file exists on master
    await env.exec('git checkout master', { cwd: workspaceDir });
    const fileExists = await fs.access(path.join(workspaceDir, 'feature.js'))
        .then(() => true)
        .catch(() => false);
    
    if (!fileExists) {
        throw new Error('Merged file not found on master branch');
    }
    
    return { 
        mergeSuccess: true,
        strategy: mergeResult.strategy 
    };
});

// Test 6: Rollback on failed merge
await runner.runTest('Merge rollback on failure', async (env) => {
    const workspaceDir = await env.createSubdir('shared-workspace');
    const stateDir = await env.createSubdir('state');
    
    const instanceManager = new InstanceManager(stateDir);
    
    // Create manager
    const managerId = 'mgr_rollback_001';
    await instanceManager.setupSharedWorkspace(workspaceDir, managerId, 'Test rollback', {
        role: 'manager'
    });
    
    // Get initial commit on master
    await env.exec('git checkout master', { cwd: workspaceDir });
    const { stdout: initialCommit } = await env.exec('git rev-parse HEAD', { cwd: workspaceDir });
    
    // Add conflicting changes on master
    await fs.writeFile(path.join(workspaceDir, 'conflict.txt'), 'Master content\n');
    await env.exec('git add conflict.txt', { cwd: workspaceDir });
    await env.exec('git commit -m "Master: Add conflict file"', { cwd: workspaceDir });
    
    // Add conflicting changes on manager branch
    await env.exec(`git checkout manager-${managerId}`, { cwd: workspaceDir });
    await fs.writeFile(path.join(workspaceDir, 'conflict.txt'), 'Manager content\n');
    await env.exec('git add conflict.txt', { cwd: workspaceDir });
    await env.exec('git commit -m "Manager: Add conflict file"', { cwd: workspaceDir });
    
    // Attempt merge (should fail and rollback)
    const mergeResult = await sharedWorkspaceGitManager.coordinatedMerge({
        managerBranch: `manager-${managerId}`,
        targetBranch: 'master',
        workspaceDir,
        strategy: 'auto'
    });
    
    if (mergeResult.success) {
        throw new Error('Merge should have failed due to conflicts');
    }
    
    // Verify rollback occurred
    if (!mergeResult.rolledBack) {
        throw new Error('Merge failure did not trigger rollback');
    }
    
    // Verify we're still on a clean state
    const { stdout: status } = await env.exec('git status --porcelain', { cwd: workspaceDir });
    if (status.trim()) {
        throw new Error('Working tree not clean after rollback');
    }
    
    return { 
        mergeRolledBack: true,
        cleanState: true 
    };
});

// Print summary
const summary = runner.getSummary();
console.log(`\n📊 Test Results: ${summary.passed} passed, ${summary.failed} failed`);

if (summary.failed === 0) {
    console.log('🎉 All git integration tests PASSED in isolated environments!');
    console.log('\n✨ Key achievements:');
    console.log('   - Complete test isolation from parent repository');
    console.log('   - No interference between test runs');
    console.log('   - Atomic operations with proper rollback');
    console.log('   - Conflict detection working correctly');
    console.log('   - Clean state maintained throughout');
} else {
    console.log('💥 Some tests failed');
    summary.results
        .filter(r => !r.success)
        .forEach(r => console.log(`   - ${r.name}: ${r.error}`));
}

process.exit(summary.failed === 0 ? 0 : 1);