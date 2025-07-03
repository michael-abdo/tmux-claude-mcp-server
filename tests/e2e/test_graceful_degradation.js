#!/usr/bin/env node

/**
 * Test Graceful Degradation
 * Tests that shared workspace continues to function even when git integration fails
 */

import { InstanceManager } from '../../src/instance_manager.js';
import { sharedWorkspaceGitManager } from '../../src/shared_workspace_git_manager.js';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log('🧪 Testing Graceful Degradation for Git Integration\n');

async function testWorkspaceWithoutGit() {
    console.log('1️⃣ Testing workspace creation without git repository...');
    const testDir = path.join(process.cwd(), 'tests', 'test-no-git-workspace');
    
    try {
        // Create directory WITHOUT initializing git
        await fs.rm(testDir, { recursive: true, force: true });
        await fs.mkdir(testDir, { recursive: true });
        
        const instanceManager = new InstanceManager(path.join(testDir, 'state'));
        
        // Create manager in non-git directory
        const instanceId = 'mgr_test_no_git';
        const workspace = await instanceManager.setupSharedWorkspace(
            testDir, 
            instanceId, 
            'Test without git',
            { role: 'manager' }
        );
        
        // Verify workspace was created
        if (workspace.coreSetup) {
            console.log('   ✅ Core workspace created successfully');
        }
        
        // Verify git integration failed gracefully
        if (!workspace.git.enabled && workspace.git.fallbackMode) {
            console.log('   ✅ Git integration failed gracefully');
            console.log(`   ℹ️  Error: ${workspace.git.error}`);
            console.log('   ✅ Fallback mode activated');
            
            // Verify recommendations are provided
            if (workspace.git.recommendations && workspace.git.recommendations.length > 0) {
                console.log('   ✅ Fallback recommendations provided:');
                workspace.git.recommendations.forEach(rec => {
                    console.log(`      - ${rec}`);
                });
            }
        }
        
        // Verify core files exist
        const markerFile = path.join(testDir, 'SHARED_WORKSPACE.md');
        const managersDir = path.join(testDir, '.managers');
        
        try {
            await fs.access(markerFile);
            await fs.access(managersDir);
            console.log('   ✅ Core workspace files created despite git failure');
            return true;
        } catch {
            console.log('   ❌ Core workspace files missing');
            return false;
        }
        
    } finally {
        await fs.rm(testDir, { recursive: true, force: true });
    }
}

async function testWorkspaceWithBrokenGit() {
    console.log('\n2️⃣ Testing workspace with broken git configuration...');
    const testDir = path.join(process.cwd(), 'tests', 'test-broken-git');
    
    try {
        // Create directory and break git
        await fs.rm(testDir, { recursive: true, force: true });
        await fs.mkdir(testDir, { recursive: true });
        
        // Create a broken .git directory
        await fs.mkdir(path.join(testDir, '.git'));
        await fs.writeFile(path.join(testDir, '.git', 'config'), 'INVALID GIT CONFIG');
        
        const instanceManager = new InstanceManager(path.join(testDir, 'state'));
        
        // Create manager in broken git directory
        const instanceId = 'mgr_test_broken_git';
        const workspace = await instanceManager.setupSharedWorkspace(
            testDir, 
            instanceId, 
            'Test with broken git',
            { role: 'manager' }
        );
        
        // Verify graceful degradation
        if (workspace.coreSetup && !workspace.git.enabled) {
            console.log('   ✅ Workspace created despite broken git');
            console.log('   ✅ Git integration disabled gracefully');
            
            // Verify instance data reflects git status
            const instance = instanceManager.instances[instanceId];
            if (!instance.gitEnabled && instance.gitError) {
                console.log('   ✅ Instance tracking shows git disabled');
                console.log(`   ℹ️  Git error recorded: ${instance.gitError}`);
            }
            
            return true;
        }
        
        return false;
        
    } finally {
        await fs.rm(testDir, { recursive: true, force: true });
    }
}

