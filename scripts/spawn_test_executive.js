#!/usr/bin/env node
/**
 * Spawn a real Executive instance to test the orchestration improvements
 */

import { MCPClient } from '../src/mcp_client.js';
import { ExecutiveOrchestrator } from '../src/orchestration/executive_orchestrator.js';
import { monitorAllProgress, generateProgressReport } from '../src/orchestration/monitor_progress.js';
import { spawnExecutiveWithBridge } from '../src/orchestration/spawn_helpers.js';

async function main() {
    console.log('=== Spawning Test Executive with Orchestration Improvements ===\n');
    
    const client = new MCPClient();
    await client.connect();
    
    const tools = client.tools;
    
    // Test project: Simple Calculator
    const projectRequirements = `# Calculator Project

Create a command-line calculator with the following features:
1. Basic operations: add, subtract, multiply, divide
2. Advanced operations: square root, power, factorial
3. Memory functions: store, recall, clear
4. History of last 10 calculations
5. Help command showing all operations

Requirements:
- Written in JavaScript
- Modular design with separate files for different operations
- Include unit tests
- Add error handling for invalid inputs`;

    try {
        // Use ExecutiveOrchestrator to spawn the Executive
        const orchestrator = new ExecutiveOrchestrator(tools, '/tmp/calculator-project');
        
        console.log('1. Creating project plan...\n');
        await orchestrator.createProjectPlan(projectRequirements);
        
        console.log('2. Spawning Executive with MCP Bridge knowledge...\n');
        
        // Use the new bridge-aware spawning
        const result = await spawnExecutiveWithBridge(
            tools,
            projectRequirements,
            '/tmp/calculator-project'
        );
        
        if (result.status !== 'ready') {
            throw new Error(`Executive failed to initialize: ${result.message}`);
        }
        
        const { instanceId } = result;
        console.log(`Executive spawned and confirmed: ${instanceId}`);
        console.log(`Confirmation: ${result.message}\n`);
        
        // Monitor the Executive
        console.log('\n4. Monitoring Executive progress...\n');
        
        // Give the Executive time to work
        console.log('Letting Executive work for 30 seconds...');
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        // Check progress
        const progress = await monitorAllProgress(tools);
        const report = generateProgressReport(progress);
        console.log(report);
        
        // Check if Executive spawned any Managers
        if (progress.managers.length > 0) {
            console.log('✅ Executive successfully spawned Managers!');
            console.log(`Managers created: ${progress.managers.length}`);
        } else {
            console.log('⚠️  No Managers spawned yet');
        }
        
        // Send instruction to spawn managers if needed
        if (progress.managers.length === 0) {
            console.log('\n5. Instructing Executive to spawn Managers...\n');
            await tools.send({
                instanceId: instanceId,
                text: `Please proceed with spawning Managers for the Calculator Project. Remember to:
1. Use the MCP Bridge commands shown in your context
2. Example: Bash("cd ../.. && node scripts/mcp_bridge.js spawn '{...}'")
3. Create an Implementation Manager first with specific tasks`
            });
            
            // Wait and check again
            await new Promise(resolve => setTimeout(resolve, 20000));
            const progress2 = await monitorAllProgress(tools);
            console.log('\nUpdated progress:');
            console.log(generateProgressReport(progress2));
        }
        
        console.log('\n=== Test Complete ===');
        console.log(`Executive instance: ${instanceId}`);
        console.log('You can interact with it using: tmux attach -t claude_' + instanceId);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.disconnect();
    }
}

main().catch(console.error);