#!/usr/bin/env node

/**
 * Quick test to verify atomic workspace setup
 * Tests that workspace files are properly committed during git integration
 */

import { InstanceManager } from '../../src/instance_manager.js';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

console.log('🧪 Testing Atomic Workspace Setup\n');

async function test() {
    const testDir = path.join(process.cwd(), 'tests', 'test-atomic-workspace');
    
    try {
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
        
        console.log('✅ Initialized test git repository');
        
        // Test workspace setup
        const instanceManager = new InstanceManager(path.join(testDir, 'state'));
        
        console.log('1️⃣ Testing atomic workspace setup...');
        
        const instanceId = 'mgr_test_001';
        const context = 'Test atomic workspace setup';
        
        // Call setupSharedWorkspace with git integration
        await instanceManager.setupSharedWorkspace(testDir, instanceId, context, {
            role: 'manager',
            parentId: 'exec_test'
        });
        
        console.log('2️⃣ Checking git status after workspace setup...');
        
        // Check git status - should be clean
        const { stdout: gitStatus } = await execAsync('git status --porcelain', { cwd: testDir });
        
        if (gitStatus.trim()) {
            console.log('❌ Working tree is dirty after workspace setup:');
            console.log(gitStatus);
            
            // Show what files exist
            const { stdout: lsOutput } = await execAsync('find . -type f', { cwd: testDir });
            console.log('📂 Files in workspace:');
            console.log(lsOutput);
            
            return false;
        } else {
            console.log('✅ Working tree is clean after workspace setup');
        }
        
        console.log('3️⃣ Checking committed files...');
        
        // Check what was committed
        const { stdout: logOutput } = await execAsync('git log --oneline', { cwd: testDir });
        console.log('📝 Git log:');
        console.log(logOutput);
        
        // Check that required files exist
        const requiredFiles = [
            'SHARED_WORKSPACE.md',
            '.claude/settings.json',
            '.gitattributes'
        ];
        
        let allFilesExist = true;
        for (const file of requiredFiles) {
            try {
                await fs.access(path.join(testDir, file));
                console.log(`✅ ${file} exists`);
            } catch {
                console.log(`❌ ${file} missing`);
                allFilesExist = false;
            }
        }
        
        if (allFilesExist) {
            console.log('\n🎉 Atomic workspace setup test PASSED!');
            console.log('✅ All workspace files created and committed');
            console.log('✅ Working tree left clean');
            console.log('✅ Ready for subsequent git operations');
            return true;
        } else {
            console.log('\n💥 Atomic workspace setup test FAILED - missing files');
            return false;
        }
        
    } catch (error) {
        console.error('💥 Test failed with error:', error.message);
        return false;
    } finally {
        // Cleanup
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch {}
    }
}

// Run test
test().then(success => {
    process.exit(success ? 0 : 1);
}).catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
});