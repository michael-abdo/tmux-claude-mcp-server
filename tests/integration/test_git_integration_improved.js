#!/usr/bin/env node

/**
 * Improved Git Integration Test
 * Uses the new base test class for better cleanup and resource management
 */

import { IntegrationTestBase, TestSuiteRunner } from '../helpers/base_test_class.js';
import { EnhancedMCPTools } from '../../src/enhanced_mcp_tools.js';
import { sharedWorkspaceGitManager } from '../../src/shared_workspace_git_manager.js';
import fs from 'fs/promises';
import path from 'path';

class GitIntegrationTest extends IntegrationTestBase {
    async setup() {
        // Call parent setup first to initialize isolated environment
        await super.setup();
        
        // Create instance manager
        this.instanceManager = await this.createInstanceManager();
        
        // Create shared workspace directory
        this.sharedWorkspace = await this.createSubdirectory('shared-workspace');
        
        // Initialize git in workspace
        await this.execInEnv(`git init`, { cwd: this.sharedWorkspace });
        await this.execInEnv(`git config user.name "Test User"`, { cwd: this.sharedWorkspace });
        await this.execInEnv(`git config user.email "test@example.com"`, { cwd: this.sharedWorkspace });
        
        // Create initial commit to establish master branch
        await fs.writeFile(path.join(this.sharedWorkspace, '.gitkeep'), '');
        await this.execInEnv('git add .gitkeep', { cwd: this.sharedWorkspace });
        await this.execInEnv('git commit -m "Initial commit"', { cwd: this.sharedWorkspace });
    }
}

// Create test suite
const suite = new TestSuiteRunner('Git Integration Tests (Improved)');

// Test 1: Workspace initialization with cleanup
suite.addTest('Workspace Initialization', GitIntegrationTest, async function() {
    // Initialize shared workspace
    const result = await sharedWorkspaceGitManager.initializeSharedWorkspace(
        this.sharedWorkspace
    );
    
    this.assertEqual(result.status, 'initialized', 'Workspace should be initialized');
    this.assertEqual(result.baseBranch, 'master', 'Base branch should be master');
    
    // Verify git configuration
    const { stdout } = await this.execInEnv('git config merge.ours.driver', { cwd: this.sharedWorkspace });
    this.assertEqual(stdout.trim(), 'true', 'Merge driver should be configured');
});

// Test 2: Manager branch creation
suite.addTest('Manager Branch Creation', GitIntegrationTest, async function() {
    // Initialize workspace first
    await sharedWorkspaceGitManager.initializeSharedWorkspace(
        this.sharedWorkspace
    );
    
    // Create manager instance and branch
    const managerId = 'mgr_test_1';
    this.registerTmuxSession(managerId); // Register for cleanup
    
    const result = await sharedWorkspaceGitManager.createManagerBranch({
        workspaceDir: this.sharedWorkspace,
        instanceId: managerId,
        taskDescription: 'Test task'
    });
    
    this.assert(result.branchName.includes(managerId), 'Branch should include manager ID');
    
    // Verify branch exists
    const { stdout } = await this.execInEnv('git branch', { cwd: this.sharedWorkspace });
    this.assert(stdout.includes(result.branchName), 'Branch should exist in repository');
});

// Test 3: Conflict detection
suite.addTest('Conflict Detection', GitIntegrationTest, async function() {
    // Initialize workspace
    await sharedWorkspaceGitManager.initializeSharedWorkspace(
        this.sharedWorkspace
    );
    
    // Create two manager branches
    const mgr1 = 'mgr_test_1';
    const mgr2 = 'mgr_test_2';
    
    this.registerTmuxSession(mgr1);
    this.registerTmuxSession(mgr2);
    
    const result1 = await sharedWorkspaceGitManager.createManagerBranch({
        workspaceDir: this.sharedWorkspace,
        instanceId: mgr1,
        taskDescription: 'Task 1'
    });
    
    const result2 = await sharedWorkspaceGitManager.createManagerBranch({
        workspaceDir: this.sharedWorkspace,
        instanceId: mgr2,
        taskDescription: 'Task 2'
    });
    
    // Create conflicting changes
    const testFile = path.join(this.sharedWorkspace, 'test.txt');
    
    // Manager 1 changes
    await this.execInEnv(`git checkout ${result1.branchName}`, { cwd: this.sharedWorkspace });
    await fs.writeFile(testFile, 'Manager 1 changes\n');
    await this.execInEnv('git add test.txt', { cwd: this.sharedWorkspace });
    await this.execInEnv('git commit -m "Manager 1 changes"', { cwd: this.sharedWorkspace });
    
    // Manager 2 changes
    await this.execInEnv(`git checkout ${result2.branchName}`, { cwd: this.sharedWorkspace });
    await fs.writeFile(testFile, 'Manager 2 changes\n');
    await this.execInEnv('git add test.txt', { cwd: this.sharedWorkspace });
    await this.execInEnv('git commit -m "Manager 2 changes"', { cwd: this.sharedWorkspace });
    
    // Check for conflicts
    const conflicts = await sharedWorkspaceGitManager.analyzeConflicts(
        result1.branchName,
        result2.branchName,
        this.sharedWorkspace
    );
    
    this.assert(conflicts.hasConflicts, 'Should detect conflicts');
    this.assert(conflicts.conflicts.includes('test.txt'), 'Should identify conflicting file');
});

