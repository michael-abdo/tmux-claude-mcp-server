#!/usr/bin/env node
/**
 * Test script for MCP Bridge operations
 * Tests all 5 bridge commands: list, spawn, send, read, terminate
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runBridgeCommand(command, params = {}) {
    const cmd = `node scripts/mcp_bridge.js ${command} '${JSON.stringify(params)}'`;
    console.log(`\n🔧 Running: ${cmd}`);
    
    try {
        const { stdout, stderr } = await execAsync(cmd, {
            cwd: '/Users/Mike/.claude/user/tmux-claude-mcp-server'
        });
        
        if (stderr && !stderr.includes('Loaded') && !stderr.includes('Instance Manager')) {
            console.error(`❌ Error output: ${stderr}`);
        }
        
        const result = JSON.parse(stdout);
        console.log(`✅ Success: ${JSON.stringify(result, null, 2)}`);
        return result;
    } catch (error) {
        console.error(`❌ Failed: ${error.message}`);
        throw error;
    }
}

async function testBridge() {
    console.log('🚀 Testing MCP Bridge Operations\n');
    
    let testInstanceId = null;
    
    try {
        // Test 1: List instances
        console.log('=== Test 1: List Instances ===');
        const listResult = await runBridgeCommand('list');
        console.log(`Found ${listResult.count} instances`);
        
        // Test 2: Spawn a test manager
        console.log('\n=== Test 2: Spawn Test Manager ===');
        const spawnResult = await runBridgeCommand('spawn', {
            role: 'manager',
            workDir: '/Users/Mike/.claude/user/tmux-claude-mcp-server',
            context: 'Test Manager for Bridge Testing. This is a temporary instance.',
            parentId: null
        });
        testInstanceId = spawnResult.instanceId;
        console.log(`Spawned instance: ${testInstanceId}`);
        
        // Wait for instance to initialize
        console.log('\nWaiting 10 seconds for instance to initialize...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Test 3: Send a message
        console.log('\n=== Test 3: Send Message ===');
        const sendResult = await runBridgeCommand('send', {
            instanceId: testInstanceId,
            text: 'Hello from bridge test! Please respond with "Bridge test received".'
        });
        
        // Wait for response
        console.log('\nWaiting 5 seconds for response...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Test 4: Read output
        console.log('\n=== Test 4: Read Output ===');
        const readResult = await runBridgeCommand('read', {
            instanceId: testInstanceId,
            lines: 50
        });
        
        // Test 5: List again to verify new instance
        console.log('\n=== Test 5: List After Spawn ===');
        const listResult2 = await runBridgeCommand('list');
        console.log(`Now have ${listResult2.count} instances`);
        
        // Test 6: Terminate the test instance
        console.log('\n=== Test 6: Terminate Test Instance ===');
        const terminateResult = await runBridgeCommand('terminate', {
            instanceId: testInstanceId
        });
        
        // Final verification
        console.log('\n=== Final Verification: List After Terminate ===');
        const finalList = await runBridgeCommand('list');
        console.log(`Final instance count: ${finalList.count}`);
        
        console.log('\n✅ All bridge tests completed successfully!');
        
    } catch (error) {
        console.error('\n❌ Bridge test failed:', error);
        
        // Cleanup if needed
        if (testInstanceId) {
            console.log('\nAttempting cleanup...');
            try {
                await runBridgeCommand('terminate', { instanceId: testInstanceId });
                console.log('Cleanup successful');
            } catch (cleanupError) {
                console.error('Cleanup failed:', cleanupError.message);
            }
        }
        
        process.exit(1);
    }
}

// Run the tests
testBridge().catch(console.error);