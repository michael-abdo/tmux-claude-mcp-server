#!/usr/bin/env node
/**
 * Monitor the existing Executive and help it spawn Managers
 */

import { InstanceManager } from '../src/instance_manager.js';
import { MCPTools } from '../src/mcp_tools.js';
import { monitorAllProgress, generateProgressReport } from '../src/orchestration/monitor_progress.js';

async function main() {
    console.log('=== Monitoring Existing Executive ===\n');
    
    const instanceManager = new InstanceManager('./test-state-orchestration');
    const mcpTools = new MCPTools(instanceManager);
    
    const tools = {
        spawn: (params) => mcpTools.spawn(params),
        send: (params) => mcpTools.send(params),
        read: (params) => mcpTools.read(params),
        list: (params) => mcpTools.list(params),
        getProgress: (params) => mcpTools.getProgress(params),
        getGitBranch: (params) => mcpTools.getGitBranch(params)
    };
    
    try {
        // Check current progress
        console.log('1. Checking current orchestration state...\n');
        const progress = await monitorAllProgress(tools);
        console.log(generateProgressReport(progress));
        
        // Send instruction to the Executive
        console.log('2. Instructing Executive to create PROJECT_PLAN.md...\n');
        await tools.send({
            instanceId: 'exec_499745',
            text: 'Please create PROJECT_PLAN.md with the calculator project breakdown. After creating the plan, spawn an Implementation Manager using the MCP spawn tool with the confirmation pattern from your prompt.'
        });
        
        // Wait for Executive to work
        console.log('3. Waiting 15 seconds for Executive to create plan...\n');
        await new Promise(resolve => setTimeout(resolve, 15000));
        
        // Check progress again
        console.log('4. Checking progress after instructions...\n');
        const progress2 = await monitorAllProgress(tools);
        console.log(generateProgressReport(progress2));
        
        // If no managers yet, provide more specific help
        if (progress2.managers.length === 0) {
            console.log('5. Providing spawn example to Executive...\n');
            await tools.send({
                instanceId: 'exec_499745',
                text: `Here's the exact pattern to spawn a Manager:

const { instanceId } = await spawn({
    role: 'manager',
    workDir: '/tmp/calculator-project-1748185499745',
    context: 'You are the Implementation Manager for the Calculator Project...'
});

Then follow with the confirmation pattern as shown in your prompt.`
            });
            
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            const progress3 = await monitorAllProgress(tools);
            console.log('\nFinal progress check:');
            console.log(generateProgressReport(progress3));
        }
        
        console.log('\n=== Monitoring Complete ===');
        console.log('Executive session: tmux attach -t claude_exec_499745');
        
    } catch (error) {
        console.error('Error:', error);
    }
}

main().catch(console.error);