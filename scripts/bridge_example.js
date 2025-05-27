#!/usr/bin/env node
/**
 * MCP Bridge Example - Demonstrates all bridge operations
 * Run this to see the bridge in action
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Helper to run bridge commands
async function bridge(command, params = {}) {
    const cmd = `node scripts/mcp_bridge.js ${command} '${JSON.stringify(params)}'`;
    const { stdout } = await execAsync(cmd, {
        cwd: '/Users/Mike/.claude/user/tmux-claude-mcp-server'
    });
    return JSON.parse(stdout);
}

async function demonstrateBridge() {
    console.log('🌉 MCP Bridge Demonstration\n');
    
    try {
        // 1. List instances
        console.log('1️⃣  Listing all instances...');
        const list = await bridge('list');
        console.log(`   Found ${list.count} instances:`, list.instances.map(i => i.instanceId));
        
        // 2. Spawn a test manager
        console.log('\n2️⃣  Spawning a test manager...');
        const spawn = await bridge('spawn', {
            role: 'manager',
            workDir: '/tmp/bridge-demo',
            context: 'You are a Test Manager for demonstrating the MCP Bridge. Say "Hello from Test Manager!"'
        });
        const testId = spawn.instanceId;
        console.log(`   Spawned: ${testId}`);
        
        // 3. Wait for initialization
        console.log('\n3️⃣  Waiting 5 seconds for initialization...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // 4. Send a message
        console.log('\n4️⃣  Sending a message...');
        await bridge('send', {
            instanceId: testId,
            text: 'Please tell me about the MCP Bridge.'
        });
        console.log('   Message sent!');
        
        // 5. Read the output
        console.log('\n5️⃣  Reading instance output...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        const output = await bridge('read', {
            instanceId: testId,
            lines: 20
        });
        console.log('   Recent output:');
        console.log('   ' + output.output.split('\n').slice(-5).join('\n   '));
        
        // 6. List again to show new instance
        console.log('\n6️⃣  Listing instances again...');
        const list2 = await bridge('list');
        console.log(`   Now have ${list2.count} instances`);
        
        // 7. Terminate the test instance
        console.log('\n7️⃣  Terminating test instance...');
        await bridge('terminate', { instanceId: testId });
        console.log('   Instance terminated!');
        
        // 8. Final verification
        console.log('\n8️⃣  Final instance count...');
        const list3 = await bridge('list');
        console.log(`   Back to ${list3.count} instances`);
        
        console.log('\n✅ Bridge demonstration complete!');
        console.log('\nThe MCP Bridge is the official orchestration interface.');
        console.log('Use it in your executives and managers with Bash commands.\n');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Run the demonstration
demonstrateBridge().catch(console.error);