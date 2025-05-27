#!/usr/bin/env node
/**
 * Stress Tests for MCP Bridge
 * Tests concurrent operations and system limits
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

// Configuration
const STRESS_LEVELS = {
    light: { instances: 5, operations: 10, concurrency: 2 },
    medium: { instances: 10, operations: 50, concurrency: 5 },
    heavy: { instances: 20, operations: 100, concurrency: 10 }
};

// Get stress level from command line or default to light
const stressLevel = process.argv[2] || 'light';
const config = STRESS_LEVELS[stressLevel] || STRESS_LEVELS.light;

// Bridge helper
async function bridge(command, params = {}) {
    const cmd = `node scripts/mcp_bridge.js ${command} '${JSON.stringify(params)}'`;
    const start = Date.now();
    
    try {
        const { stdout } = await execAsync(cmd, {
            cwd: path.join(process.cwd()),
            timeout: 30000 // 30 second timeout
        });
        const duration = Date.now() - start;
        return { 
            ...JSON.parse(stdout), 
            duration,
            operation: command 
        };
    } catch (error) {
        const duration = Date.now() - start;
        return { 
            success: false, 
            error: error.message, 
            duration,
            operation: command 
        };
    }
}

// Performance tracker
class PerformanceTracker {
    constructor() {
        this.operations = [];
        this.errors = [];
        this.startTime = Date.now();
    }

    record(result) {
        this.operations.push(result);
        if (!result.success) {
            this.errors.push(result);
        }
    }

    getStats() {
        const totalDuration = Date.now() - this.startTime;
        const successful = this.operations.filter(op => op.success).length;
        const failed = this.operations.filter(op => !op.success).length;
        
        // Calculate operation statistics
        const opStats = {};
        const opTypes = ['spawn', 'list', 'send', 'read', 'terminate'];
        
        opTypes.forEach(type => {
            const ops = this.operations.filter(op => op.operation === type);
            const durations = ops.map(op => op.duration);
            
            opStats[type] = {
                count: ops.length,
                avgDuration: durations.length > 0 
                    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
                    : 0,
                minDuration: durations.length > 0 ? Math.min(...durations) : 0,
                maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
                failures: ops.filter(op => !op.success).length
            };
        });
        
        return {
            totalOperations: this.operations.length,
            successful,
            failed,
            errorRate: failed / this.operations.length,
            totalDuration,
            operationsPerSecond: (this.operations.length / totalDuration) * 1000,
            operationStats: opStats,
            errors: this.errors.slice(0, 5) // First 5 errors
        };
    }
}

// Stress test scenarios
class BridgeStressTest {
    constructor(config) {
        this.config = config;
        this.tracker = new PerformanceTracker();
        this.instances = [];
    }

    // Test 1: Concurrent spawn operations
    async testConcurrentSpawns() {
        console.log(`\n📊 Test 1: Concurrent Spawns (${this.config.instances} instances)`);
        
        const spawnPromises = [];
        for (let i = 0; i < this.config.instances; i++) {
            const promise = bridge('spawn', {
                role: 'manager',
                workDir: `/tmp/stress-test-${i}`,
                context: `Stress Test Manager ${i}`,
                parentId: null
            }).then(result => {
                this.tracker.record(result);
                if (result.success) {
                    this.instances.push(result.instanceId);
                }
                return result;
            });
            
            spawnPromises.push(promise);
            
            // Control concurrency
            if (spawnPromises.length >= this.config.concurrency) {
                await Promise.race(spawnPromises);
            }
        }
        
        await Promise.all(spawnPromises);
        
        const spawned = this.instances.length;
        console.log(`   ✓ Spawned ${spawned}/${this.config.instances} instances`);
        
        return spawned;
    }

    // Test 2: Concurrent list operations
    async testConcurrentLists() {
        console.log(`\n📊 Test 2: Concurrent List Operations`);
        
        const listPromises = [];
        for (let i = 0; i < this.config.operations; i++) {
            const promise = bridge('list').then(result => {
                this.tracker.record(result);
                return result;
            });
            
            listPromises.push(promise);
            
            if (listPromises.length >= this.config.concurrency) {
                await Promise.race(listPromises);
            }
        }
        
        await Promise.all(listPromises);
        
        const successful = listPromises.filter(p => p.success).length;
        console.log(`   ✓ Completed ${this.config.operations} list operations`);
    }

    // Test 3: Mixed concurrent operations
    async testMixedOperations() {
        console.log(`\n📊 Test 3: Mixed Concurrent Operations`);
        
        const operations = [];
        const instanceCount = Math.min(this.instances.length, 5);
        
        // Generate mixed operations
        for (let i = 0; i < this.config.operations; i++) {
            const opType = ['list', 'send', 'read'][i % 3];
            let promise;
            
            switch (opType) {
                case 'list':
                    promise = bridge('list');
                    break;
                case 'send':
                    const sendInstance = this.instances[i % instanceCount];
                    promise = bridge('send', {
                        instanceId: sendInstance,
                        text: `Stress test message ${i}`
                    });
                    break;
                case 'read':
                    const readInstance = this.instances[i % instanceCount];
                    promise = bridge('read', {
                        instanceId: readInstance,
                        lines: 10
                    });
                    break;
            }
            
            operations.push(promise.then(result => {
                this.tracker.record(result);
                return result;
            }));
            
            if (operations.length >= this.config.concurrency) {
                await Promise.race(operations);
            }
        }
        
        await Promise.all(operations);
        console.log(`   ✓ Completed ${operations.length} mixed operations`);
    }

    // Test 4: Rapid fire to single instance
    async testRapidFire() {
        console.log(`\n📊 Test 4: Rapid Fire Messages`);
        
        if (this.instances.length === 0) {
            console.log('   ⚠️  No instances available, skipping');
            return;
        }
        
        const targetInstance = this.instances[0];
        const messages = [];
        
        // Send messages as fast as possible
        for (let i = 0; i < 20; i++) {
            messages.push(bridge('send', {
                instanceId: targetInstance,
                text: `Rapid message ${i}`
            }).then(result => {
                this.tracker.record(result);
                return result;
            }));
        }
        
        await Promise.all(messages);
        console.log(`   ✓ Sent 20 rapid-fire messages`);
    }

    // Test 5: Spawn and immediate operations
    async testSpawnAndOperate() {
        console.log(`\n📊 Test 5: Spawn and Immediate Operations`);
        
        const operations = [];
        
        for (let i = 0; i < 5; i++) {
            operations.push((async () => {
                // Spawn
                const spawnResult = await bridge('spawn', {
                    role: 'specialist',
                    workDir: `/tmp/rapid-test-${i}`,
                    context: `Rapid Test Specialist ${i}`,
                    parentId: null
                });
                
                this.tracker.record(spawnResult);
                
                if (spawnResult.success) {
                    // Immediately send
                    const sendResult = await bridge('send', {
                        instanceId: spawnResult.instanceId,
                        text: 'Immediate message after spawn'
                    });
                    this.tracker.record(sendResult);
                    
                    // Immediately read
                    const readResult = await bridge('read', {
                        instanceId: spawnResult.instanceId,
                        lines: 5
                    });
                    this.tracker.record(readResult);
                    
                    // Add to cleanup
                    this.instances.push(spawnResult.instanceId);
                    
                    return { spawn: spawnResult, send: sendResult, read: readResult };
                }
                
                return { spawn: spawnResult };
            })());
        }
        
        const results = await Promise.all(operations);
        const successful = results.filter(r => r.spawn.success).length;
        console.log(`   ✓ Completed ${successful}/5 spawn-and-operate sequences`);
    }

    // Cleanup
    async cleanup() {
        console.log(`\n🧹 Cleaning up ${this.instances.length} test instances...`);
        
        const terminatePromises = this.instances.map(instanceId => 
            bridge('terminate', { instanceId }).then(result => {
                this.tracker.record(result);
                return result;
            }).catch(() => ({ success: false }))
        );
        
        await Promise.all(terminatePromises);
        
        const terminated = terminatePromises.filter(p => p.success).length;
        console.log(`   ✓ Terminated ${terminated}/${this.instances.length} instances`);
    }

    // Run all stress tests
    async runAllTests() {
        console.log(`🔥 MCP Bridge Stress Test - Level: ${stressLevel.toUpperCase()}`);
        console.log(`   Instances: ${this.config.instances}`);
        console.log(`   Operations: ${this.config.operations}`);
        console.log(`   Concurrency: ${this.config.concurrency}`);
        console.log(`   CPU Cores: ${os.cpus().length}`);
        console.log(`   Free Memory: ${Math.round(os.freemem() / 1024 / 1024)}MB`);
        
        try {
            // Run tests
            await this.testConcurrentSpawns();
            await this.testConcurrentLists();
            await this.testMixedOperations();
            await this.testRapidFire();
            await this.testSpawnAndOperate();
            
            // Cleanup
            await this.cleanup();
            
            // Report results
            const stats = this.tracker.getStats();
            
            console.log('\n📈 Performance Summary:');
            console.log(`   Total Operations: ${stats.totalOperations}`);
            console.log(`   Successful: ${stats.successful} (${Math.round((stats.successful/stats.totalOperations)*100)}%)`);
            console.log(`   Failed: ${stats.failed} (${Math.round(stats.errorRate*100)}%)`);
            console.log(`   Total Duration: ${Math.round(stats.totalDuration/1000)}s`);
            console.log(`   Operations/Second: ${stats.operationsPerSecond.toFixed(2)}`);
            
            console.log('\n📊 Operation Breakdown:');
            Object.entries(stats.operationStats).forEach(([op, data]) => {
                if (data.count > 0) {
                    console.log(`   ${op}:`);
                    console.log(`     Count: ${data.count}`);
                    console.log(`     Avg Duration: ${data.avgDuration}ms`);
                    console.log(`     Min/Max: ${data.minDuration}ms / ${data.maxDuration}ms`);
                    console.log(`     Failures: ${data.failures}`);
                }
            });
            
            if (stats.errors.length > 0) {
                console.log('\n❌ Sample Errors:');
                stats.errors.forEach(err => {
                    console.log(`   ${err.operation}: ${err.error.substring(0, 100)}...`);
                });
            }
            
            // Success criteria
            const acceptable = stats.errorRate < 0.1; // Less than 10% error rate
            
            if (acceptable) {
                console.log('\n✅ Stress test PASSED - Bridge is resilient!');
            } else {
                console.log('\n❌ Stress test FAILED - Error rate too high');
            }
            
            return acceptable;
            
        } catch (error) {
            console.error('\n💥 Stress test crashed:', error);
            await this.cleanup();
            return false;
        }
    }
}

// Run the stress test
if (process.argv[1] === new URL(import.meta.url).pathname) {
    const test = new BridgeStressTest(config);
    
    test.runAllTests()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}