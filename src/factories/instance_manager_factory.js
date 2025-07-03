/**
 * Factory for creating InstanceManager instances
 * 
 * Provides different implementations based on environment and requirements:
 * - Production: Full-featured with Redis and performance optimizations
 * - Test: Mocked dependencies for fast, isolated testing
 * - Basic: Simple file-based implementation
 */

import { InstanceManager } from '../instance_manager.js';
import { OptimizedInstanceManager } from '../optimized_instance_manager.js';
import { EventEmitter } from 'events';

export class InstanceManagerFactory {
    /**
     * Create an InstanceManager instance based on type and environment
     * @param {string} type - Type of manager: 'optimized', 'basic', or 'mock'
     * @param {Object} options - Configuration options
     * @returns {InstanceManager} Configured instance manager
     */
    static create(type = 'default', options = {}) {
        const isTest = process.env.NODE_ENV === 'test';
        
        // In test mode, always return mock unless explicitly overridden
        if (isTest && options.forceProduction !== true) {
            return this.createMockManager(type, options);
        }
        
        switch (type) {
            case 'optimized':
                return this.createOptimizedManager(options);
                
            case 'basic':
                return this.createBasicManager(options);
                
            case 'mock':
                return this.createMockManager('optimized', options);
                
            default:
                // Default to optimized in production, basic in test
                return isTest 
                    ? this.createBasicManager(options)
                    : this.createOptimizedManager(options);
        }
    }
    
    /**
     * Create optimized manager with Redis and performance features
     */
    static createOptimizedManager(options = {}) {
        const { stateDir = './state', ...otherOptions } = options;
        return new OptimizedInstanceManager(stateDir, otherOptions);
    }
    
    /**
     * Create basic file-based manager
     */
    static createBasicManager(options = {}) {
        const { stateDir = './state', ...otherOptions } = options;
        return new InstanceManager(stateDir, { 
            ...otherOptions, 
            useRedis: false 
        });
    }
    
    /**
     * Create mock manager for testing
     */
    static createMockManager(baseType = 'optimized', options = {}) {
        const { stateDir = './test-state', ...otherOptions } = options;
        
        // Create mock dependencies
        const mockDependencies = {
            redisClient: this.createMockRedisClient(),
            performanceOptimizer: this.createMockPerformanceOptimizer(),
            eventEmitter: new EventEmitter()
        };
        
        let manager;
        
        if (baseType === 'optimized') {
            manager = new OptimizedInstanceManager(
                stateDir,
                { ...otherOptions, useRedis: false },
                mockDependencies
            );
        } else {
            manager = new InstanceManager(stateDir, { 
                ...otherOptions, 
                useRedis: false 
            });
        }
        
        // Add missing methods for tests
        if (!manager.spawnInstancesBatch) {
            manager.spawnInstancesBatch = async function(instances) {
                const results = [];
                for (const inst of instances) {
                    // Handle both direct spawning and spawnFn
                    if (inst.spawnFn) {
                        const instance = await inst.spawnFn();
                        results.push(instance);
                    } else {
                        // Convert object format to individual parameters
                        const instance = await this.spawnInstance(
                            inst.role,
                            inst.workDir,
                            inst.context,
                            inst.parentId,
                            inst.options || { workspaceMode: inst.workspaceMode }
                        );
                        results.push(instance);
                    }
                }
                return results;
            };
        }
        
        if (!manager.prewarmInstances) {
            manager.prewarmInstances = async function(count) {
                // Mock pre-warming
                this.dependencies.performanceOptimizer.pools.instance = count;
                return count;
            };
        }
        
        if (!manager.gitOperation) {
            manager.gitOperation = async function(operation, cacheKey) {
                return this.optimizer.gitOperation(operation, cacheKey);
            };
        }
        
        return manager;
    }
    
    /**
     * Create mock Redis client
     */
    static createMockRedisClient() {
        const data = new Map();
        
        return {
            connected: true,
            data,
            
            async connect() {
                this.connected = true;
                return this;
            },
            
            async quit() {
                this.connected = false;
                return 'OK';
            },
            
            async get(key) {
                return data.get(key) || null;
            },
            
            async set(key, value, options = {}) {
                data.set(key, value);
                return 'OK';
            },
            
            async del(...keys) {
                let deleted = 0;
                for (const key of keys) {
                    if (data.delete(key)) deleted++;
                }
                return deleted;
            },
            
            async keys(pattern) {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return Array.from(data.keys()).filter(k => regex.test(k));
            },
            
            async hSet(key, field, value) {
                let hash = data.get(key) || {};
                hash[field] = value;
                data.set(key, hash);
                return 1;
            },
            
            async hGet(key, field) {
                const hash = data.get(key);
                return hash?.[field] || null;
            },
            
            async hGetAll(key) {
                return data.get(key) || {};
            },
            
            on(event, handler) {
                // Mock event handling
            }
        };
    }
    
    /**
     * Create mock performance optimizer
     */
    static createMockPerformanceOptimizer() {
        const queues = {
            spawn: [],
            git: [],
            messages: new Map()
        };
        
        const optimizer = {
            queues,
            metrics: {
                spawns: { total: 0, concurrent: 0, avgTime: 0 },
                messages: { total: 0, batches: 0, avgBatchSize: 0 },
                gitOps: { total: 0, concurrent: 0, avgTime: 0 },
                cacheHits: 0,
                cacheMisses: 0
            },
            pools: {
                instance: 0,
                worktree: 0
            },
            
            async spawnInstancesBatch(instances) {
                // Simulate batch spawning
                const results = [];
                for (const instance of instances) {
                    if (instance.spawnFn) {
                        try {
                            const result = await instance.spawnFn();
                            results.push(result);
                        } catch (error) {
                            results.push({ error: error.message });
                        }
                    } else {
                        results.push({
                            id: instance.instanceId || `test_${Date.now()}_${Math.random()}`,
                            role: instance.role,
                            status: 'active'
                        });
                    }
                }
                
                this.metrics.spawns.total += results.length;
                return results;
            },
            
            queueMessage(instanceId, message) {
                if (!this.queues.messages.has(instanceId)) {
                    this.queues.messages.set(instanceId, []);
                }
                this.queues.messages.get(instanceId).push(message);
                this.metrics.messages.total++;
            },
            
            async gitOperation(operation, cacheKey = null) {
                this.metrics.gitOps.total++;
                return operation();
            },
            
            async prewarmInstancePool(spawnFn, count) {
                // Mock pool warming
                return count;
            },
            
            async initializeWorktreePool(baseDir, branchManager) {
                // Mock worktree pool
                return true;
            },
            
            getMetrics() {
                return {
                    ...this.metrics,
                    queues: {
                        spawn: { size: this.queues.spawn.length, pending: 0 },
                        git: { size: this.queues.git.length, pending: 0 }
                    },
                    pools: { instance: 0, worktree: 0 },
                    cache: { size: 0, hitRate: 0 }
                };
            },
            
            async cleanup() {
                // Mock cleanup
            },
            
            on(event, handler) {
                // Mock event handling
            }
        };
    }
    
    /**
     * Create a manager with custom dependencies
     */
    static createWithDependencies(type, dependencies, options = {}) {
        const { stateDir = './state', ...otherOptions } = options;
        
        if (type === 'optimized') {
            return new OptimizedInstanceManager(stateDir, otherOptions, dependencies);
        } else {
            return new InstanceManager(stateDir, otherOptions);
        }
    }
}

// Export default factory method
export function createInstanceManager(type = 'default', options = {}) {
    return InstanceManagerFactory.create(type, options);
}