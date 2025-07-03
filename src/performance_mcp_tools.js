/**
 * Performance-Optimized MCP Tools
 * 
 * MCP tool implementations that leverage performance optimizations:
 * - spawn_batch: Spawn multiple instances in parallel
 * - send_batch: Send messages to multiple instances
 * - git_batch: Execute multiple git operations
 * - get_performance: Get performance metrics
 * - optimize_settings: Adjust performance settings
 */

import { OptimizedInstanceManager } from './optimized_instance_manager.js';
import { createPerformanceMonitor } from './performance_monitor.js';

// Initialize optimized manager and monitor
const instanceManager = new OptimizedInstanceManager();
const performanceMonitor = createPerformanceMonitor(instanceManager);

// Start monitoring
performanceMonitor.start();

export const performanceMCPTools = {
    /**
     * Spawn multiple instances in parallel
     */
    spawn_batch: {
        description: 'Spawn multiple Claude instances in parallel for better performance',
        parameters: {
            instances: {
                type: 'array',
                description: 'Array of instance configurations',
                items: {
                    type: 'object',
                    properties: {
                        role: { type: 'string', enum: ['executive', 'manager', 'specialist'] },
                        workDir: { type: 'string' },
                        context: { type: 'string' },
                        parentId: { type: 'string', optional: true },
                        workspaceMode: { type: 'string', enum: ['isolated', 'shared'], optional: true }
                    }
                }
            }
        },
        handler: async ({ instances }) => {
            try {
                console.log(`\n🚀 Spawning ${instances.length} instances in parallel...`);
                
                const startTime = Date.now();
                const results = await instanceManager.spawnInstancesBatch(instances);
                const duration = Date.now() - startTime;
                
                // Get performance metrics
                const metrics = instanceManager.getPerformanceMetrics();
                
                return {
                    success: true,
                    instances: results.map(r => ({
                        instanceId: r.instanceId,
                        sessionName: r.sessionName,
                        role: r.role,
                        workspaceMode: r.workspaceMode,
                        workingDirectory: r.workingDirectory
                    })),
                    performance: {
                        duration,
                        avgTimePerInstance: Math.round(duration / instances.length),
                        concurrentSpawns: metrics.optimizer.spawns.concurrent,
                        fromPool: results.filter(r => r.reused).length
                    }
                };
            } catch (error) {
                console.error('Batch spawn error:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    },
    
    /**
     * Send messages to multiple instances with batching
     */
    send_batch: {
        description: 'Send messages to multiple instances with automatic batching',
        parameters: {
            messages: {
                type: 'array',
                description: 'Array of messages to send',
                items: {
                    type: 'object',
                    properties: {
                        instanceId: { type: 'string' },
                        message: { type: 'string' },
                        immediate: { type: 'boolean', optional: true }
                    }
                }
            }
        },
        handler: async ({ messages }) => {
            try {
                console.log(`\n📨 Sending ${messages.length} messages with batching...`);
                
                const results = await Promise.all(
                    messages.map(async ({ instanceId, message, immediate }) => {
                        try {
                            const result = await instanceManager.sendMessage(
                                instanceId, 
                                message, 
                                { batch: !immediate }
                            );
                            return { instanceId, success: true, ...result };
                        } catch (error) {
                            return { instanceId, success: false, error: error.message };
                        }
                    })
                );
                
                // Get batching metrics
                const metrics = instanceManager.getPerformanceMetrics();
                
                return {
                    success: true,
                    results,
                    performance: {
                        totalMessages: messages.length,
                        queued: results.filter(r => r.status === 'queued').length,
                        immediate: results.filter(r => r.status !== 'queued').length,
                        avgBatchSize: metrics.optimizer.messages.avgBatchSize
                    }
                };
            } catch (error) {
                console.error('Batch send error:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    },
    
    /**
     * Execute git operations in batch
     */
    git_batch: {
        description: 'Execute multiple git operations with queuing and caching',
        parameters: {
            operations: {
                type: 'array',
                description: 'Array of git operations',
                items: {
                    type: 'object',
                    properties: {
                        type: { type: 'string', enum: ['status', 'branch', 'merge', 'commit'] },
                        workspaceDir: { type: 'string' },
                        params: { type: 'object', optional: true },
                        cacheKey: { type: 'string', optional: true }
                    }
                }
            }
        },
        handler: async ({ operations }) => {
            try {
                console.log(`\n🔄 Executing ${operations.length} git operations...`);
                
                const results = await Promise.all(
                    operations.map(async ({ type, workspaceDir, params, cacheKey }) => {
                        try {
                            let result;
                            
                            // Map operation type to actual git command
                            switch (type) {
                                case 'status':
                                    result = await instanceManager.gitOperation(
                                        async () => {
                                            const gitManager = instanceManager.gitBranchManager || 
                                                instanceManager.sharedWorkspaceGitManager;
                                            return gitManager.getStatus(workspaceDir);
                                        },
                                        cacheKey
                                    );
                                    break;
                                    
                                case 'branch':
                                    result = await instanceManager.gitOperation(
                                        async () => {
                                            const gitManager = instanceManager.gitBranchManager || 
                                                instanceManager.sharedWorkspaceGitManager;
                                            return gitManager.createBranch(
                                                workspaceDir, 
                                                params.branchName
                                            );
                                        }
                                    );
                                    break;
                                    
                                case 'merge':
                                    result = await instanceManager.gitOperation(
                                        async () => {
                                            const gitManager = instanceManager.sharedWorkspaceGitManager;
                                            return gitManager.mergeSpecialistWork(
                                                workspaceDir,
                                                params.sourceBranch,
                                                params.commitMessage
                                            );
                                        }
                                    );
                                    break;
                                    
                                case 'commit':
                                    result = await instanceManager.gitOperation(
                                        async () => {
                                            const gitManager = instanceManager.gitBranchManager || 
                                                instanceManager.sharedWorkspaceGitManager;
                                            return gitManager.commit(
                                                workspaceDir,
                                                params.message
                                            );
                                        }
                                    );
                                    break;
                                    
                                default:
                                    throw new Error(`Unknown git operation: ${type}`);
                            }
                            
                            return {
                                type,
                                workspaceDir,
                                success: true,
                                result,
                                cached: cacheKey ? true : false
                            };
                        } catch (error) {
                            return {
                                type,
                                workspaceDir,
                                success: false,
                                error: error.message
                            };
                        }
                    })
                );
                
                // Get git metrics
                const metrics = instanceManager.getPerformanceMetrics();
                
                return {
                    success: true,
                    results,
                    performance: {
                        totalOperations: operations.length,
                        cacheHits: metrics.optimizer.cacheHits,
                        avgGitOpTime: metrics.optimizer.gitOps.avgTime,
                        queueSize: metrics.optimizer.queues.git.size
                    }
                };
            } catch (error) {
                console.error('Git batch error:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    },
    
    /**
     * Get performance metrics and recommendations
     */
    get_performance: {
        description: 'Get current performance metrics and optimization recommendations',
        parameters: {},
        handler: async () => {
            try {
                const metrics = instanceManager.getPerformanceMetrics();
                const report = performanceMonitor.getReport();
                const recommendations = performanceMonitor.getRecommendations();
                
                return {
                    success: true,
                    metrics: {
                        instances: metrics.instances,
                        spawns: {
                            total: metrics.optimizer.spawns.total,
                            avgTime: Math.round(metrics.optimizer.spawns.avgTime),
                            concurrent: metrics.optimizer.spawns.concurrent
                        },
                        messages: {
                            total: metrics.optimizer.messages.total,
                            batches: metrics.optimizer.messages.batches,
                            avgBatchSize: Math.round(metrics.optimizer.messages.avgBatchSize * 10) / 10
                        },
                        git: {
                            total: metrics.optimizer.gitOps.total,
                            avgTime: Math.round(metrics.optimizer.gitOps.avgTime),
                            concurrent: metrics.optimizer.gitOps.concurrent
                        },
                        cache: {
                            hitRate: Math.round(metrics.optimizer.cache.hitRate * 100) + '%',
                            size: metrics.optimizer.cache.size
                        },
                        queues: metrics.optimizer.queues,
                        pools: metrics.optimizer.pools
                    },
                    performance: {
                        score: report.performance,
                        last5Minutes: {
                            spawns: report.spawns,
                            messages: report.messages
                        },
                        alerts: report.alerts
                    },
                    recommendations
                };
            } catch (error) {
                console.error('Get performance error:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    },
    
    /**
     * Optimize performance settings
     */
    optimize_settings: {
        description: 'Adjust performance optimization settings',
        parameters: {
            settings: {
                type: 'object',
                description: 'Performance settings to adjust',
                properties: {
                    maxConcurrentSpawns: { type: 'number', optional: true },
                    maxConcurrentGitOps: { type: 'number', optional: true },
                    messageBatchSize: { type: 'number', optional: true },
                    messageBatchDelay: { type: 'number', optional: true },
                    worktreePoolSize: { type: 'number', optional: true },
                    prewarmInstances: { type: 'number', optional: true }
                }
            }
        },
        handler: async ({ settings }) => {
            try {
                console.log('\n⚙️ Adjusting performance settings...');
                
                const optimizer = instanceManager.optimizer;
                const oldSettings = { ...optimizer.config };
                
                // Update settings
                if (settings.maxConcurrentSpawns !== undefined) {
                    optimizer.config.maxConcurrentSpawns = settings.maxConcurrentSpawns;
                    optimizer.spawnQueue.concurrency = settings.maxConcurrentSpawns;
                }
                
                if (settings.maxConcurrentGitOps !== undefined) {
                    optimizer.config.maxConcurrentGitOps = settings.maxConcurrentGitOps;
                    optimizer.gitQueue.concurrency = settings.maxConcurrentGitOps;
                }
                
                if (settings.messageBatchSize !== undefined) {
                    optimizer.config.messageBatchSize = settings.messageBatchSize;
                }
                
                if (settings.messageBatchDelay !== undefined) {
                    optimizer.config.messageBatchDelay = settings.messageBatchDelay;
                }
                
                if (settings.worktreePoolSize !== undefined) {
                    optimizer.config.worktreePoolSize = settings.worktreePoolSize;
                }
                
                // Pre-warm instances if requested
                if (settings.prewarmInstances > 0) {
                    await instanceManager.prewarmInstances(settings.prewarmInstances);
                }
                
                return {
                    success: true,
                    oldSettings: {
                        maxConcurrentSpawns: oldSettings.maxConcurrentSpawns,
                        maxConcurrentGitOps: oldSettings.maxConcurrentGitOps,
                        messageBatchSize: oldSettings.messageBatchSize,
                        messageBatchDelay: oldSettings.messageBatchDelay,
                        worktreePoolSize: oldSettings.worktreePoolSize
                    },
                    newSettings: {
                        maxConcurrentSpawns: optimizer.config.maxConcurrentSpawns,
                        maxConcurrentGitOps: optimizer.config.maxConcurrentGitOps,
                        messageBatchSize: optimizer.config.messageBatchSize,
                        messageBatchDelay: optimizer.config.messageBatchDelay,
                        worktreePoolSize: optimizer.config.worktreePoolSize
                    }
                };
            } catch (error) {
                console.error('Optimize settings error:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    },
    
    /**
     * Pre-warm resources for better performance
     */
    prewarm_resources: {
        description: 'Pre-warm instances and worktrees for instant allocation',
        parameters: {
            instances: { type: 'number', description: 'Number of instances to pre-warm' },
            worktrees: { type: 'boolean', description: 'Whether to initialize worktree pool' }
        },
        handler: async ({ instances, worktrees }) => {
            try {
                console.log('\n🔥 Pre-warming resources...');
                
                const tasks = [];
                
                // Pre-warm instances
                if (instances > 0) {
                    tasks.push(instanceManager.prewarmInstances(instances));
                }
                
                // Initialize worktree pool
                if (worktrees) {
                    tasks.push(instanceManager.initializeWorktreePool());
                }
                
                await Promise.all(tasks);
                
                const metrics = instanceManager.getPerformanceMetrics();
                
                return {
                    success: true,
                    warmed: {
                        instances: instances || 0,
                        worktrees: worktrees ? metrics.optimizer.pools.worktree : 0
                    },
                    pools: metrics.optimizer.pools
                };
            } catch (error) {
                console.error('Prewarm error:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    }
};

// Export for use in MCP server
export function getPerformanceMCPTools() {
    return performanceMCPTools;
}

// Cleanup on exit
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down performance monitoring...');
    performanceMonitor.stop();
    await instanceManager.cleanup();
    process.exit(0);
});