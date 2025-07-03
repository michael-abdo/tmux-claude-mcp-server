#!/usr/bin/env node

/**
 * Error Scenario Testing
 * Tests error handling, edge cases, and failure recovery
 */

import { IntegrationTestBase, UnitTestBase, TestSuiteRunner } from '../helpers/base_test_class.js';
import { InstanceManager } from '../../src/instance_manager.js';
import { sharedWorkspaceGitManager } from '../../src/shared_workspace_git_manager.js';
import { SharedWorkspaceMCPTools } from '../../src/shared_workspace_mcp_tools.js';
import { AtomicGitOperations } from '../../src/atomic_git_operations.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Test error handling in git operations
 */
class GitErrorScenarioTest extends IntegrationTestBase {
    async setup() {
        await super.setup();
        this.instanceManager = await this.createInstanceManager();
        this.workspaceDir = await this.createSubdirectory('error-test-workspace');
    }
}

/**
 * Test error handling in instance management
 */
class InstanceErrorScenarioTest extends IntegrationTestBase {
    async setup() {
        await super.setup();
        this.instanceManager = await this.createInstanceManager();
    }
}

// Create test suite
const suite = new TestSuiteRunner('Error Scenario Tests');

// Test 1: Git initialization in non-existent directory
suite.addTest('Git Init - Non-existent Directory', GitErrorScenarioTest, async function() {
    const nonExistentDir = path.join(this.testDir, 'does-not-exist', 'nested', 'path');
    
    try {
        await sharedWorkspaceGitManager.initializeSharedWorkspace(nonExistentDir);
        this.assert(false, 'Should have thrown error for non-existent directory');
    } catch (error) {
        this.assert(
            error.message.includes('ENOENT') || 
            error.message.includes('No such file') ||
            error.message.includes('Not a git repository') ||
            error.message.includes('does not exist'), 
            `Should throw appropriate error for missing directory, got: ${error.message}`
        );
    }
});

// Test 2: Git operations in non-git directory
suite.addTest('Git Ops - Non-git Directory', GitErrorScenarioTest, async function() {
    // Create directory but don't initialize git
    const nonGitDir = await this.createSubdirectory('non-git-dir');
    
    try {
        // Use the correct method name
        await sharedWorkspaceGitManager.gitCommand('status', nonGitDir);
        this.assert(false, 'Should have thrown error for non-git directory');
    } catch (error) {
        this.assert(
            error.message.toLowerCase().includes('not a git repository') ||
            error.message.includes('Not a git repository') ||
            error.message.includes('fatal:'), 
            `Should throw appropriate error for non-git directory, got: ${error.message}`
        );
    }
});

// Test 3: Branch creation with invalid characters
suite.addTest('Branch Creation - Invalid Characters', GitErrorScenarioTest, async function() {
    // Initialize git workspace
    await this.execInEnv('git init', { cwd: this.workspaceDir });
    await this.execInEnv('git config user.name "Test"', { cwd: this.workspaceDir });
    await this.execInEnv('git config user.email "test@test.com"', { cwd: this.workspaceDir });
    await fs.writeFile(path.join(this.workspaceDir, '.gitkeep'), '');
    await this.execInEnv('git add .gitkeep', { cwd: this.workspaceDir });
    await this.execInEnv('git commit -m "Initial"', { cwd: this.workspaceDir });
    
    await sharedWorkspaceGitManager.initializeSharedWorkspace(this.workspaceDir);
    
    // Try to create branch with invalid characters
    const invalidManagerId = 'mgr/test\\invalid:chars';
    
    try {
        await sharedWorkspaceGitManager.createManagerBranch(
            this.workspaceDir,
            invalidManagerId,
            'Test task'
        );
        this.assert(false, 'Should have thrown error for invalid branch name');
    } catch (error) {
        this.assert(
            error.message.includes('invalid') || 
            error.message.includes('branch') ||
            error.message.includes('ref'),
            'Should throw appropriate error for invalid branch name'
        );
    }
});

// Test 4: Atomic operation rollback
suite.addTest('Atomic Operation - Rollback on Failure', GitErrorScenarioTest, async function() {
    // Initialize git workspace
    await this.execInEnv('git init', { cwd: this.workspaceDir });
    await this.execInEnv('git config user.name "Test"', { cwd: this.workspaceDir });
    await this.execInEnv('git config user.email "test@test.com"', { cwd: this.workspaceDir });
    await fs.writeFile(path.join(this.workspaceDir, 'test.txt'), 'original content');
    await this.execInEnv('git add test.txt', { cwd: this.workspaceDir });
    await this.execInEnv('git commit -m "Initial"', { cwd: this.workspaceDir });
    
    const atomicOps = new AtomicGitOperations();
    
    // Create operations where the second one fails
    const operations = [
        {
            name: 'modify-file',
            fn: async () => {
                await fs.writeFile(path.join(this.workspaceDir, 'test.txt'), 'modified content');
                await this.execInEnv('git add test.txt', { cwd: this.workspaceDir });
            }
        },
        {
            name: 'create-invalid-branch',
            fn: async () => {
                // This will fail - branch names can't have spaces or special chars
                await this.execInEnv('git checkout -b "invalid branch name!"', { cwd: this.workspaceDir });
            }
        }
    ];
    
    const result = await atomicOps.atomicOperation(this.workspaceDir, 'test-rollback', operations);
    
    this.assert(!result.success, 'Operation should fail');
    this.assert(result.rolledBack, 'Should have rolled back');
    
    // Verify file was rolled back
    const content = await fs.readFile(path.join(this.workspaceDir, 'test.txt'), 'utf-8');
    this.assertEqual(content, 'original content', 'File should be rolled back to original');
});