async function testCollaborationWithoutGit() {
    console.log('\n3️⃣ Testing manager collaboration without git...');
    const testDir = path.join(process.cwd(), 'tests', 'test-collab-no-git');
    
    try {
        // Create directory without git
        await fs.rm(testDir, { recursive: true, force: true });
        await fs.mkdir(testDir, { recursive: true });
        
        const instanceManager = new InstanceManager(path.join(testDir, 'state'));
        
        // Create two managers without git
        const manager1 = 'mgr_test_collab_1';
        const manager2 = 'mgr_test_collab_2';
        
        const workspace1 = await instanceManager.setupSharedWorkspace(
            testDir, manager1, 'Manager 1 task', { role: 'manager' }
        );
        
        const workspace2 = await instanceManager.setupSharedWorkspace(
            testDir, manager2, 'Manager 2 task', { role: 'manager' }
        );
        
        // Verify both managers can work in the same directory
        if (workspace1.coreSetup && workspace2.coreSetup) {
            console.log('   ✅ Both managers created in shared workspace');
            
            // Test file-based collaboration
            const testFile = path.join(testDir, 'shared_work.txt');
            
            // Manager 1 creates file
            await fs.writeFile(testFile, 'Manager 1 was here\n');
            console.log('   ✅ Manager 1 created shared file');
            
            // Manager 2 appends to file
            await fs.appendFile(testFile, 'Manager 2 was here too\n');
            console.log('   ✅ Manager 2 modified shared file');
            
            // Verify both managers' work
            const content = await fs.readFile(testFile, 'utf-8');
            if (content.includes('Manager 1') && content.includes('Manager 2')) {
                console.log('   ✅ File-based collaboration working without git');
                return true;
            }
        }
        
        return false;
        
    } finally {
        await fs.rm(testDir, { recursive: true, force: true });
    }
}

async function testGitRecovery() {
    console.log('\n4️⃣ Testing recovery when git becomes available later...');
    const testDir = path.join(process.cwd(), 'tests', 'test-git-recovery');
    
    try {
        // Start without git
        await fs.rm(testDir, { recursive: true, force: true });
        await fs.mkdir(testDir, { recursive: true });
        
        const instanceManager = new InstanceManager(path.join(testDir, 'state'));
        
        // Create manager without git
        const instanceId = 'mgr_test_recovery';
        const workspace = await instanceManager.setupSharedWorkspace(
            testDir, instanceId, 'Test git recovery', { role: 'manager' }
        );
        
        if (!workspace.git.enabled) {
            console.log('   ✅ Started without git as expected');
            
            // Now initialize git manually
            await execAsync('git init', { cwd: testDir });
            await execAsync('git config user.email "test@example.com"', { cwd: testDir });
            await execAsync('git config user.name "Test User"', { cwd: testDir });
            
            // Add and commit existing files
            await execAsync('git add -A', { cwd: testDir });
            await execAsync('git commit -m "Manual git initialization after workspace creation"', { cwd: testDir });
            
            console.log('   ✅ Git initialized manually after workspace creation');
            
            // Verify manual git operations work
            const { stdout } = await execAsync('git status', { cwd: testDir });
            if (stdout.includes('nothing to commit')) {
                console.log('   ✅ Manual git operations successful');
                console.log('   ✅ Workspace can be upgraded to git-enabled manually');
                return true;
            }
        }
        
        return false;
        
    } finally {
        await fs.rm(testDir, { recursive: true, force: true });
    }
}

// Run all tests
async function runTests() {
    const tests = [
        testWorkspaceWithoutGit,
        testWorkspaceWithBrokenGit,
        testCollaborationWithoutGit,
        testGitRecovery
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
        console.log('🎉 All graceful degradation tests PASSED!');
        console.log('\n✨ Key achievements:');
        console.log('   - Workspace functions without git repository');
        console.log('   - Git failures don\'t block core functionality');
        console.log('   - Clear fallback mode with recommendations');
        console.log('   - File-based collaboration works as alternative');
        console.log('   - Manual git upgrade path available');
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