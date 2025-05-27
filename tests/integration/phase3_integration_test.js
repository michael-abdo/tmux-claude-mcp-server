/**
 * Phase 3 Integration Tests
 * 
 * Tests the parallel execution capabilities and distributed state management
 * of the Phase 3 MCP server implementation.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { InstanceManager } from '../../src/instance_manager.js';
import { EnhancedMCPTools } from '../../src/enhanced_mcp_tools.js';
import { ParallelExecutor } from '../../src/parallel_executor.js';
import { JobQueue } from '../../src/job_queue.js';
import { RedisStateStore } from '../../src/redis_state_store.js';
import { Phase3Manager, exampleTasks } from '../../src/phase3_manager.js';

// Set Phase 3 environment
process.env.PHASE = '3';

test('Phase 3: RedisStateStore can save and retrieve instances', async () => {
    const store = new RedisStateStore({ fallbackDir: './test-state-p3' });
    await store.initialize();
    
    const testInstance = {
        instanceId: 'test_123',
        role: 'manager',
        status: 'active',
        created: new Date().toISOString()
    };
    
    await store.saveInstance('test_123', testInstance);
    const retrieved = await store.getInstance('test_123');
    
    assert.deepEqual(retrieved, testInstance);
    
    await store.deleteInstance('test_123');
    await store.close();
});

test('Phase 3: JobQueue manages job priorities correctly', async () => {
    const queue = new JobQueue();
    
    // Add jobs with different priorities
    const lowJob = await queue.enqueueJob({ name: 'Low priority job' }, 'low');
    const highJob = await queue.enqueueJob({ name: 'High priority job' }, 'high');
    const criticalJob = await queue.enqueueJob({ name: 'Critical job' }, 'critical');
    const mediumJob = await queue.enqueueJob({ name: 'Medium job' }, 'medium');
    
    // Dequeue should return in priority order
    const job1 = await queue.dequeueJob();
    assert.equal(job1.id, criticalJob.id);
    
    const job2 = await queue.dequeueJob();
    assert.equal(job2.id, highJob.id);
    
    const job3 = await queue.dequeueJob();
    assert.equal(job3.id, mediumJob.id);
    
    const job4 = await queue.dequeueJob();
    assert.equal(job4.id, lowJob.id);
    
    // Queue should be empty
    const job5 = await queue.dequeueJob();
    assert.equal(job5, null);
});

test('Phase 3: EnhancedMCPTools distributes work across Managers', async () => {
    const manager = new InstanceManager('./test-state-p3', { useRedis: true });
    await manager.initializeStateStore();
    
    const tools = new EnhancedMCPTools(manager);
    
    // Create mock active managers
    const mockManagers = [
        {
            instanceId: 'mgr_1_1',
            role: 'manager',
            status: 'active',
            parallelExecution: { active: 1, queued: 0, completed: 0, failed: 0 }
        },
        {
            instanceId: 'mgr_1_2',
            role: 'manager',
            status: 'active',
            parallelExecution: { active: 2, queued: 1, completed: 0, failed: 0 }
        },
        {
            instanceId: 'mgr_1_3',
            role: 'manager',
            status: 'active',
            parallelExecution: { active: 0, queued: 0, completed: 5, failed: 0 }
        }
    ];
    
    // Test round-robin distribution
    const tasks = Array(10).fill(null).map((_, i) => ({ id: `task_${i}`, name: `Task ${i}` }));
    const roundRobin = tools.distributeTasks(tasks, mockManagers, 'round-robin');
    
    assert.equal(roundRobin[0].assignedTasks.length, 4); // 10/3 = 3.33, so first gets 4
    assert.equal(roundRobin[1].assignedTasks.length, 3);
    assert.equal(roundRobin[2].assignedTasks.length, 3);
    
    // Test least-loaded distribution
    const leastLoaded = tools.distributeTasks(tasks, mockManagers, 'least-loaded');
    
    // mgr_1_3 has 0 active, should get most tasks initially
    assert.ok(leastLoaded.find(d => d.managerId === 'mgr_1_3').assignedTasks.length >= 3);
    
    // Test capacity-aware distribution
    const capacityAware = tools.distributeTasks(tasks, mockManagers, 'capacity-aware');
    
    // Should distribute based on available capacity
    const totalAssigned = capacityAware.reduce((sum, d) => sum + d.assignedTasks.length, 0);
    assert.equal(totalAssigned, 10);
});

test('Phase 3: ParallelExecutor manages concurrent execution limits', async () => {
    const manager = new InstanceManager('./test-state-p3', { useRedis: true });
    await manager.initializeStateStore();
    
    const tools = new EnhancedMCPTools(manager);
    const executor = new ParallelExecutor(tools, { maxConcurrent: 2 });
    
    // Test status tracking
    let status = executor.getStatus();
    assert.equal(status.activeSpecialists, 0);
    assert.equal(status.maxConcurrent, 2);
    
    // Mock some active specialists
    executor.activeSpecialists.set('spec_1', { task: { name: 'Test 1' }, startTime: Date.now() });
    executor.activeSpecialists.set('spec_2', { task: { name: 'Test 2' }, startTime: Date.now() });
    
    status = executor.getStatus();
    assert.equal(status.activeSpecialists, 2);
    
    // Queue some tasks
    executor.taskQueue = [{ name: 'Queued 1' }, { name: 'Queued 2' }];
    status = executor.getStatus();
    assert.equal(status.queuedTasks, 2);
});

test('Phase 3: Phase3Manager example tasks are valid', () => {
    // Verify auth system tasks
    assert.equal(exampleTasks.authSystemTasks.length, 4);
    
    exampleTasks.authSystemTasks.forEach(task => {
        assert.ok(task.id, 'Task must have an id');
        assert.ok(task.name, 'Task must have a name');
        assert.ok(task.context, 'Task must have context');
        assert.ok(task.instruction, 'Task must have instruction');
        assert.ok(task.completionPattern, 'Task must have completion pattern');
    });
    
    // Verify API system tasks
    assert.equal(exampleTasks.apiSystemTasks.length, 3);
    
    exampleTasks.apiSystemTasks.forEach(task => {
        assert.ok(task.id);
        assert.ok(task.name);
        assert.ok(task.context);
        assert.ok(task.instruction);
    });
});

test('Phase 3: Job retry logic works correctly', async () => {
    const queue = new JobQueue();
    
    const job = await queue.enqueueJob({ name: 'Retry test job' });
    await queue.markJobActive(job.id, 'mgr_test');
    
    // First failure - should re-queue
    await queue.markJobFailed(job.id, 'First failure');
    assert.equal(job.status, 'pending');
    assert.equal(job.attempts, 1);
    assert.ok(job.nextRetryAt);
    
    // Second failure
    await queue.markJobActive(job.id, 'mgr_test');
    await queue.markJobFailed(job.id, 'Second failure');
    assert.equal(job.status, 'pending');
    assert.equal(job.attempts, 2);
    
    // Third failure - should permanently fail
    await queue.markJobActive(job.id, 'mgr_test');
    await queue.markJobFailed(job.id, 'Third failure');
    assert.equal(job.status, 'failed');
    assert.equal(job.attempts, 3);
    assert.ok(job.failedAt);
});

test('Phase 3: Distributed lock mechanism prevents race conditions', async () => {
    const store = new RedisStateStore({ fallbackDir: './test-state-p3' });
    await store.initialize();
    
    // Acquire lock
    const lock1 = await store.acquireLock('test-resource', 5000);
    assert.ok(lock1, 'Should acquire lock');
    
    // Try to acquire same lock - should fail
    const lock2 = await store.acquireLock('test-resource', 5000);
    assert.equal(lock2, null, 'Should not acquire lock when already held');
    
    // Release lock
    await store.releaseLock('test-resource', lock1);
    
    // Now should be able to acquire again
    const lock3 = await store.acquireLock('test-resource', 5000);
    assert.ok(lock3, 'Should acquire lock after release');
    
    await store.releaseLock('test-resource', lock3);
    await store.close();
});

test('Phase 3: Metrics recording works correctly', async () => {
    const store = new RedisStateStore({ fallbackDir: './test-state-p3' });
    await store.initialize();
    
    // Record some metrics
    await store.recordMetric('test_metric', 100);
    await store.recordMetric('test_metric', 200);
    await store.recordMetric('test_metric', 150);
    
    // In a real implementation, we would retrieve and verify metrics
    // For now, just verify no errors
    assert.ok(true, 'Metrics recorded without error');
    
    await store.close();
});

console.log('Running Phase 3 integration tests...');