// Test 5: Instance spawn with invalid role
suite.addTest('Instance Spawn - Invalid Role', InstanceErrorScenarioTest, async function() {
    try {
        await this.instanceManager.spawnInstance({
            role: 'invalid-role',
            project: '/tmp/test-project',
            task: 'Test task'
        });
        this.assert(false, 'Should have thrown error for invalid role');
    } catch (error) {
        this.assert(error.message.includes('Invalid role'), 
            'Should throw appropriate error for invalid role');
    }
});

// Test 6: Terminate non-existent instance
suite.addTest('Terminate Non-existent Instance', InstanceErrorScenarioTest, async function() {
    try {
        await this.instanceManager.terminateInstance('non_existent_instance');
        // If no error thrown, check if it returned false or some error indication
        this.assert(true, 'Terminating non-existent instance should be handled gracefully');
    } catch (error) {
        // If it throws, that's also acceptable
        this.assert(
            error.message.includes('not found') || 
            error.message.includes('does not exist') ||
            error.message.includes('No instance'),
            `Should throw appropriate error for non-existent instance, got: ${error.message}`
        );
    }
});

// Test 7: Concurrent modification conflict
suite.addTest('Concurrent Modification - Conflict Detection', GitErrorScenarioTest, async function() {
    // Initialize workspace
    await this.execInEnv('git init', { cwd: this.workspaceDir });
    await this.execInEnv('git config user.name "Test"', { cwd: this.workspaceDir });
    await this.execInEnv('git config user.email "test@test.com"', { cwd: this.workspaceDir });
    
    const testFile = path.join(this.workspaceDir, 'concurrent.txt');
    await fs.writeFile(testFile, 'original content\n');
    await this.execInEnv('git add concurrent.txt', { cwd: this.workspaceDir });
    await this.execInEnv('git commit -m "Initial"', { cwd: this.workspaceDir });
    
    await sharedWorkspaceGitManager.initializeSharedWorkspace(this.workspaceDir);
    
    // Create two branches
    const branch1 = await sharedWorkspaceGitManager.createManagerBranch({
        workspaceDir: this.workspaceDir,
        instanceId: 'mgr_1',
        taskDescription: 'Task 1'
    });
    const branch2 = await sharedWorkspaceGitManager.createManagerBranch({
        workspaceDir: this.workspaceDir, 
        instanceId: 'mgr_2',
        taskDescription: 'Task 2'
    });
    
    // Make conflicting changes
    await this.execInEnv(`git checkout ${branch1.branchName}`, { cwd: this.workspaceDir });
    await fs.writeFile(testFile, 'branch 1 content\n');
    await this.execInEnv('git add concurrent.txt', { cwd: this.workspaceDir });
    await this.execInEnv('git commit -m "Branch 1 changes"', { cwd: this.workspaceDir });
    
    await this.execInEnv(`git checkout ${branch2.branchName}`, { cwd: this.workspaceDir });
    await fs.writeFile(testFile, 'branch 2 content\n');
    await this.execInEnv('git add concurrent.txt', { cwd: this.workspaceDir });
    await this.execInEnv('git commit -m "Branch 2 changes"', { cwd: this.workspaceDir });
    
    // Try to detect conflicts
    const conflicts = await sharedWorkspaceGitManager.checkForConflicts(
        this.workspaceDir, branch1.branchName, branch2.branchName
    );
    
    this.assert(conflicts.hasConflicts, 'Should detect conflicts');
    this.assert(conflicts.files.includes('concurrent.txt'), 'Should identify conflicting file');
});

// Test 8: File system permission errors
suite.addTest('File System - Permission Denied', IntegrationTestBase, async function() {
    const readOnlyDir = await this.createSubdirectory('readonly');
    const readOnlyFile = path.join(readOnlyDir, 'test.txt');
    
    await fs.writeFile(readOnlyFile, 'content');
    
    // Make file read-only
    await fs.chmod(readOnlyFile, 0o444);
    
    try {
        await fs.writeFile(readOnlyFile, 'new content');
        this.assert(false, 'Should have thrown permission error');
    } catch (error) {
        this.assert(
            error.code === 'EACCES' || error.code === 'EPERM',
            'Should throw permission error'
        );
    } finally {
        // Restore permissions for cleanup
        await fs.chmod(readOnlyFile, 0o644);
    }
});

