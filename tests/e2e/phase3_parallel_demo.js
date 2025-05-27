/**
 * Phase 3 Parallel Execution Demo
 * 
 * Demonstrates the full parallel execution capabilities of Phase 3
 * with multiple concurrent Specialists working under Managers.
 */

import { InstanceManager } from '../../src/instance_manager.js';
import { EnhancedMCPTools } from '../../src/enhanced_mcp_tools.js';
import { Phase3Manager, exampleTasks } from '../../src/phase3_manager.js';
import { JobQueue } from '../../src/job_queue.js';

// Set Phase 3 environment
process.env.PHASE = '3';
process.env.MAX_SPECIALISTS_PER_MANAGER = '4';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runParallelExecutionDemo() {
    console.log('=== Phase 3 Parallel Execution Demo ===\n');
    
    // Initialize components
    const instanceManager = new InstanceManager('./demo-state', { useRedis: true });
    await instanceManager.initializeStateStore();
    
    const mcpTools = new EnhancedMCPTools(instanceManager);
    const jobQueue = new JobQueue(instanceManager.stateStore);
    
    console.log('1. Spawning Executive instance...');
    const executive = await mcpTools.spawn({
        role: 'executive',
        workDir: '/tmp/phase3-demo',
        context: `# Executive: Phase 3 Demo
        
You are the Executive orchestrating a parallel build of an authentication system.
Your job is to spawn Managers and distribute work efficiently.`
    });
    console.log(`   ✓ Executive spawned: ${executive.instanceId}\n`);
    
    console.log('2. Executive spawning multiple Managers...');
    const managers = [];
    for (let i = 1; i <= 3; i++) {
        const manager = await mcpTools.spawn({
            role: 'manager',
            workDir: '/tmp/phase3-demo',
            context: `# Manager ${i}: Parallel Task Coordinator
            
You are Manager ${i} responsible for coordinating parallel Specialist execution.
You can run up to 4 Specialists concurrently.`,
            parentId: executive.instanceId
        }, 'executive');
        
        managers.push(manager);
        console.log(`   ✓ Manager ${i} spawned: ${manager.instanceId}`);
    }
    console.log('');
    
    console.log('3. Creating job queue with authentication system tasks...');
    const authJob = await jobQueue.enqueueJob({
        name: 'Authentication System',
        tasks: exampleTasks.authSystemTasks
    }, 'high');
    
    const apiJob = await jobQueue.enqueueJob({
        name: 'API Foundation',
        tasks: exampleTasks.apiSystemTasks
    }, 'medium');
    
    console.log(`   ✓ Job ${authJob.id} enqueued (4 tasks)`);
    console.log(`   ✓ Job ${apiJob.id} enqueued (3 tasks)\n`);
    
    console.log('4. Executive distributing work to Managers...');
    const allTasks = [...exampleTasks.authSystemTasks, ...exampleTasks.apiSystemTasks];
    
    const distribution = await mcpTools.distributeWork({
        tasks: allTasks,
        strategy: 'least-loaded'
    }, 'executive');
    
    console.log(`   ✓ Distributed ${distribution.totalTasks} tasks across ${distribution.managers} managers`);
    distribution.distribution.forEach(d => {
        console.log(`     - ${d.managerId}: ${d.tasksAssigned} tasks`);
    });
    console.log('');
    
    console.log('5. Simulating parallel execution monitoring...');
    
    // Simulate managers executing tasks in parallel
    for (let i = 0; i < 5; i++) {
        await sleep(1000);
        
        // Get current status
        const instances = await mcpTools.list({}, 'executive');
        const activeManagers = instances.filter(i => i.role === 'manager');
        
        console.log(`\n   [T+${i+1}s] Status Update:`);
        
        activeManagers.forEach(mgr => {
            if (mgr.parallelExecution) {
                const pe = mgr.parallelExecution;
                console.log(`     ${mgr.instanceId}: ${pe.active} active, ${pe.queued} queued, ${pe.completed} completed`);
            }
        });
        
        // Simulate some task completions
        if (i === 2) {
            console.log('\n   📊 Simulating task completions...');
            await jobQueue.markJobActive(authJob.id, managers[0].instanceId);
            await jobQueue.markJobCompleted(authJob.id, {
                completed: 4,
                failed: 0,
                duration: 15000
            });
        }
    }
    
    console.log('\n6. Checking final statistics...');
    const jobStats = jobQueue.getStatistics();
    console.log(`   Jobs: ${jobStats.completed} completed, ${jobStats.active} active, ${jobStats.pending} pending`);
    
    const instanceStats = await mcpTools.list({}, 'executive');
    console.log(`   Instances: ${instanceStats.length} total`);
    console.log(`     - Executive: ${instanceStats.filter(i => i.role === 'executive').length}`);
    console.log(`     - Managers: ${instanceStats.filter(i => i.role === 'manager').length}`);
    console.log(`     - Specialists: ${instanceStats.filter(i => i.role === 'specialist').length}`);
    
    console.log('\n7. Cleaning up instances...');
    
    // Terminate all managers (and their specialists)
    for (const manager of managers) {
        await mcpTools.terminate({
            instanceId: manager.instanceId,
            cascade: true
        }, 'executive');
        console.log(`   ✓ Terminated ${manager.instanceId} and its specialists`);
    }
    
    // Terminate executive
    await mcpTools.terminate({
        instanceId: executive.instanceId,
        cascade: false
    }, 'executive');
    console.log(`   ✓ Terminated ${executive.instanceId}`);
    
    console.log('\n=== Demo Complete ===');
    console.log('\nKey Phase 3 Features Demonstrated:');
    console.log('- Multiple Manager instances working in parallel');
    console.log('- Work distribution across Managers using strategies');
    console.log('- Job queue with priority handling');
    console.log('- Parallel execution monitoring');
    console.log('- Cascade termination of instance hierarchies');
    console.log('\nThe same MCP interface supports both sequential (Phase 2) and parallel (Phase 3) execution!');
}

// Run the demo
runParallelExecutionDemo().catch(console.error);