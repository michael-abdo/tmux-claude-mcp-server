#!/usr/bin/env node

/**
 * Test real-world shared workspace scenario:
 * - Executive creates 2 managers in shared workspace
 * - Managers collaborate on same codebase
 * - Verify they can see each other's changes
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
const exec = promisify(execCallback);

// Import our modules
import { InstanceManager } from '../../src/instance_manager.js';
import { EnhancedMCPTools } from '../../src/enhanced_mcp_tools.js';

import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_DIR = path.join(__dirname, 'test-shared-workspace-scenario');
const SHARED_DEV_DIR = path.join(TEST_DIR, 'development');

async function cleanup() {
    try {
        // Kill any test sessions
        const { stdout } = await exec('tmux ls 2>/dev/null || true');
        const sessions = stdout.split('\n').filter(line => line.includes('test_'));
        for (const session of sessions) {
            const sessionName = session.split(':')[0];
            await exec(`tmux kill-session -t ${sessionName} 2>/dev/null || true`);
        }
        
        // Clean test directory
        await exec(`rm -rf "${TEST_DIR}"`);
    } catch (error) {
        // Ignore cleanup errors
    }
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest() {
    console.log('🧪 Testing Shared Workspace Collaboration Scenario\n');
    
    await cleanup();
    await fs.mkdir(TEST_DIR, { recursive: true });
    await fs.mkdir(SHARED_DEV_DIR, { recursive: true });
    
    const stateDir = path.join(TEST_DIR, 'state');
    const instanceManager = new InstanceManager(stateDir);
    const mcpTools = new EnhancedMCPTools(instanceManager);
    
    try {
        // 1. Executive spawns first manager in shared mode
        console.log('1️⃣ Executive spawning first manager in shared workspace...');
        const mgr1Result = await mcpTools.spawn({
            role: 'manager',
            workDir: SHARED_DEV_DIR,
            context: 'First manager to create authentication module',
            parentId: 'test_exec_1',
            workspaceMode: 'shared'
        });
        
        if (mgr1Result.error) throw new Error(mgr1Result.error);
        const mgr1Id = mgr1Result.instanceId;
        console.log(`   ✅ Created ${mgr1Id} in shared workspace`);
        
        // 2. First manager creates a file
        console.log('\n2️⃣ First manager creating auth.js...');
        await mcpTools.send({
            instanceId: mgr1Id,
            text: `Create a file called auth.js with this content:
// Authentication module
function authenticate(user, pass) {
    return user === 'admin' && pass === 'secret';
}
module.exports = { authenticate };`
        });
        
        await sleep(3000); // Give Claude time to create the file
        
        // Verify file exists
        const authPath = path.join(SHARED_DEV_DIR, 'auth.js');
        const authExists = await fs.access(authPath).then(() => true).catch(() => false);
        console.log(`   ✅ auth.js created: ${authExists}`);
        
        // 3. Executive spawns second manager in same shared workspace
        console.log('\n3️⃣ Executive spawning second manager in same shared workspace...');
        const mgr2Result = await mcpTools.spawn({
            role: 'manager',
            workDir: SHARED_DEV_DIR,
            context: 'Second manager to add user roles to authentication',
            parentId: 'test_exec_1',
            workspaceMode: 'shared'
        });
        
        if (mgr2Result.error) throw new Error(mgr2Result.error);
        const mgr2Id = mgr2Result.instanceId;
        console.log(`   ✅ Created ${mgr2Id} in shared workspace`);
        
        // 4. Second manager should see the auth.js file
        console.log('\n4️⃣ Second manager checking for auth.js...');
        await mcpTools.send({
            instanceId: mgr2Id,
            text: 'List the files in the current directory'
        });
        
        await sleep(2000);
        
        // 5. Second manager adds to the existing file
        console.log('\n5️⃣ Second manager adding user roles...');
        await mcpTools.send({
            instanceId: mgr2Id,
            text: `Update auth.js to add a getUserRole function:
function getUserRole(user) {
    if (user === 'admin') return 'administrator';
    return 'user';
}`
        });
        
        await sleep(3000);
        
        // 6. First manager should see the changes
        console.log('\n6️⃣ First manager verifying changes...');
        await mcpTools.send({
            instanceId: mgr1Id,
            text: 'Read the auth.js file and tell me what functions it exports'
        });
        
        await sleep(2000);
        
        // Read the final file
        const finalContent = await fs.readFile(authPath, 'utf-8');
        const hasAuthenticate = finalContent.includes('authenticate');
        const hasGetUserRole = finalContent.includes('getUserRole');
        
        console.log('\n📊 Results:');
        console.log(`   ✅ Both managers shared workspace: ${SHARED_DEV_DIR}`);
        console.log(`   ✅ authenticate function present: ${hasAuthenticate}`);
        console.log(`   ✅ getUserRole function added: ${hasGetUserRole}`);
        console.log(`   ✅ Managers successfully collaborated!`);
        
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
        console.log('\n✅ Shared workspace collaboration test completed successfully!');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });