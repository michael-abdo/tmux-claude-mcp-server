#!/usr/bin/env node
/**
 * Test real spawning using the existing infrastructure
 */

import { InstanceManager } from '../src/instance_manager.js';
import { MCPTools } from '../src/mcp_tools.js';
import { spawnWithConfirmation } from '../src/orchestration/spawn_helpers.js';
import { ExecutiveOrchestrator } from '../src/orchestration/executive_orchestrator.js';
import { monitorAllProgress, generateProgressReport } from '../src/orchestration/monitor_progress.js';

async function main() {
    console.log('=== Testing Real Orchestration with Calculator Project ===\n');
    
    // Initialize the instance manager and tools
    const instanceManager = new InstanceManager('./test-state-orchestration');
    const mcpTools = new MCPTools(instanceManager);
    
    // Create a wrapper for the tools
    const tools = {
        spawn: (params) => mcpTools.spawn(params),
        send: (params) => mcpTools.send(params),
        read: (params) => mcpTools.read(params),
        list: (params) => mcpTools.list(params),
        terminate: (params) => mcpTools.terminate(params),
        getProgress: (params) => mcpTools.getProgress(params),
        getGitBranch: (params) => mcpTools.getGitBranch(params)
    };
    
    const projectDir = '/tmp/calculator-project-' + Date.now();
    
    try {
        console.log('1. Testing spawn with confirmation...\n');
        
        const executiveContext = `You are the Executive for a Calculator Project.

# Calculator Project Requirements

Create a command-line calculator with:
1. Basic operations: add, subtract, multiply, divide
2. Advanced operations: square root, power
3. History of calculations
4. Error handling

IMPORTANT ORCHESTRATION INSTRUCTIONS:
1. First, create a PROJECT_PLAN.md file outlining the work breakdown
2. Then spawn ONE Manager at a time using the pattern from your prompt
3. Wait for Manager confirmation before proceeding
4. Use MCP tools (spawn, send, read) - NOT bash commands

Start by creating the project plan, then spawn an Implementation Manager.`;

        // Spawn Executive with confirmation
        const result = await spawnWithConfirmation(tools, {
            role: 'executive',
            workDir: projectDir,
            context: executiveContext
        });
        
        console.log('Spawn result:', result);
        
        if (result.status === 'ready') {
            console.log('✅ Executive spawned and confirmed understanding!\n');
            
            // Give some instructions
            console.log('2. Sending initial instructions...\n');
            await tools.send({
                instanceId: result.instanceId,
                text: 'Please start by creating PROJECT_PLAN.md with your work breakdown, then spawn an Implementation Manager.'
            });
            
            // Wait for Executive to work
            console.log('3. Waiting 20 seconds for Executive to work...\n');
            await new Promise(resolve => setTimeout(resolve, 20000));
            
            // Check progress
            console.log('4. Checking progress...\n');
            const progress = await monitorAllProgress(tools);
            const report = generateProgressReport(progress);
            console.log(report);
            
            console.log(`\n✨ Executive is running in tmux session: claude_${result.instanceId}`);
            console.log(`   To interact: tmux attach -t claude_${result.instanceId}`);
            
        } else {
            console.log('❌ Executive failed to confirm understanding');
        }
        
    } catch (error) {
        console.error('Error during test:', error);
    }
    
    console.log('\n=== Test Complete ===');
}

main().catch(console.error);