// Test 4: Auto-merge capability
suite.addTest('Auto-merge Capability', GitIntegrationTest, async function() {
    // Initialize workspace
    await sharedWorkspaceGitManager.initializeSharedWorkspace(
        this.sharedWorkspace
    );
    
    // Create manager branch
    const managerId = 'mgr_test_1';
    this.registerTmuxSession(managerId);
    
    const result = await sharedWorkspaceGitManager.createManagerBranch({
        workspaceDir: this.sharedWorkspace,
        instanceId: managerId,
        taskDescription: 'Test merge'
    });
    
    // Make changes to different files
    await this.execInEnv(`git checkout ${result.branchName}`, { cwd: this.sharedWorkspace });
    
    await fs.writeFile(path.join(this.sharedWorkspace, 'file1.txt'), 'Content 1');
    await fs.writeFile(path.join(this.sharedWorkspace, 'README.md'), 'Project info');
    
    await this.execInEnv('git add .', { cwd: this.sharedWorkspace });
    await this.execInEnv('git commit -m "Manager changes"', { cwd: this.sharedWorkspace });
    
    // Verify files are auto-resolvable
    const autoResolve1 = sharedWorkspaceGitManager.isAutoResolvable('README.md');
    const autoResolve2 = sharedWorkspaceGitManager.isAutoResolvable('file1.txt');
    
    this.assert(autoResolve1, 'README.md should be auto-resolvable');
    this.assert(autoResolve2, 'file1.txt should be auto-resolvable');
});

// Test 5: MCP Tools integration
suite.addTest('MCP Tools Integration', GitIntegrationTest, async function() {
    const tools = new EnhancedMCPTools(this.instanceManager);
    
    // Test getWorkspaceStatus tool
    const statusResult = await tools.getWorkspaceStatus({
        workspaceDir: this.sharedWorkspace
    }, 'executive');
    
    this.assert(statusResult.currentBranch, 'Current branch should be present');
    this.assertEqual(statusResult.currentBranch, 'master', 'Should be on master branch');
    
    // Test git manager directly for branch creation
    const branchResult = await sharedWorkspaceGitManager.createManagerBranch({
        workspaceDir: this.sharedWorkspace,
        instanceId: 'mgr_test_1',
        taskDescription: 'Test branch creation'
    });
    
    this.assert(branchResult.status === 'created' || branchResult.status === 'existing', 'Branch creation should succeed');
    this.assert(branchResult.branchName.includes('mgr_test_1'), 'Branch should include manager ID');
});

// Test 6: Cleanup verification
suite.addTest('Cleanup Verification', GitIntegrationTest, async function() {
    // Create multiple resources
    const sessions = ['test_session_1', 'test_session_2', 'test_session_3'];
    for (const session of sessions) {
        this.registerTmuxSession(session);
    }
    
    const files = [];
    for (let i = 0; i < 5; i++) {
        const file = await this.createTempFile(`test_${i}.txt`, `Content ${i}`);
        files.push(file);
    }
    
    // Verify resources exist
    this.assertEqual(files.length, 5, 'Should create 5 files');
    
    // Stats before cleanup
    const stats = this.cleanupUtility.getStats();
    this.assert(stats.tmux >= 3, 'Should have registered tmux sessions');
    this.assert(stats.file >= 5, 'Should have registered files');
    
    // Note: Actual cleanup happens in teardown
});

// Run the test suite
console.log('🧪 Running Improved Git Integration Tests\n');
const results = await suite.run();

// Exit with appropriate code
process.exit(results.some(r => !r.success) ? 1 : 0);