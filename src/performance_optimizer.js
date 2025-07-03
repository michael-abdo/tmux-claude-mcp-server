/**
 * Performance Optimizer for Large Teams
 * 
 * Provides optimizations for handling large numbers of concurrent instances:
 * - Parallel instance spawning with batching
 * - Message queue with rate limiting
 * - Connection pooling for tmux and git
 * - Caching layer for frequent operations
 * - Performance metrics collection
 */

import { EventEmitter } from 'events';
import PQueue from 'p-queue';
import { LRUCache } from 'lru-cache';

export class PerformanceOptimizer extends EventEmitter {
    constructor(options = {}) {
        super();
        
        // Configuration
        this.config = {
            maxConcurrentSpawns: options.maxConcurrentSpawns || 5,
            maxConcurrentGitOps: options.maxConcurrentGitOps || 3,
            messageBatchSize: options.messageBatchSize || 10,
            messageBatchDelay: options.messageBatchDelay || 100, // ms
            cacheSize: options.cacheSize || 1000,
            cacheTTL: options.cacheTTL || 60000, // 1 minute
            worktreePoolSize: options.worktreePoolSize || 10,
            ...options
        };
        
        // Concurrent operation queues
        this.spawnQueue = new PQueue({ concurrency: this.config.maxConcurrentSpawns });
        this.gitQueue = new PQueue({ concurrency: this.config.maxConcurrentGitOps });
        
        // Message batching
        this.messageQueue = new Map(); // instanceId -> messages[]
        this.messageBatchTimers = new Map(); // instanceId -> timer
        
        // Caching
        this.cache = new LRUCache({
            max: this.config.cacheSize,
            ttl: this.config.cacheTTL
        });
        
        // Performance metrics
        this.metrics = {
            spawns: { total: 0, concurrent: 0, avgTime: 0 },
            messages: { total: 0, batches: 0, avgBatchSize: 0 },
            gitOps: { total: 0, concurrent: 0, avgTime: 0 },
            cacheHits: 0,
            cacheMisses: 0
        };
        
        // Instance pool for pre-warming
        this.instancePool = [];
        this.poolRefillTimer = null;
        
        // Worktree pool
        this.worktreePool = [];
        this.worktreeInitialized = false;
    }
    
    /**
     * Spawn multiple instances in parallel with batching
     */
    async spawnInstancesBatch(instances) {
        const startTime = Date.now();
        this.metrics.spawns.total += instances.length;
        
        // Group by workspace mode for efficient shared workspace creation
        const grouped = instances.reduce((acc, inst) => {
            const mode = inst.workspaceMode || 'isolated';
            if (!acc[mode]) acc[mode] = [];
            acc[mode].push(inst);
            return acc;
        }, {});
        
        // Spawn in parallel with concurrency limit
        const results = await Promise.all(
            Object.entries(grouped).map(([mode, group]) =>
                this.spawnGroupWithMode(group, mode)
            )
        );
        
        // Update metrics
        const duration = Date.now() - startTime;
        this.metrics.spawns.avgTime = 
            (this.metrics.spawns.avgTime * (this.metrics.spawns.total - instances.length) + duration) / 
            this.metrics.spawns.total;
        
        this.emit('batch-spawn-complete', {
            count: instances.length,
            duration,
            results: results.flat()
        });
        
        return results.flat();
    }
    
    /**
     * Spawn a group of instances with the same workspace mode
     */
    async spawnGroupWithMode(instances, mode) {
        return Promise.all(
            instances.map(inst => 
                this.spawnQueue.add(async () => {
                    this.metrics.spawns.concurrent++;
                    try {
                        // Check instance pool first
                        if (this.instancePool.length > 0 && inst.usePool !== false) {
                            const pooled = this.instancePool.pop();
                            this.schedulePoolRefill();
                            return this.reusePooledInstance(pooled, inst);
                        }
                        
                        // Otherwise spawn new instance
                        return await inst.spawnFn();
                    } finally {
                        this.metrics.spawns.concurrent--;
                    }
                })
            )
        );
    }
    
    /**
     * Queue messages for batch delivery
     */
    queueMessage(instanceId, message) {
        this.metrics.messages.total++;
        
        // Initialize queue for instance
        if (!this.messageQueue.has(instanceId)) {
            this.messageQueue.set(instanceId, []);
        }
        
        const queue = this.messageQueue.get(instanceId);
        queue.push(message);
        
        // Cancel existing timer
        if (this.messageBatchTimers.has(instanceId)) {
            clearTimeout(this.messageBatchTimers.get(instanceId));
        }
        
        // Schedule batch delivery
        const timer = setTimeout(() => {
            this.deliverMessageBatch(instanceId);
        }, this.config.messageBatchDelay);
        
        this.messageBatchTimers.set(instanceId, timer);
        
        // Force delivery if batch is full
        if (queue.length >= this.config.messageBatchSize) {
            clearTimeout(timer);
            this.messageBatchTimers.delete(instanceId);
            this.deliverMessageBatch(instanceId);
        }
    }
    
    /**
     * Deliver a batch of messages
     */
    async deliverMessageBatch(instanceId) {
        const messages = this.messageQueue.get(instanceId);
        if (!messages || messages.length === 0) return;
        
        // Clear queue
        this.messageQueue.delete(instanceId);
        this.messageBatchTimers.delete(instanceId);
        
        // Update metrics
        this.metrics.messages.batches++;
        this.metrics.messages.avgBatchSize = 
            (this.metrics.messages.avgBatchSize * (this.metrics.messages.batches - 1) + messages.length) / 
            this.metrics.messages.batches;
        
        // Combine messages efficiently
        const batchedMessage = messages.map(m => m.content).join('\n\n');
        
        this.emit('message-batch-delivery', {
            instanceId,
            count: messages.length,
            size: batchedMessage.length
        });
        
        // Deliver via callback
        if (messages[0].deliverFn) {
            return messages[0].deliverFn(batchedMessage);
        }
    }
    
    /**
     * Execute git operation with queuing and caching
     */
    async gitOperation(operation, cacheKey = null) {
        // Check cache first
        if (cacheKey) {
            const cached = this.cache.get(cacheKey);
            if (cached) {
                this.metrics.cacheHits++;
                return cached;
            }
            this.metrics.cacheMisses++;
        }
        
        // Queue operation
        const result = await this.gitQueue.add(async () => {
            this.metrics.gitOps.concurrent++;
            this.metrics.gitOps.total++;
            const startTime = Date.now();
            
            try {
                const result = await operation();
                
                // Cache result
                if (cacheKey && result) {
                    this.cache.set(cacheKey, result);
                }
                
                // Update metrics
                const duration = Date.now() - startTime;
                this.metrics.gitOps.avgTime = 
                    (this.metrics.gitOps.avgTime * (this.metrics.gitOps.total - 1) + duration) / 
                    this.metrics.gitOps.total;
                
                return result;
            } finally {
                this.metrics.gitOps.concurrent--;
            }
        });
        
        return result;
    }
    
    /**
     * Initialize worktree pool for fast branch operations
     */
    async initializeWorktreePool(baseDir, gitManager) {
        if (this.worktreeInitialized) return;
        
        console.log(`Initializing worktree pool with ${this.config.worktreePoolSize} entries...`);
        
        const promises = [];
        for (let i = 0; i < this.config.worktreePoolSize; i++) {
            promises.push(
                this.gitQueue.add(async () => {
                    const worktreePath = path.join(baseDir, '.worktree-pool', `pool-${i}`);
                    await gitManager.createWorktree(worktreePath, `pool-branch-${i}`);
                    return {
                        path: worktreePath,
                        branch: `pool-branch-${i}`,
                        inUse: false
                    };
                })
            );
        }
        
        this.worktreePool = await Promise.all(promises);
        this.worktreeInitialized = true;
        
        console.log('✓ Worktree pool initialized');
    }
    
    /**
     * Get a worktree from the pool
     */
    async getPooledWorktree() {
        const available = this.worktreePool.find(w => !w.inUse);
        if (available) {
            available.inUse = true;
            return available;
        }
        return null;
    }
    
    /**
     * Return a worktree to the pool
     */
    releasePooledWorktree(worktree) {
        const pooled = this.worktreePool.find(w => w.path === worktree.path);
        if (pooled) {
            pooled.inUse = false;
        }
    }
    
    /**
     * Pre-warm instance pool
     */
    async prewarmInstancePool(instanceCreator, count = 5) {
        console.log(`Pre-warming ${count} instances...`);
        
        const promises = [];
        for (let i = 0; i < count; i++) {
            promises.push(
                this.spawnQueue.add(async () => {
                    const instance = await instanceCreator();
                    instance.pooled = true;
                    instance.created = Date.now();
                    return instance;
                })
            );
        }
        
        const instances = await Promise.all(promises);
        this.instancePool.push(...instances);
        
        console.log(`✓ Instance pool warmed with ${instances.length} instances`);
    }
    
    /**
     * Reuse a pooled instance
     */
    async reusePooledInstance(pooled, config) {
        // Reset instance state
        pooled.role = config.role;
        pooled.workDir = config.workDir;
        pooled.context = config.context;
        pooled.parentId = config.parentId;
        pooled.reused = true;
        pooled.reusedAt = Date.now();
        
        // Clear any existing content
        if (pooled.clearFn) {
            await pooled.clearFn();
        }
        
        return pooled;
    }
    
    /**
     * Schedule pool refill
     */
    schedulePoolRefill() {
        if (this.poolRefillTimer) return;
        
        this.poolRefillTimer = setTimeout(() => {
            this.poolRefillTimer = null;
            const needed = this.config.worktreePoolSize - this.instancePool.length;
            if (needed > 0 && this.instanceCreator) {
                this.prewarmInstancePool(this.instanceCreator, needed);
            }
        }, 5000); // Refill after 5 seconds
    }
    
    /**
     * Get performance metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            queues: {
                spawn: { size: this.spawnQueue.size, pending: this.spawnQueue.pending },
                git: { size: this.gitQueue.size, pending: this.gitQueue.pending }
            },
            pools: {
                instance: this.instancePool.length,
                worktree: this.worktreePool.filter(w => !w.inUse).length
            },
            cache: {
                size: this.cache.size,
                hitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0
            }
        };
    }
    
    /**
     * Clean up resources
     */
    async cleanup() {
        // Clear timers
        for (const timer of this.messageBatchTimers.values()) {
            clearTimeout(timer);
        }
        if (this.poolRefillTimer) {
            clearTimeout(this.poolRefillTimer);
        }
        
        // Clear queues
        this.spawnQueue.clear();
        this.gitQueue.clear();
        
        // Clear pools
        this.instancePool = [];
        this.worktreePool = [];
        
        // Clear cache
        this.cache.clear();
    }
}

// Singleton instance
export const performanceOptimizer = new PerformanceOptimizer();