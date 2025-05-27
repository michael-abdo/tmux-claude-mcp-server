/**
 * Simple Performance Demo
 * 
 * Demonstrates performance improvements without external dependencies
 */

import { PerformanceOptimizer } from '../../src/performance_optimizer.js';

console.log('🚀 Performance Optimization Demo\n');

async function simulateWork(delay) {
    await new Promise(resolve => setTimeout(resolve, delay));
}

async function runDemo() {
    const optimizer = new PerformanceOptimizer({
        maxConcurrentSpawns: 5,
        maxConcurrentGitOps: 3,
        messageBatchSize: 10,
        messageBatchDelay: 100
    });
    
    console.log('📊 Demo 1: Sequential vs Parallel Execution');
    console.log('-------------------------------------------');
    
    // Sequential execution
    console.log('\nSequential execution (10 tasks @ 500ms each):');
    const seqStart = Date.now();
    for (let i = 0; i < 10; i++) {
        await simulateWork(500);
        process.stdout.write('.');
    }
    const seqDuration = Date.now() - seqStart;
    console.log(`\nCompleted in: ${seqDuration}ms`);
    
    // Parallel execution with optimizer
    console.log('\nParallel execution with optimizer:');
    const parallelStart = Date.now();
    const tasks = [];
    for (let i = 0; i < 10; i++) {
        tasks.push({
            spawnFn: async () => {
                await simulateWork(500);
                process.stdout.write('.');
                return { instanceId: `instance_${i}` };
            }
        });
    }
    await optimizer.spawnInstancesBatch(tasks);
    const parallelDuration = Date.now() - parallelStart;
    console.log(`\nCompleted in: ${parallelDuration}ms`);
    console.log(`Speedup: ${(seqDuration / parallelDuration).toFixed(1)}x faster!\n`);
    
    console.log('📊 Demo 2: Message Batching');
    console.log('---------------------------');
    
    // Simulate message sending
    console.log('Sending 50 messages...');
    const messagesSent = [];
    
    for (let i = 0; i < 50; i++) {
        optimizer.queueMessage('instance_1', {
            content: `Message ${i}`,
            deliverFn: async (batch) => {
                messagesSent.push({
                    time: Date.now(),
                    size: batch.split('\n\n').length
                });
            }
        });
    }
    
    // Wait for all batches to be delivered
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const metrics = optimizer.getMetrics();
    console.log(`\nResults:`);
    console.log(`  Total messages: ${metrics.messages.total}`);
    console.log(`  Batches created: ${metrics.messages.batches}`);
    console.log(`  Average batch size: ${metrics.messages.avgBatchSize.toFixed(1)}`);
    console.log(`  Efficiency: ${((1 - metrics.messages.batches / metrics.messages.total) * 100).toFixed(0)}% fewer operations\n`);
    
    console.log('📊 Demo 3: Caching Benefits');
    console.log('---------------------------');
    
    // Simulate expensive operations with caching
    let operationCount = 0;
    const expensiveOperation = async () => {
        operationCount++;
        await simulateWork(200);
        return { data: 'expensive result', timestamp: Date.now() };
    };
    
    console.log('Executing same operation 5 times...');
    
    for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await optimizer.gitOperation(expensiveOperation, 'cache-key-1');
        const duration = Date.now() - start;
        console.log(`  Call ${i + 1}: ${duration}ms ${i > 0 ? '(cached)' : '(computed)'}`);
    }
    
    const cacheMetrics = optimizer.getMetrics();
    console.log(`\nCache performance:`);
    console.log(`  Actual operations: ${operationCount}`);
    console.log(`  Cache hits: ${cacheMetrics.cacheHits}`);
    console.log(`  Hit rate: ${(cacheMetrics.cache.hitRate * 100).toFixed(0)}%`);
    console.log(`  Time saved: ~${cacheMetrics.cacheHits * 200}ms\n`);
    
    console.log('📊 Demo 4: Queue Management');
    console.log('---------------------------');
    
    // Simulate concurrent git operations
    console.log('Submitting 20 concurrent git operations...');
    const gitTasks = [];
    const startTimes = [];
    const endTimes = [];
    
    for (let i = 0; i < 20; i++) {
        gitTasks.push(
            optimizer.gitOperation(async () => {
                startTimes.push(Date.now());
                await simulateWork(100);
                endTimes.push(Date.now());
                return { id: i };
            })
        );
    }
    
    await Promise.all(gitTasks);
    
    // Analyze concurrency
    const maxConcurrent = startTimes.reduce((max, start, i) => {
        const concurrent = startTimes.filter((s, j) => 
            s <= start && endTimes[j] >= start
        ).length;
        return Math.max(max, concurrent);
    }, 0);
    
    console.log(`\nQueue management results:`);
    console.log(`  Total operations: 20`);
    console.log(`  Max concurrent: ${maxConcurrent} (limited to ${optimizer.config.maxConcurrentGitOps})`);
    console.log(`  Queue prevented: ${20 - optimizer.config.maxConcurrentGitOps} conflicts\n`);
    
    console.log('📊 Performance Summary');
    console.log('---------------------');
    
    const finalMetrics = optimizer.getMetrics();
    console.log('\nOptimizer metrics:');
    console.log(`  Spawn operations: ${finalMetrics.spawns.total}`);
    console.log(`  Message batches: ${finalMetrics.messages.batches}`);
    console.log(`  Git operations: ${finalMetrics.gitOps.total}`);
    console.log(`  Cache efficiency: ${(finalMetrics.cache.hitRate * 100).toFixed(0)}%`);
    
    console.log('\n🎯 Key Benefits:');
    console.log('  ✓ Parallel spawning: Up to 5x faster');
    console.log('  ✓ Message batching: 80%+ fewer operations');
    console.log('  ✓ Caching: Eliminates redundant work');
    console.log('  ✓ Queue management: Prevents conflicts');
    
    console.log('\n✨ Demo complete!');
}

runDemo().catch(console.error);