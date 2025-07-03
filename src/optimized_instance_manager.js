/**
 * Optimized Instance Manager for Large Teams
 * 
 * Extends the base InstanceManager with performance optimizations:
 * - Parallel instance spawning
 * - Message batching and queuing
 * - Git operation optimization
 * - Instance pooling
 * - Real Redis integration
 */

import { InstanceManager } from './instance_manager.js';
import { performanceOptimizer } from './performance_optimizer.js';
import { createClient } from 'redis';
import { EventEmitter } from 'events';

export class OptimizedInstanceManager extends InstanceManager {
    constructor(stateDir = './state', options = {}, dependencies = {}) {
        // Check if we're in test environment
        const isTestEnvironment = process.env.NODE_ENV === 'test';
        
        // Force Redis for performance (unless in test mode or explicitly disabled)
        super(stateDir, { 
            ...options, 
            useRedis: !isTestEnvironment && (options.useRedis !== false)
        });
        
        // Allow dependency injection
        this.dependencies = dependencies;
        
        // Performance optimizer (can be injected)
        this.optimizer = dependencies.performanceOptimizer || performanceOptimizer;
        
        // Real Redis client (can be injected)
        this.redisClient = dependencies.redisClient || null;
        this.redisReady = !!dependencies.redisClient;
        
        // Event emitter for performance events
        this.perfEvents = dependencies.eventEmitter || new EventEmitter();
        
        // Batch spawn tracking
        this.pendingSpawns = new Map();
        
        // Initialize Redis connection only if not provided and not in test mode
        if (!this.redisClient && !isTestEnvironment) {
            this.initializeRedis();
        } else if (!this.redisClient && isTestEnvironment) {
            console.log('[TEST MODE] Skipping Redis initialization');
            // In test mode, create a mock Redis client if needed
            this._setupTestModeRedis();
        }
        
        // Setup performance monitoring
        this.setupPerformanceMonitoring();
    }
    
    /**
     * Setup mock Redis for test mode
     */
    _setupTestModeRedis() {
        // Import the mock dynamically to avoid production dependencies
        import('../tests/mocks/redis-mock.js').then(({ createClient }) => {
            this.redisClient = createClient();
            this.redisReady = true;
            
            // Replace mock Redis in state store if needed
            if (this.stateStore && this.stateStore.client) {
                this.stateStore.client = this.redisClient;
            }
        }).catch(err => {
            console.warn('[TEST MODE] Could not load Redis mock:', err.message);
        });
    }
    
    /**
     * Initialize real Redis connection
     */
    async initializeRedis() {
        // Skip in test environment
        if (process.env.NODE_ENV === 'test') {
            return;
        }
        
        try {
            this.redisClient = createClient({
                socket: {
                    host: process.env.REDIS_HOST || 'localhost',
                    port: process.env.REDIS_PORT || 6379,
                    reconnectStrategy: (retries) => Math.min(retries * 50, 500)
                },
                database: process.env.REDIS_DB || 0
            });
            
            this.redisClient.on('error', (err) => {
                console.error('Redis error:', err);
                this.redisReady = false;
            });
            
            this.redisClient.on('ready', () => {
                console.log('✓ Redis connected and ready');
                this.redisReady = true;
            });
            
            await this.redisClient.connect();
            
            // Replace mock Redis in state store
            if (this.stateStore && this.stateStore.client) {
                this.stateStore.client = this.redisClient;
            }
        } catch (error) {
            console.warn('Failed to connect to Redis, falling back to file storage:', error.message);
        }
    }
    
    /**
     * Spawn multiple instances in parallel
     */
    async spawnInstancesBatch(instanceConfigs) {
        console.log(`Spawning ${instanceConfigs.length} instances in parallel...`);
        
        // Prepare spawn functions
        const instances = instanceConfigs.map(config => ({
            ...config,
            spawnFn: () => super.spawnInstance(
                config.role,
                config.workDir,
                config.context,
                config.parentId,
                config.options
            )
        }));
        
        // Use optimizer for parallel spawning
        const results = await this.optimizer.spawnInstancesBatch(instances);
        
        console.log(`✓ Spawned ${results.length} instances`);
        return results;
    }
    
    /**
     * Override spawnInstance to add optimization
     */
    async spawnInstance(role, workDir, context, parentId = null, options = {}) {
        // Check if we should batch this spawn
        if (options.batch) {
            return this.queueBatchSpawn(role, workDir, context, parentId, options);
        }
        
        // Single spawn with optimization
        const config = { role, workDir, context, parentId, options };
        const [result] = await this.optimizer.spawnInstancesBatch([{
            ...config,
            spawnFn: () => super.spawnInstance(role, workDir, context, parentId, options)
        }]);
        
        return result;
    }
    
