#!/usr/bin/env node
/**
 * Help the existing Executive spawn managers
 */

import { InstanceManager } from '../src/instance_manager.js';
import { MCPTools } from '../src/mcp_tools.js';

async function main() {
    console.log('=== Helping Executive Spawn Managers ===\n');
    
    const instanceManager = new InstanceManager('./test-state-orchestration');
    const mcpTools = new MCPTools(instanceManager);
    
    try {
        console.log('1. Sending spawn instructions to Executive...\n');
        
        await mcpTools.send({
            instanceId: 'exec_499745',
            text: `Please use the MCP spawn tool to create an Implementation Manager. Here's an example:

await spawn({
    role: 'manager',
    workDir: '/tmp/calculator-project-1748185499745',
    context: 'You are the Implementation Manager for the Calculator Project. Your tasks: 1) Implement basic operations 2) Implement advanced operations 3) Add error handling'
});

After spawning, use the confirmation pattern from your prompt.`
        });
        
        console.log('Sent spawn instructions.');
        console.log('\n2. Waiting 10 seconds for Executive to spawn Manager...\n');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Check if any managers were spawned
        const instances = await mcpTools.list();
        console.log('Current instances:');
        console.log(JSON.stringify(instances, null, 2));
        
        const managers = instances.filter(i => i.role === 'manager');
        if (managers.length > 0) {
            console.log(`\n✅ Success! Executive spawned ${managers.length} Manager(s)`);
        } else {
            console.log('\n⚠️  No Managers spawned yet');
            console.log('You can check the Executive session: tmux attach -t claude_exec_499745');
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

main().catch(console.error);