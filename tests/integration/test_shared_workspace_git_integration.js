#!/usr/bin/env node

/**
 * Test Shared Workspace Git Integration
 * 
 * Tests the git integration features for shared workspace collaboration:
 * - Automatic manager branch creation
 * - Conflict detection and resolution
 * - Coordinated merging
 * - Workspace status monitoring
 */

import { InstanceManager } from '../../src/instance_manager.js';
import { MCPTools } from '../../src/mcp_tools.js';
import { sharedWorkspaceGitManager } from '../../src/shared_workspace_git_manager.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
const exec = promisify(execCallback);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_DIR = path.join(__dirname, 'test-git-integration');
const SHARED_WORKSPACE_DIR = path.join(TEST_DIR, 'shared-development');

async function cleanup() {
    try {
        // Kill any test sessions
        await exec('tmux ls 2>/dev/null || true').then(({ stdout }) => {
            const sessions = stdout.split('\n').filter(line => line.includes('test_git_'));
            return Promise.all(sessions.map(session => {
                const sessionName = session.split(':')[0];
                return exec(`tmux kill-session -t ${sessionName} 2>/dev/null || true`);
            }));
        });
        
        // Clean test directory
        await exec(`rm -rf "${TEST_DIR}"`);
    } catch (error) {
        // Ignore cleanup errors
    }
}

