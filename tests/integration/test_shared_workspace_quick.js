#!/usr/bin/env node

/**
 * Quick test of shared workspace functionality
 */

import { InstanceManager } from '../../src/instance_manager.js';
import { EnhancedMCPTools } from '../../src/enhanced_mcp_tools.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
const exec = promisify(execCallback);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_DIR = path.join(__dirname, 'test-shared-quick');
const SHARED_DEV_DIR = path.join(TEST_DIR, 'development');

async function cleanup() {
    try {
        // Kill any test sessions
        await exec('tmux ls 2>/dev/null || true').then(({ stdout }) => {
            const sessions = stdout.split('\n').filter(line => line.includes('test_'));
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

async function runTest() {
    console.log('🧪 Quick Shared Workspace Test\n');
    
    await cleanup();
    await fs.mkdir(TEST_DIR, { recursive: true });
    await fs.mkdir(SHARED_DEV_DIR, { recursive: true });
    
    const stateDir = path.join(TEST_DIR, 'state');
    const instanceManager = new InstanceManager(stateDir);
    const mcpTools = new EnhancedMCPTools(instanceManager);
    
    try {
        // 1. Create test file in shared workspace
        console.log('1️⃣ Creating test file in shared workspace...');
        const testFile = path.join(SHARED_DEV_DIR, 'test.txt');
        await fs.writeFile(testFile, 'Initial content from test');
        
        // 2. Spawn first manager in shared mode
        console.log('\n2️⃣ Spawning first manager in shared mode...');
        const mgr1Result = await mcpTools.spawn({
            role: 'manager',
            workDir: SHARED_DEV_DIR,
            context: 'First manager',
            parentId: 'test_exec_1',
            workspaceMode: 'shared'
        });
        
        if (mgr1Result.error) throw new Error(mgr1Result.error);
        const mgr1Id = mgr1Result.instanceId;
        console.log(`   ✅ Created ${mgr1Id}`);
        console.log(`   ✅ Working in: ${SHARED_DEV_DIR}`);
        
        // 3. Spawn second manager in same shared workspace
        console.log('\n3️⃣ Spawning second manager in shared mode...');
        const mgr2Result = await mcpTools.spawn({
            role: 'manager',
            workDir: SHARED_DEV_DIR,
            context: 'Second manager',
            parentId: 'test_exec_1',
            workspaceMode: 'shared'
        });
        
        if (mgr2Result.error) throw new Error(mgr2Result.error);
        const mgr2Id = mgr2Result.instanceId;
        console.log(`   ✅ Created ${mgr2Id}`);
        console.log(`   ✅ Working in: ${SHARED_DEV_DIR}`);
        
        // 4. Verify both managers share the workspace
        const allInstances = await instanceManager.listInstances();
        console.log(`   Found ${allInstances.length} instances`);
        
        const mgr1 = allInstances.find(i => i.id === mgr1Id);
        const mgr2 = allInstances.find(i => i.id === mgr2Id);
        
        console.log('\n📊 Results:');
        if (mgr1 && mgr2) {
            console.log(`   ✅ Manager 1 workspace: ${mgr1.workDir}`);
            console.log(`   ✅ Manager 2 workspace: ${mgr2.workDir}`);
            console.log(`   ✅ Same workspace: ${mgr1.workDir === mgr2.workDir}`);
            console.log(`   ✅ Shared mode enabled: ${mgr1.isSharedWorkspace && mgr2.isSharedWorkspace}`);
        } else {
            console.log(`   ❌ Could not find instances: mgr1=${!!mgr1}, mgr2=${!!mgr2}`);
            console.log(`   Available instances: ${allInstances.map(i => i.id).join(', ')}`);
        }
        
        // Verify marker files
        const marker = await fs.readFile(path.join(SHARED_DEV_DIR, 'SHARED_WORKSPACE.md'), 'utf-8');
        console.log(`   ✅ SHARED_WORKSPACE.md exists: ${marker.includes('This is a shared workspace')}`);
        
        // Cleanup
        console.log('\n🧹 Cleaning up...');
        await mcpTools.terminate({ instanceId: mgr1Id });
        await mcpTools.terminate({ instanceId: mgr2Id });
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        throw error;
    }
}

// Run the test
runTest()
    .then(() => {
        console.log('\n✅ Quick shared workspace test completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });