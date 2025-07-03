/**
 * Performance optimization tests for large teams
 * 
 * Tests the performance improvements:
 * - Parallel instance spawning
 * - Message batching
 * - Git operation optimization
 * - Caching effectiveness
 * - Instance pooling
 */

// Import test setup first to configure mocks
import './setup/test-setup.js';

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { InstanceManagerFactory } from '../../src/factories/instance_manager_factory.js';
import { performanceOptimizer } from '../../src/performance_optimizer.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Test configuration
const TEST_BASE_DIR = path.join(os.tmpdir(), 'perf-test', Date.now().toString());

describe('Performance Optimizations', () => {
    let manager;
    let testDir;
    
    beforeEach(async () => {
        testDir = path.join(TEST_BASE_DIR, Math.random().toString(36).substring(7));
        await fs.mkdir(testDir, { recursive: true });
        
        // Use factory to create mock manager
        manager = InstanceManagerFactory.create('mock', {
            stateDir: path.join(testDir, 'state')
        });
        
        // Mock tmux operations
        manager.tmux = {
            createSession: async () => ({ success: true }),
            sendKeys: async () => ({ success: true }),
            capturePane: async () => 'Mock output',
            killSession: async () => ({ success: true })
        };
        
        // Mock git operations to prevent conflicts
        manager.gitManager = {
            ensureGitRepo: async () => ({ initialized: true }),
            gitCommand: async () => ({ stdout: '', stderr: '' }),
            initializeSharedWorkspace: async () => ({ status: 'initialized', baseBranch: 'master' })
        };
    });
    
    afterEach(async () => {
        if (manager) {
            await manager.cleanup();
        }
        await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    });
    
    describe('Parallel Instance Spawning', () => {
        test('should spawn multiple instances in parallel', async () => {
            const startTime = Date.now();
            const instances = [];
            
            // Prepare 10 instances with spawn functions
            for (let i = 0; i < 10; i++) {
                const instanceWorkDir = path.join(testDir, `spec-${i}`);
                instances.push({
                    role: 'specialist',
                    workDir: instanceWorkDir,
                    context: `Test specialist ${i}`,
                    parentId: 'mgr_1',
                    workspaceMode: 'isolated',
                    spawnFn: async () => {
                        // Create directory to avoid conflicts
                        await fs.mkdir(instanceWorkDir, { recursive: true }).catch(() => {});
                        return manager.spawnInstance({
                            role: 'specialist',
                            workDir: instanceWorkDir,
                            context: `Test specialist ${i}`,
                            parentId: 'mgr_1',
                            workspaceMode: 'isolated'
                        });
                    }
                });
            }
            
            // Spawn in parallel
            const results = await manager.spawnInstancesBatch(instances);
            const duration = Date.now() - startTime;
            
            // Verify all spawned
            assert.strictEqual(results.length, 10);
            assert.ok(results.every(r => r.instanceId));
            
            // Should be much faster than sequential (10 * 3000ms wait)
            assert.ok(duration < 5000, `Duration ${duration}ms should be less than 5000ms`);
            
            // Check metrics
            const metrics = manager.getPerformanceMetrics();
            assert.strictEqual(metrics.optimizer.spawns.total, 10);
        });
        
        test('should handle mixed workspace modes efficiently', async () => {
            const sharedDir = path.join(testDir, 'shared-workspace');
            await fs.mkdir(sharedDir, { recursive: true });
            
            const instances = [
                // 5 isolated specialists - each gets unique directory
                ...Array(5).fill(null).map((_, i) => {
                    const isolatedDir = path.join(testDir, 'isolated', `spec-${i}`);
                    return {
                        role: 'specialist',
                        workDir: isolatedDir,
                        context: `Isolated spec ${i}`,
                        workspaceMode: 'isolated',
                        options: { workspaceMode: 'isolated' },
                        spawnFn: async () => {
                            await fs.mkdir(isolatedDir, { recursive: true }).catch(() => {});
                            return manager.spawnInstance({
                                role: 'specialist',
                                workDir: isolatedDir,
                                context: `Isolated spec ${i}`,
                                workspaceMode: 'isolated'
                            });
                        }
                    };
                }),
                // 5 shared managers - all use same directory
                ...Array(5).fill(null).map((_, i) => ({
                    role: 'manager',
                    workDir: sharedDir,
                    context: `Shared manager ${i}`,
                    workspaceMode: 'shared',
                    options: { workspaceMode: 'shared' },
                    spawnFn: async () => {
                        return manager.spawnInstance({
                            role: 'manager',
                            workDir: sharedDir,
                            context: `Shared manager ${i}`,
                            workspaceMode: 'shared'
                        });
                    }
                }))
            ];
            
            const results = await manager.spawnInstancesBatch(instances);
            
            assert.strictEqual(results.length, 10);
            
            // Verify workspace modes
            const isolated = results.filter(r => r.workspaceMode === 'isolated');
            const shared = results.filter(r => r.workspaceMode === 'shared');
            
            assert.strictEqual(isolated.length, 5);
            assert.strictEqual(shared.length, 5);
        });
    });
    
    describe('Message Batching', () => {
        test('should batch messages for efficient delivery', async () => {
            // Create an instance
            const instance = await manager.spawnInstance('specialist', testDir, 'Test');
            
            // Send multiple messages quickly
            const promises = [];
            for (let i = 0; i < 20; i++) {
                promises.push(manager.sendMessage(instance.instanceId, `Message ${i}`, { batch: true }));
            }
            
            const results = await Promise.all(promises);
            assert.ok(results.every(r => r.status === 'queued'));
            
            // Wait for batch delivery
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Check metrics
            const metrics = performanceOptimizer.getMetrics();
            assert.ok(metrics.messages.total >= 20);
            assert.ok(metrics.messages.batches > 0);
            assert.ok(metrics.messages.avgBatchSize > 1);
        });
        
        test('should force batch delivery at size limit', async () => {
            const instance = await manager.spawnInstance('specialist', testDir, 'Test');
            
            // Send exactly batch size messages
            const batchSize = performanceOptimizer.config.messageBatchSize;
            for (let i = 0; i < batchSize; i++) {
                await manager.sendMessage(instance.instanceId, `Message ${i}`, { batch: true });
            }
            
            // Should have delivered immediately
            const metrics = performanceOptimizer.getMetrics();
            assert.ok(metrics.messages.batches > 0);
        });
    });
    
    describe('Git Operation Optimization', () => {
        test('should queue git operations with concurrency limit', async () => {
            const operations = [];
            const delays = [];
            
            // Create 10 git operations
            for (let i = 0; i < 10; i++) {
                const startTime = Date.now();
                operations.push(
                    manager.gitOperation(async () => {
                        // Simulate git operation
                        await new Promise(resolve => setTimeout(resolve, 100));
                        delays.push(Date.now() - startTime);
                        return { branch: `test-${i}` };
                    })
                );
            }
            
            const results = await Promise.all(operations);
            
            assert.strictEqual(results.length, 10);
            
            // Check that operations were queued (some should have waited)
            const maxConcurrent = performanceOptimizer.config.maxConcurrentGitOps;
            const waitingOps = delays.filter(d => d > 150).length;
            assert.ok(waitingOps > (10 - maxConcurrent - 1));
        });
        
        test('should cache git operation results', async () => {
            let callCount = 0;
            
            const operation = async () => {
                callCount++;
                return { status: 'clean', branch: 'main' };
            };
            
            // First call
            const result1 = await manager.gitOperation(operation, 'git-status-cache');
            assert.strictEqual(callCount, 1);
            assert.deepStrictEqual(result1, { status: 'clean', branch: 'main' });
            
            // Second call should use cache
            const result2 = await manager.gitOperation(operation, 'git-status-cache');
            assert.strictEqual(callCount, 1); // Should not increase
            assert.deepStrictEqual(result2, result1);
            
            // Check cache metrics
            const metrics = performanceOptimizer.getMetrics();
            assert.strictEqual(metrics.cacheHits, 1);
            assert.ok(metrics.cache.hitRate > 0);
        });
    });
    
    describe('Instance Pooling', () => {
        test('should pre-warm instance pool', async () => {
            await manager.prewarmInstances(5);
            
            const metrics = performanceOptimizer.getMetrics();
            assert.strictEqual(metrics.pools.instance, 5);
        });
        
        test('should reuse pooled instances', async () => {
            // Pre-warm pool
            await manager.prewarmInstances(3);
            
            // Spawn should be instant from pool
            const startTime = Date.now();
            const instance = await manager.spawnInstance('specialist', testDir, 'Test', null, { usePool: true });
            const duration = Date.now() - startTime;
            
            assert.ok(duration < 100, `Duration ${duration}ms should be less than 100ms`);
            assert.strictEqual(instance.reused, true);
            
            // Pool should have one less
            const metrics = performanceOptimizer.getMetrics();
            assert.strictEqual(metrics.pools.instance, 2);
        });
    });
    
    describe('Performance Metrics', () => {
        test('should track comprehensive metrics', async () => {
            // Perform various operations
            await manager.spawnInstancesBatch([
                { role: 'manager', workDir: testDir, context: 'Test 1' },
                { role: 'specialist', workDir: testDir, context: 'Test 2' }
            ]);
            
            await manager.gitOperation(async () => ({ status: 'clean' }), 'test-cache');
            await manager.gitOperation(async () => ({ status: 'clean' }), 'test-cache'); // Cache hit
            
            const instance = await manager.spawnInstance('specialist', testDir, 'Test');
            await manager.sendMessage(instance.instanceId, 'Test message', { batch: true });
            
            const metrics = manager.getPerformanceMetrics();
            
            // Verify metric structure
            assert.ok('optimizer' in metrics);
            assert.ok('instances' in metrics);
            assert.ok('redis' in metrics);
            
            assert.ok(metrics.optimizer.spawns.total > 0);
            assert.ok(metrics.optimizer.gitOps.total > 0);
            assert.ok(metrics.optimizer.messages.total > 0);
            assert.ok(metrics.optimizer.cache.hitRate > 0);
            
            assert.ok(metrics.instances.total > 0);
            assert.ok('manager' in metrics.instances.byRole);
            assert.ok('specialist' in metrics.instances.byRole);
        });
    });
    
    describe('Load Testing', () => {
        test('should handle 50+ concurrent instances efficiently', async () => {
            const startTime = Date.now();
            const instances = [];
            
            // Create 50 specialist instances
            for (let i = 0; i < 50; i++) {
                instances.push({
                    role: 'specialist',
                    workDir: path.join(testDir, `spec-${i}`),
                    context: `Load test specialist ${i}`,
                    parentId: `mgr_${Math.floor(i / 10)}` // 10 specialists per manager
                });
            }
            
            // Spawn all in parallel
            const results = await manager.spawnInstancesBatch(instances);
            const spawnDuration = Date.now() - startTime;
            
            assert.strictEqual(results.length, 50);
            assert.ok(spawnDuration < 15000, `Spawn duration ${spawnDuration}ms should be less than 15000ms`);
            
            // Send messages to all instances
            const messageStart = Date.now();
            const messagePromises = results.map(r => 
                manager.sendMessage(r.instanceId, 'Load test message', { batch: true })
            );
            
            await Promise.all(messagePromises);
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait for batch delivery
            
            const messageDuration = Date.now() - messageStart;
            assert.ok(messageDuration < 2000, `Message duration ${messageDuration}ms should be less than 2000ms`);
            
            // Check final metrics
            const metrics = manager.getPerformanceMetrics();
            console.log('Load test metrics:', JSON.stringify(metrics, null, 2));
            
            assert.strictEqual(metrics.instances.total, 50);
            assert.ok(metrics.optimizer.spawns.avgTime < 15000);
            assert.ok(metrics.optimizer.messages.batches > 0);
        });
    });
});

describe('Performance Comparison', () => {
    test('should show significant improvement over sequential operations', async () => {
        const testDir = path.join(TEST_BASE_DIR, 'comparison');
        await fs.mkdir(testDir, { recursive: true });
        
        const manager = InstanceManagerFactory.create('mock', {
            stateDir: path.join(testDir, 'state')
        });
        // Mock tmux operations
        manager.tmux = {
            createSession: async () => {
                await new Promise(resolve => setTimeout(resolve, 300)); // Simulate tmux delay
                return { success: true };
            },
            sendKeys: async () => ({ success: true }),
            capturePane: async () => 'Mock output',
            killSession: async () => ({ success: true })
        };
        
        // Sequential spawning
        const sequentialStart = Date.now();
        for (let i = 0; i < 5; i++) {
            await manager.spawnInstance('specialist', testDir, `Sequential ${i}`);
        }
        const sequentialDuration = Date.now() - sequentialStart;
        
        // Parallel spawning
        const parallelStart = Date.now();
        await manager.spawnInstancesBatch([
            { role: 'specialist', workDir: testDir, context: 'Parallel 1' },
            { role: 'specialist', workDir: testDir, context: 'Parallel 2' },
            { role: 'specialist', workDir: testDir, context: 'Parallel 3' },
            { role: 'specialist', workDir: testDir, context: 'Parallel 4' },
            { role: 'specialist', workDir: testDir, context: 'Parallel 5' }
        ]);
        const parallelDuration = Date.now() - parallelStart;
        
        console.log(`Sequential: ${sequentialDuration}ms, Parallel: ${parallelDuration}ms`);
        console.log(`Speedup: ${(sequentialDuration / parallelDuration).toFixed(2)}x`);
        
        // Parallel should be significantly faster
        assert.ok(parallelDuration < sequentialDuration * 0.5, 
            `Parallel ${parallelDuration}ms should be < 50% of sequential ${sequentialDuration}ms`);
        
        await manager.cleanup();
        await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
    });
});