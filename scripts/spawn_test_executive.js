#!/usr/bin/env node
/**
 * Spawn a real Executive instance to test the orchestration improvements
 */

import { MCPClient } from '../src/mcp_client.js';
import { ExecutiveOrchestrator } from '../src/orchestration/executive_orchestrator.js';
import { monitorAllProgress, generateProgressReport } from '../src/orchestration/monitor_progress.js';

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
        
        console.log('2. Spawning Executive with new orchestration pattern...\n');
        
        const executiveContext = `You are the Executive for a Calculator Project.

PROJECT REQUIREMENTS:
${projectRequirements}

IMPORTANT: Use the new orchestration patterns:
1. Create PROJECT_PLAN.md before spawning any Managers
2. Use the spawn confirmation pattern shown in your prompt
3. Spawn Managers one at a time with clear task lists
4. Monitor progress every few minutes

Break this down into 2-3 Managers maximum:
- Implementation Manager (for calculator logic)
- Testing Manager (for unit tests)
- Documentation Manager (if needed)`;

        // Spawn the Executive
        const { instanceId } = await tools.spawn({
            role: 'executive',
            workDir: '/tmp/calculator-project',
            context: executiveContext
        });
        
        console.log(`Executive spawned: ${instanceId}\n`);
        
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Send confirmation request
        console.log('3. Requesting confirmation from Executive...\n');
        await tools.send({
            targetInstanceId: instanceId,
            message: "Please confirm you understand the Calculator Project by replying 'READY: Executive'"
        });
        
        // Wait and check for confirmation
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const response = await tools.read({ instanceId });
        console.log('Executive response:', response);
        
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
                targetInstanceId: instanceId,
                message: `Please proceed with spawning Managers for the Calculator Project. Remember to:
1. Use the spawn tool (not bash commands)
2. Follow the confirmation pattern in your prompt
3. Create an Implementation Manager first`
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