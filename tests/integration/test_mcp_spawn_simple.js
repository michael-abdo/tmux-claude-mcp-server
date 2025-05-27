#!/usr/bin/env node

/**
 * Simple MCP Spawn Test
 * 
 * Basic test to verify executive can spawn a manager using native MCP tools
 */

import { InstanceManager } from '../src/instance_manager.js';
import fs from 'fs/promises';

async function testSimpleSpawn() {
    console.log('=== Simple MCP Spawn Test ===\n');
    
    const manager = new InstanceManager('./state');
    const testDir = `simple_spawn_test_${Date.now()}`;
    
    try {
        // Create test directory
        await fs.mkdir(testDir, { recursive: true });
        
        // Spawn executive
        console.log('1. Spawning executive...');
        const { instanceId: execId } = await manager.spawnInstance(
            'executive',
            testDir,
            'Simple test executive - spawn one manager using MCP tools'
        );
        console.log(`   ✓ Executive created: ${execId}`);
        
        // Wait for full initialization
        console.log('\n2. Waiting for initialization...');
        await new Promise(r => setTimeout(r, 10000));
        
        // Check MCP tools
        console.log('\n3. Checking MCP tools...');
        await manager.sendToInstance(execId, 'Can you see the MCP tools: spawn, list, send, read, terminate?');
        await new Promise(r => setTimeout(r, 3000));
        
        const { output: toolCheck } = await manager.readFromInstance(execId, 30);
        console.log('   Tool check output:', toolCheck.includes('spawn') ? 'Found spawn tool' : 'No spawn tool found');
        
        // Try to spawn
        console.log('\n4. Attempting to spawn manager...');
        await manager.sendToInstance(
            execId,
            'Please use the tmux-claude:spawn tool to create a manager. The parameters should be: {"role": "manager", "workDir": ".", "context": "Simple test manager"}'
        );
        
        // Wait longer for spawn
        console.log('   Waiting for spawn to complete...');
        await new Promise(r => setTimeout(r, 10000));
        
        // Check results
        console.log('\n5. Checking results...');
        const { output: spawnOutput } = await manager.readFromInstance(execId, 50);
        
        // Look for manager ID
        const mgrMatch = spawnOutput.match(/mgr_\d+/);
        if (mgrMatch) {
            console.log(`   ✓ Manager spawned: ${mgrMatch[0]}`);
        } else {
            console.log('   ✗ No manager ID found in output');
            console.log('\nLast 20 lines of output:');
            const lines = spawnOutput.split('\n').slice(-20);
            lines.forEach(line => console.log('   |', line));
        }
        
        // List instances
        const instances = await manager.listInstances();
        console.log(`\n6. Active instances: ${instances.length}`);
        instances.forEach(inst => {
            console.log(`   - ${inst.instanceId} (${inst.role})`);
        });
        
        // Cleanup
        console.log('\n7. Cleaning up...');
        for (const inst of instances) {
            await manager.terminateInstance(inst.instanceId);
            console.log(`   ✓ Terminated ${inst.instanceId}`);
        }
        
        await fs.rm(testDir, { recursive: true, force: true });
        
    } catch (error) {
        console.error('\nError:', error);
    }
}

testSimpleSpawn().catch(console.error);