#!/usr/bin/env node

/**
 * Test Native MCP Access
 * 
 * This test spawns an executive instance and verifies it has
 * native access to MCP tools without needing the bridge.
 */

import { InstanceManager } from '../src/instance_manager.js';

async function testNativeMCP() {
    console.log('=== Testing Native MCP Tool Access ===\n');
    
    const manager = new InstanceManager('./state');
    
    try {
        // Spawn an executive
        console.log('1. Spawning executive instance...');
        const { instanceId } = await manager.spawnInstance(
            'executive',
            './test_native_mcp_workspace',
            'Test Executive with Native MCP Tools',
            null
        );
        
        console.log(`   ✓ Created executive: ${instanceId}\n`);
        
        // Wait for initialization
        await new Promise(r => setTimeout(r, 8000));
        
        // Send test command
        console.log('2. Testing MCP tool access...');
        await manager.sendToInstance(
            instanceId,
            'Check if you have access to MCP tools. List all available tools and specifically look for: spawn, list, send, read, terminate. Format your response as "MCP_TOOLS: [list of MCP tools found]" if you have them, or "NO_MCP_TOOLS" if not.'
        );
        
        // Wait for response
        await new Promise(r => setTimeout(r, 5000));
        
        // Read output
        console.log('3. Reading response...\n');
        const { output } = await manager.readFromInstance(instanceId, 50);
        
        // Check for MCP tools
        if (output.includes('spawn') && output.includes('list') && output.includes('send')) {
            console.log('✓ SUCCESS! Executive has native MCP tool access!');
            console.log('\nThis means:');
            console.log('- No bridge workaround needed');
            console.log('- Executives can directly spawn managers');
            console.log('- The hierarchical orchestration pattern works natively');
            
            // Test actual spawning
            console.log('\n4. Testing actual spawn capability...');
            await manager.sendToInstance(
                instanceId,
                'Use the spawn MCP tool to create a manager instance with role="manager", workDir=".", and context="Test manager from native MCP"'
            );
            
            await new Promise(r => setTimeout(r, 5000));
            
            const { output: spawnOutput } = await manager.readFromInstance(instanceId, 30);
            if (spawnOutput.includes('mgr_')) {
                console.log('   ✓ Successfully spawned a manager using native MCP tools!');
            }
        } else {
            console.log('✗ MCP tools not found');
            console.log('\nRelevant output:');
            console.log(output.slice(-500));
        }
        
        // Clean up
        console.log('\n5. Cleaning up...');
        await manager.terminateInstance(instanceId);
        
    } catch (error) {
        console.error('Error:', error);
    }
}

testNativeMCP().catch(console.error);