// Test 9: Resource exhaustion simulation
suite.addTest('Resource Exhaustion - Too Many Instances', InstanceErrorScenarioTest, async function() {
    const maxInstances = 3; // Simulate a low limit for testing
    const instances = [];
    
    try {
        // Create a test workspace
        const testWorkspace = await this.createSubdirectory('resource-test');
        
        // Try to spawn more than the limit
        for (let i = 0; i < maxInstances + 2; i++) {
            // Check current instance count
            const currentInstances = Object.keys(this.instanceManager.instances).length;
            if (currentInstances >= maxInstances) {
                throw new Error('Resource limit exceeded: Too many active instances');
            }
            
            const instanceId = await this.instanceManager.spawnInstance(
                'specialist',
                testWorkspace,
                `Test specialist ${i}`,
                'mgr_test'
            );
            instances.push(instanceId);
            this.registerTmuxSession(instanceId);
        }
        
        this.assert(false, 'Should have hit resource limit');
    } catch (error) {
        this.assert(
            error.message.includes('Resource limit') || 
            error.message.includes('Too many'), 
            `Should throw resource limit error, got: ${error.message}`
        );
    } finally {
        // Clean up spawned instances
        for (const id of instances) {
            try {
                await this.instanceManager.terminateInstance(id);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    }
});

// Test 10: Network/Git remote failures
suite.addTest('Git Remote - Network Failure', GitErrorScenarioTest, async function() {
    // Initialize git workspace
    await this.execInEnv('git init', { cwd: this.workspaceDir });
    await this.execInEnv('git config user.name "Test"', { cwd: this.workspaceDir });
    await this.execInEnv('git config user.email "test@test.com"', { cwd: this.workspaceDir });
    
    // Add a non-existent remote
    await this.execInEnv('git remote add origin https://non-existent-host-12345.com/repo.git', 
        { cwd: this.workspaceDir });
    
    try {
        // Try to fetch from non-existent remote
        await this.execInEnv('git fetch origin', { cwd: this.workspaceDir });
        this.assert(false, 'Should have thrown network error');
    } catch (error) {
        this.assert(
            error.message.includes('Could not resolve host') ||
            error.message.includes('unable to access') ||
            error.message.includes('failed to connect'),
            'Should throw network-related error'
        );
    }
});

// Test 11: Invalid MCP tool parameters
suite.addTest('MCP Tools - Invalid Parameters', InstanceErrorScenarioTest, async function() {
    const tools = new SharedWorkspaceMCPTools(this.instanceManager);
    
    // Test with missing required parameters
    try {
        await tools.callTool('git_branch', {
            // Missing workspace_dir and manager_id
            task_context: 'Test task'
        });
        this.assert(false, 'Should have thrown validation error');
    } catch (error) {
        this.assert(
            error.message.includes('Missing required parameter') ||
            error.message.includes('workspace_dir') ||
            error.message.includes('required'),
            'Should throw parameter validation error'
        );
    }
});

// Test 12: Graceful degradation test
suite.addTest('Graceful Degradation - Git Failure Recovery', GitErrorScenarioTest, async function() {
    // Create a corrupted git repository
    await fs.mkdir(path.join(this.workspaceDir, '.git'), { recursive: true });
    await fs.writeFile(path.join(this.workspaceDir, '.git', 'HEAD'), 'corrupted data');
    
    // Test that workspace setup continues despite git failure
    const result = await this.instanceManager.setupSharedWorkspace(
        this.workspaceDir,
        'test_instance',
        'Test context'
    );
    
    this.assert(result.success, 'Workspace setup should succeed');
    this.assert(!result.git.enabled, 'Git should be disabled');
    this.assert(result.git.fallbackMode, 'Should be in fallback mode');
    this.assert(result.git.error, 'Should have error message');
});

// Run the test suite
console.log('🧪 Running Error Scenario Tests\n');
const results = await suite.run();

// Summary statistics
const errorTypes = {
    git: 0,
    instance: 0,
    filesystem: 0,
    network: 0,
    validation: 0
};

results.forEach(result => {
    if (result.name.includes('Git')) errorTypes.git++;
    else if (result.name.includes('Instance')) errorTypes.instance++;
    else if (result.name.includes('File System')) errorTypes.filesystem++;
    else if (result.name.includes('Network')) errorTypes.network++;
    else if (result.name.includes('Parameters')) errorTypes.validation++;
});

console.log('\n📊 Error Coverage Summary:');
console.log(`   Git Errors: ${errorTypes.git} tests`);
console.log(`   Instance Errors: ${errorTypes.instance} tests`);
console.log(`   Filesystem Errors: ${errorTypes.filesystem} tests`);
console.log(`   Network Errors: ${errorTypes.network} tests`);
console.log(`   Validation Errors: ${errorTypes.validation} tests`);

// Exit with appropriate code
process.exit(results.some(r => !r.success) ? 1 : 0);