    /**
     * Queue instance for batch spawning
     */
    async queueBatchSpawn(role, workDir, context, parentId, options) {
        const batchId = options.batchId || 'default';
        
        if (!this.pendingSpawns.has(batchId)) {
            this.pendingSpawns.set(batchId, {
                configs: [],
                timer: null,
                promise: null,
                resolve: null
            });
        }
        
        const batch = this.pendingSpawns.get(batchId);
        
        // Add to batch
        const index = batch.configs.length;
        batch.configs.push({ role, workDir, context, parentId, options });
        
        // Create promise if needed
        if (!batch.promise) {
            batch.promise = new Promise(resolve => {
                batch.resolve = resolve;
            });
            
            // Set timer for batch execution
            batch.timer = setTimeout(() => {
                this.executeBatchSpawn(batchId);
            }, options.batchDelay || 100);
        }
        
        // Wait for batch to complete
        const results = await batch.promise;
        return results[index];
    }
    
    /**
     * Execute a batch spawn
     */
    async executeBatchSpawn(batchId) {
        const batch = this.pendingSpawns.get(batchId);
        if (!batch) return;
        
        this.pendingSpawns.delete(batchId);
        
        try {
            const results = await this.spawnInstancesBatch(batch.configs);
            batch.resolve(results);
        } catch (error) {
            batch.resolve(batch.configs.map(() => ({ error: error.message })));
        }
    }
    
    /**
     * Send message with batching
     */
    async sendMessage(instanceId, message, options = {}) {
        if (options.batch !== false) {
            // Queue for batching
            this.optimizer.queueMessage(instanceId, {
                content: message,
                deliverFn: (batchedMessage) => super.sendMessage(instanceId, batchedMessage)
            });
            return { status: 'queued' };
        }
        
        // Send immediately
        return super.sendMessage(instanceId, message);
    }
    
    /**
     * Optimized git operation
     */
    async gitOperation(operation, cacheKey = null) {
        return this.optimizer.gitOperation(operation, cacheKey);
    }
    
    /**
     * Pre-warm instance pool
     */
    async prewarmInstances(count = 5) {
        await this.optimizer.prewarmInstancePool(
            () => super.spawnInstance('specialist', '/tmp', 'pooled', null, { pooled: true }),
            count
        );
    }
    
    /**
     * Initialize worktree pool for git operations
     */
    async initializeWorktreePool() {
        if (this.gitBranchManager) {
            await this.optimizer.initializeWorktreePool(
                this.stateDir,
                this.gitBranchManager
            );
        }
    }
    
    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return {
            optimizer: this.optimizer.getMetrics(),
            instances: {
                total: Object.keys(this.instances).length,
                byRole: this.getInstanceCountByRole(),
                active: this.getActiveInstanceCount()
            },
            redis: {
                connected: this.redisReady,
                operations: this.redisClient?.commandsExecuted || 0
            }
        };
    }
    
    /**
     * Get instance count by role
     */
    getInstanceCountByRole() {
        const counts = { executive: 0, manager: 0, specialist: 0 };
        
        for (const instance of Object.values(this.instances)) {
            if (counts[instance.role] !== undefined) {
                counts[instance.role]++;
            }
        }
        
        return counts;
    }
    
    /**
     * Get active instance count
     */
    getActiveInstanceCount() {
        return Object.values(this.instances).filter(i => i.status === 'active').length;
    }
    
    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        // Monitor spawn batches
        this.optimizer.on('batch-spawn-complete', (event) => {
            console.log(`Batch spawn: ${event.count} instances in ${event.duration}ms`);
            this.perfEvents.emit('spawn-batch', event);
        });
        
        // Monitor message batches
        this.optimizer.on('message-batch-delivery', (event) => {
            console.log(`Message batch: ${event.count} messages to ${event.instanceId}`);
            this.perfEvents.emit('message-batch', event);
        });
        
        // Periodic metrics logging (disabled in test mode)
        if (process.env.NODE_ENV !== 'test') {
            this.metricsInterval = setInterval(() => {
                const metrics = this.getPerformanceMetrics();
                console.log('Performance metrics:', JSON.stringify(metrics, null, 2));
            }, 60000); // Every minute
        }
    }
    
    /**
     * Clean up resources
     */
    async cleanup() {
        // Stop metrics interval
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }
        
        // Clean up optimizer
        await this.optimizer.cleanup();
        
        // Close Redis
        if (this.redisClient) {
            try {
                await this.redisClient.quit();
            } catch (error) {
                // Ignore errors during cleanup, especially in test mode
                if (process.env.NODE_ENV !== 'test') {
                    console.warn('Error closing Redis connection:', error.message);
                }
            }
        }
        
        // Parent cleanup
        await super.cleanup();
    }
}

// Export singleton instance (only create in production mode)
export const optimizedInstanceManager = process.env.NODE_ENV === 'test' 
    ? null 
    : new OptimizedInstanceManager();