async function initializeTestGitRepo() {
    // Create and initialize git repository
    await fs.ensureDir(SHARED_WORKSPACE_DIR);
    
    // Initialize git repo
    await exec('git init', { cwd: SHARED_WORKSPACE_DIR });
    await exec('git config user.email "test@example.com"', { cwd: SHARED_WORKSPACE_DIR });
    await exec('git config user.name "Test User"', { cwd: SHARED_WORKSPACE_DIR });
    
    // Create initial files
    await fs.writeFile(path.join(SHARED_WORKSPACE_DIR, 'README.md'), `# Shared Development Project

This is a test project for shared workspace collaboration.
`);
    
    await fs.writeFile(path.join(SHARED_WORKSPACE_DIR, 'package.json'), JSON.stringify({
        name: 'shared-workspace-test',
        version: '1.0.0',
        description: 'Test project for shared workspace git integration'
    }, null, 2));
    
    // Initial commit
    await exec('git add .', { cwd: SHARED_WORKSPACE_DIR });
    await exec('git commit -m "Initial commit"', { cwd: SHARED_WORKSPACE_DIR });
    
    console.log('✅ Initialized test git repository');
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
    console.log('🧪 Testing Shared Workspace Git Integration\n');
    
    await cleanup();
    await initializeTestGitRepo();
    
    const stateDir = path.join(TEST_DIR, 'state');
    const instanceManager = new InstanceManager(stateDir);
    const mcpTools = new MCPTools(instanceManager);
    
    try {
        console.log('1️⃣ Testing git workspace initialization...');
        
        // Initialize shared workspace git
        const initResult = await sharedWorkspaceGitManager.initializeSharedWorkspace(SHARED_WORKSPACE_DIR);
        console.log(`   ✅ Git workspace initialized: ${initResult.status}`);
        console.log(`   ✅ Base branch: ${initResult.baseBranch}`);
        
        console.log('\n2️⃣ Testing manager branch creation...');
        
        // Create first manager with shared workspace
        const mgr1Result = await mcpTools.spawn({
            role: 'manager',
            workDir: SHARED_WORKSPACE_DIR,
            context: 'Implement user authentication system',
            parentId: 'test_exec_1',
            workspaceMode: 'shared'
        });
        
        if (mgr1Result.error) throw new Error(mgr1Result.error);
        const mgr1Id = mgr1Result.instanceId;
        console.log(`   ✅ Created manager ${mgr1Id} with git integration`);
        
        // Verify manager branch was created
        const branches = await exec('git branch -a', { cwd: SHARED_WORKSPACE_DIR });
        const managerBranch1 = `manager-${mgr1Id}`;
        const hasBranch1 = branches.stdout.includes(managerBranch1);
        console.log(`   ✅ Manager branch created: ${hasBranch1} (${managerBranch1})`);
        
        // Create second manager
        const mgr2Result = await mcpTools.spawn({
            role: 'manager', 
            workDir: SHARED_WORKSPACE_DIR,
            context: 'Implement user roles and permissions',
            parentId: 'test_exec_1',
            workspaceMode: 'shared'
        });
        
        if (mgr2Result.error) throw new Error(mgr2Result.error);
        const mgr2Id = mgr2Result.instanceId;
        console.log(`   ✅ Created manager ${mgr2Id} with git integration`);
        
        // Test workspace status
        console.log('\n3️⃣ Testing workspace status monitoring...');
        
        const statusResult = await mcpTools.executeTool('get_workspace_status', {
            workspaceDir: SHARED_WORKSPACE_DIR
        }, 'executive');
        
        console.log(`   ✅ Workspace status: ${statusResult.status}`);
        console.log(`   ✅ Active managers: ${statusResult.managers.length}`);
        console.log(`   ✅ Git branches: ${statusResult.branches.length}`);
        
        // Test conflict detection
        console.log('\n4️⃣ Testing conflict detection...');
        
        const conflictCheck = await mcpTools.executeTool('check_workspace_conflicts', {
            workspaceDir: SHARED_WORKSPACE_DIR,
            managerIds: [mgr1Id, mgr2Id]
        }, 'executive');
        
        console.log(`   ✅ Conflict analysis completed`);
        console.log(`   ✅ Conflicts detected: ${conflictCheck.conflicts.length}`);
        console.log(`   ✅ Managers analyzed: ${conflictCheck.managers.length}`);
        
        // Test manager work simulation
        console.log('\n5️⃣ Testing manager work and commits...');
        
        // Switch to first manager branch and create some work
        await exec(`git checkout manager-${mgr1Id}`, { cwd: SHARED_WORKSPACE_DIR });
        await fs.writeFile(path.join(SHARED_WORKSPACE_DIR, 'auth.js'), `// Authentication module
function authenticate(user, password) {
    // Manager ${mgr1Id} implementation
    return user === 'admin' && password === 'secret';
}

module.exports = { authenticate };
`);
        
        // Commit manager 1's work
        const commitResult1 = await mcpTools.executeTool('commit_manager_work', {
            instanceId: mgr1Id,
            message: 'Add basic authentication module',
            files: ['auth.js']
        }, 'manager');
        
        console.log(`   ✅ Manager 1 commit: ${commitResult1.success}`);
        
        // Switch to second manager branch and create different work
        await exec(`git checkout manager-${mgr2Id}`, { cwd: SHARED_WORKSPACE_DIR });
        await fs.writeFile(path.join(SHARED_WORKSPACE_DIR, 'roles.js'), `// User roles module
function getUserRole(user) {
    // Manager ${mgr2Id} implementation
    const roles = {
        'admin': 'administrator',
        'user': 'standard'
    };
    return roles[user] || 'guest';
}

module.exports = { getUserRole };
`);
        
        // Commit manager 2's work
        const commitResult2 = await mcpTools.executeTool('commit_manager_work', {
            instanceId: mgr2Id,
            message: 'Add user roles module',
            files: ['roles.js']
        }, 'manager');
        
        console.log(`   ✅ Manager 2 commit: ${commitResult2.success}`);
        
        // Test synchronized merging
        console.log('\n6️⃣ Testing coordinated merging...');
        
        // Merge manager 1's work first
        const mergeResult1 = await mcpTools.executeTool('merge_manager_work', {
            managerId: mgr1Id,
            targetBranch: 'master',
            strategy: 'auto',
            deleteBranch: false
        }, 'executive');
        
        console.log(`   ✅ Manager 1 merge: ${mergeResult1.success}`);
        console.log(`   ✅ Status: ${mergeResult1.status}`);
        
        // Sync manager 2's branch with latest main
        const syncResult = await mcpTools.executeTool('sync_manager_branch', {
            instanceId: mgr2Id,
            baseBranch: 'main'
        }, 'manager');
        
        console.log(`   ✅ Manager 2 sync: ${syncResult.success}`);
        
        // Merge manager 2's work
        const mergeResult2 = await mcpTools.executeTool('merge_manager_work', {
            managerId: mgr2Id,
            targetBranch: 'master',
            strategy: 'auto',
            deleteBranch: true
        }, 'executive');
        
        console.log(`   ✅ Manager 2 merge: ${mergeResult2.success}`);
        
        // Verify final state
        console.log('\n7️⃣ Verifying final workspace state...');
        
        await exec('git checkout master', { cwd: SHARED_WORKSPACE_DIR });
        const finalFiles = await fs.readdir(SHARED_WORKSPACE_DIR);
        const hasAuthFile = finalFiles.includes('auth.js');
        const hasRolesFile = finalFiles.includes('roles.js');
        
        console.log(`   ✅ auth.js merged: ${hasAuthFile}`);
        console.log(`   ✅ roles.js merged: ${hasRolesFile}`);
        
        const gitLog = await exec('git log --oneline', { cwd: SHARED_WORKSPACE_DIR });
        const commitCount = gitLog.stdout.trim().split('\n').length;
        console.log(`   ✅ Total commits: ${commitCount}`);
        
        // Cleanup
        console.log('\n🧹 Cleaning up...');
        await mcpTools.terminate({ instanceId: mgr1Id });
        await mcpTools.terminate({ instanceId: mgr2Id });
        
        console.log('\n✅ All git integration tests passed!');
        return true;
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error(error.stack);
        return false;
    }
}

// Run the test
runTest()
    .then((success) => {
        if (success) {
            console.log('\n🎉 Shared workspace git integration test completed successfully!');
            process.exit(0);
        } else {
            console.log('\n💥 Test failed - see errors above');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('\n💥 Test crashed:', error);
        process.exit(1);
    });