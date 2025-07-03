/**
 * Performance Monitor for Large Teams
 * 
 * Real-time monitoring of:
 * - Instance spawn rates and times
 * - Message throughput and batching efficiency
 * - Git operation performance
 * - Resource utilization
 * - Bottleneck detection
 */

import { EventEmitter } from 'events';
import { performanceOptimizer } from './performance_optimizer.js';

export class PerformanceMonitor extends EventEmitter {
    constructor(instanceManager) {
        super();
        
        this.instanceManager = instanceManager;
        this.optimizer = performanceOptimizer;
        
        // Performance data
        this.data = {
            spawns: [],
            messages: [],
            gitOps: [],
            snapshots: [],
            alerts: []
        };
        
        // Thresholds for alerts
        this.thresholds = {
            spawnTime: 10000, // 10 seconds
            messageBacklog: 100,
            gitQueueSize: 20,
            cacheHitRate: 0.5,
            instanceCount: 100
        };
        
        // Monitoring state
        this.monitoring = false;
        this.intervals = {};
        
        // Setup monitoring
        this.setupMonitoring();
    }
    
    /**
     * Setup performance monitoring
     */
    setupMonitoring() {
        // Monitor optimizer events
        this.optimizer.on('batch-spawn-complete', (event) => {
            this.recordSpawn(event);
            this.checkSpawnPerformance(event);
        });
        
        this.optimizer.on('message-batch-delivery', (event) => {
            this.recordMessage(event);
            this.checkMessagePerformance(event);
        });
        
        // Monitor instance manager events
        if (this.instanceManager.perfEvents) {
            this.instanceManager.perfEvents.on('spawn-batch', (event) => {
                this.emit('spawn-batch', event);
            });
            
            this.instanceManager.perfEvents.on('message-batch', (event) => {
                this.emit('message-batch', event);
            });
        }
    }
    
    /**
     * Start continuous monitoring
     */
    start() {
        if (this.monitoring) return;
        
        this.monitoring = true;
        console.log('🔍 Performance monitoring started');
        
        // Take snapshots every 5 seconds
        this.intervals.snapshot = setInterval(() => {
            this.takeSnapshot();
        }, 5000);
        
        // Check for issues every 10 seconds
        this.intervals.health = setInterval(() => {
            this.performHealthCheck();
        }, 10000);
        
        // Clean old data every minute
        this.intervals.cleanup = setInterval(() => {
            this.cleanupOldData();
        }, 60000);
    }
    
    /**
     * Stop monitoring
     */
    stop() {
        this.monitoring = false;
        
        // Clear intervals
        Object.values(this.intervals).forEach(interval => {
            clearInterval(interval);
        });
        
        console.log('🔍 Performance monitoring stopped');
    }
    
    /**
     * Record spawn event
     */
    recordSpawn(event) {
        this.data.spawns.push({
            timestamp: Date.now(),
            count: event.count,
            duration: event.duration,
            avgTime: event.duration / event.count
        });
        
        // Keep last 1000 events
        if (this.data.spawns.length > 1000) {
            this.data.spawns.shift();
        }
    }
    
    /**
     * Record message event
     */
    recordMessage(event) {
        this.data.messages.push({
            timestamp: Date.now(),
            instanceId: event.instanceId,
            count: event.count,
            size: event.size
        });
        
        // Keep last 1000 events
        if (this.data.messages.length > 1000) {
            this.data.messages.shift();
        }
    }
    
    /**
     * Take performance snapshot
     */
    takeSnapshot() {
        const metrics = this.instanceManager.getPerformanceMetrics();
        
        const snapshot = {
            timestamp: Date.now(),
            instances: metrics.instances,
            optimizer: metrics.optimizer,
            redis: metrics.redis,
            memory: process.memoryUsage(),
            cpu: process.cpuUsage()
        };
        
        this.data.snapshots.push(snapshot);
        
        // Keep last 100 snapshots (~ 8 minutes of data)
        if (this.data.snapshots.length > 100) {
            this.data.snapshots.shift();
        }
        
        this.emit('snapshot', snapshot);
    }
    
    /**
     * Perform health check
     */
    performHealthCheck() {
        const metrics = this.instanceManager.getPerformanceMetrics();
        const issues = [];
        
        // Check spawn queue
        if (metrics.optimizer.queues.spawn.pending > 10) {
            issues.push({
                type: 'spawn_queue_backlog',
                severity: 'warning',
                message: `Spawn queue has ${metrics.optimizer.queues.spawn.pending} pending operations`,
                value: metrics.optimizer.queues.spawn.pending
            });
        }
        
        // Check git queue
        if (metrics.optimizer.queues.git.pending > this.thresholds.gitQueueSize) {
            issues.push({
                type: 'git_queue_backlog',
                severity: 'warning',
                message: `Git queue has ${metrics.optimizer.queues.git.pending} pending operations`,
                value: metrics.optimizer.queues.git.pending
            });
        }
        
        // Check cache hit rate
        if (metrics.optimizer.cache.hitRate < this.thresholds.cacheHitRate) {
            issues.push({
                type: 'low_cache_hit_rate',
                severity: 'info',
                message: `Cache hit rate is ${(metrics.optimizer.cache.hitRate * 100).toFixed(1)}%`,
                value: metrics.optimizer.cache.hitRate
            });
        }
        
        // Check instance count
        if (metrics.instances.total > this.thresholds.instanceCount) {
            issues.push({
                type: 'high_instance_count',
                severity: 'warning',
                message: `Instance count (${metrics.instances.total}) exceeds threshold`,
                value: metrics.instances.total
            });
        }
        
        // Check Redis connection
        if (!metrics.redis.connected) {
            issues.push({
                type: 'redis_disconnected',
                severity: 'error',
                message: 'Redis is not connected',
                value: false
            });
        }
        
        // Record issues
        if (issues.length > 0) {
            const alert = {
                timestamp: Date.now(),
                issues
            };
            
            this.data.alerts.push(alert);
            this.emit('health-check', alert);
            
            // Log critical issues
            issues.filter(i => i.severity === 'error').forEach(issue => {
                console.error(`❌ ${issue.message}`);
            });
        }
    }
    
    /**
     * Check spawn performance
     */
    checkSpawnPerformance(event) {
        if (event.duration > this.thresholds.spawnTime) {
            this.emit('performance-alert', {
                type: 'slow_spawn',
                message: `Spawn took ${event.duration}ms for ${event.count} instances`,
                severity: 'warning',
                data: event
            });
        }
    }
    
    /**
     * Check message performance
     */
    checkMessagePerformance(event) {
        const backlog = this.optimizer.messageQueue.get(event.instanceId)?.length || 0;
        
        if (backlog > this.thresholds.messageBacklog) {
            this.emit('performance-alert', {
                type: 'message_backlog',
                message: `Instance ${event.instanceId} has ${backlog} messages in queue`,
                severity: 'warning',
                data: { instanceId: event.instanceId, backlog }
            });
        }
    }
    
    /**
     * Get performance report
     */
    getReport() {
        const now = Date.now();
        const fiveMinutesAgo = now - 300000;
        
        // Calculate spawn metrics
        const recentSpawns = this.data.spawns.filter(s => s.timestamp > fiveMinutesAgo);
        const spawnMetrics = {
            total: recentSpawns.reduce((sum, s) => sum + s.count, 0),
            avgTime: recentSpawns.length > 0
                ? recentSpawns.reduce((sum, s) => sum + s.avgTime, 0) / recentSpawns.length
                : 0,
            batches: recentSpawns.length
        };
        
        // Calculate message metrics
        const recentMessages = this.data.messages.filter(m => m.timestamp > fiveMinutesAgo);
        const messageMetrics = {
            total: recentMessages.reduce((sum, m) => sum + m.count, 0),
            batches: recentMessages.length,
            avgBatchSize: recentMessages.length > 0
                ? recentMessages.reduce((sum, m) => sum + m.count, 0) / recentMessages.length
                : 0
        };
        
        // Get latest snapshot
        const latestSnapshot = this.data.snapshots[this.data.snapshots.length - 1];
        
        // Get recent alerts
        const recentAlerts = this.data.alerts.filter(a => a.timestamp > fiveMinutesAgo);
        
        return {
            timestamp: now,
            period: '5 minutes',
            spawns: spawnMetrics,
            messages: messageMetrics,
            current: latestSnapshot,
            alerts: recentAlerts,
            performance: this.calculatePerformanceScore()
        };
    }
    
    /**
     * Calculate overall performance score
     */
    calculatePerformanceScore() {
        const metrics = this.instanceManager.getPerformanceMetrics();
        let score = 100;
        
        // Deduct for queue backlogs
        score -= Math.min(metrics.optimizer.queues.spawn.pending * 2, 20);
        score -= Math.min(metrics.optimizer.queues.git.pending, 10);
        
        // Deduct for low cache hit rate
        const cacheHitRate = metrics.optimizer.cache.hitRate;
        if (cacheHitRate < 0.8) {
            score -= (0.8 - cacheHitRate) * 20;
        }
        
        // Deduct for high instance count
        if (metrics.instances.total > 50) {
            score -= Math.min((metrics.instances.total - 50) * 0.5, 20);
        }
        
        // Deduct for Redis issues
        if (!metrics.redis.connected) {
            score -= 10;
        }
        
        return Math.max(0, Math.round(score));
    }
    
    /**
     * Clean up old data
     */
    cleanupOldData() {
        const oneHourAgo = Date.now() - 3600000;
        
        // Clean old spawns
        this.data.spawns = this.data.spawns.filter(s => s.timestamp > oneHourAgo);
        
        // Clean old messages
        this.data.messages = this.data.messages.filter(m => m.timestamp > oneHourAgo);
        
        // Clean old alerts
        this.data.alerts = this.data.alerts.filter(a => a.timestamp > oneHourAgo);
    }
    
    /**
     * Get optimization recommendations
     */
    getRecommendations() {
        const metrics = this.instanceManager.getPerformanceMetrics();
        const recommendations = [];
        
        // Check spawn performance
        if (metrics.optimizer.spawns.avgTime > 5000) {
            recommendations.push({
                category: 'spawning',
                priority: 'high',
                suggestion: 'Consider increasing maxConcurrentSpawns or pre-warming more instances',
                impact: 'Could reduce spawn time by up to 50%'
            });
        }
        
        // Check message batching
        if (metrics.optimizer.messages.avgBatchSize < 3) {
            recommendations.push({
                category: 'messaging',
                priority: 'medium',
                suggestion: 'Increase messageBatchDelay to improve batching efficiency',
                impact: 'Could reduce message overhead by 30%'
            });
        }
        
        // Check cache usage
        if (metrics.optimizer.cache.hitRate < 0.5) {
            recommendations.push({
                category: 'caching',
                priority: 'medium',
                suggestion: 'Review cache keys and increase cache TTL for frequently accessed data',
                impact: 'Could reduce git operations by 40%'
            });
        }
        
        // Check instance pooling
        if (metrics.optimizer.pools.instance === 0 && metrics.instances.total > 20) {
            recommendations.push({
                category: 'pooling',
                priority: 'high',
                suggestion: 'Enable instance pre-warming to reduce spawn latency',
                impact: 'Could make spawning nearly instant'
            });
        }
        
        return recommendations;
    }
}

// Export singleton
export function createPerformanceMonitor(instanceManager) {
    return new PerformanceMonitor(instanceManager);
}