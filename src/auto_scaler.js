/**
 * Auto-scaler for Manager instances
 * 
 * Monitors system load and automatically scales Manager instances
 * up or down based on workload and performance metrics
 */

import { InstanceManager } from './instance_manager.js';
import { JobQueue } from './job_queue.js';
import { RedisStateStore } from './redis_state_store.js';

export class AutoScaler {
    constructor(instanceManager, options = {}) {
        this.instanceManager = instanceManager;
        this.options = {
            minManagers: options.minManagers || 1,
            maxManagers: options.maxManagers || 10,
            scaleUpThreshold: options.scaleUpThreshold || 0.8, // 80% utilization
            scaleDownThreshold: options.scaleDownThreshold || 0.2, // 20% utilization
            cooldownPeriod: options.cooldownPeriod || 60000, // 1 minute
            checkInterval: options.checkInterval || 10000, // 10 seconds
            specialistsPerManager: options.specialistsPerManager || 4
        };
        
        this.stateStore = null;
        this.jobQueue = new JobQueue();
        this.isMonitoring = false;
        this.monitoringTimer = null;
        this.lastScaleAction = null;
        this.metrics = {
            scaleUpCount: 0,
            scaleDownCount: 0,
            currentManagers: 0
        };
    }

    async initialize() {
        if (process.env.PHASE === '3') {
            this.stateStore = new RedisStateStore();
            await this.stateStore.initialize();
        }
        console.log('AutoScaler initialized with config:', this.options);
    }

    /**
     * Start auto-scaling monitoring
     */
    async startMonitoring() {
        if (this.isMonitoring) {
            console.log('AutoScaler already monitoring');
            return;
        }

        this.isMonitoring = true;
        console.log('AutoScaler monitoring started');
        
        // Initial check
        await this.checkAndScale();
        
        // Set up periodic checks
        this.monitoringTimer = setInterval(async () => {
            await this.checkAndScale();
        }, this.options.checkInterval);
    }

    /**
     * Stop auto-scaling monitoring
     */
    stopMonitoring() {
        if (!this.isMonitoring) return;
        
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
            this.monitoringTimer = null;
        }
        
        this.isMonitoring = false;
        console.log('AutoScaler monitoring stopped');
    }

    /**
     * Check system metrics and scale if needed
     */
    async checkAndScale() {
        try {
            const metrics = await this.collectMetrics();
            const decision = this.makeScalingDecision(metrics);
            
            if (decision.action !== 'none' && this.canScale()) {
                await this.executeScaling(decision);
            }
            
            // Record metrics
            if (this.stateStore) {
                await this.stateStore.recordMetric('autoscaler_check', {
                    ...metrics,
                    decision: decision.action,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error('AutoScaler check error:', error);
        }
    }

    /**
     * Collect current system metrics
     */
    async collectMetrics() {
        // Get all instances
        const instances = await this.instanceManager.listInstances();
        
        // Count by role
        const managers = instances.filter(i => i.role === 'manager' && i.status === 'active');
        const specialists = instances.filter(i => i.role === 'specialist' && i.status === 'active');
        const executive = instances.find(i => i.role === 'executive' && i.status === 'active');
        
        // Calculate utilization
        const pendingJobs = this.jobQueue.getPendingCount();
        const activeJobs = this.jobQueue.getActiveCount();
        const totalCapacity = specialists.length;
        const utilization = totalCapacity > 0 ? 
            (activeJobs + Math.min(pendingJobs, totalCapacity)) / totalCapacity : 1;
        
        // Get average response times from recent metrics
        let avgResponseTime = 0;
        if (this.stateStore) {
            const recentMetrics = await this.stateStore.getRecentMetrics(60); // Last minute
            const taskMetrics = recentMetrics.filter(m => m.type === 'task_execution');
            if (taskMetrics.length > 0) {
                const totalTime = taskMetrics.reduce((sum, m) => sum + (m.data.duration || 0), 0);
                avgResponseTime = totalTime / taskMetrics.length;
            }
        }
        
        // Check health of managers
        let healthyManagers = 0;
        for (const manager of managers) {
            if (await this.instanceManager.isInstanceActive(manager.instanceId)) {
                healthyManagers++;
            }
        }
        
        this.metrics.currentManagers = managers.length;
        
        return {
            executiveActive: !!executive,
            managerCount: managers.length,
            healthyManagers,
            specialistCount: specialists.length,
            pendingJobs,
            activeJobs,
            utilization,
            avgResponseTime,
            queueDepth: pendingJobs
        };
    }

    /**
     * Make scaling decision based on metrics
     */
    makeScalingDecision(metrics) {
        // No executive, no scaling
        if (!metrics.executiveActive) {
            return { action: 'none', reason: 'No active executive' };
        }
        
        // Scale up conditions
        if (metrics.utilization >= this.options.scaleUpThreshold) {
            if (metrics.managerCount < this.options.maxManagers) {
                return {
                    action: 'scale-up',
                    reason: `High utilization: ${(metrics.utilization * 100).toFixed(1)}%`,
                    targetManagers: Math.min(metrics.managerCount + 1, this.options.maxManagers)
                };
            }
        }
        
        // Scale up if queue is deep
        if (metrics.queueDepth > metrics.specialistCount * 2) {
            if (metrics.managerCount < this.options.maxManagers) {
                return {
                    action: 'scale-up',
                    reason: `Deep queue: ${metrics.queueDepth} pending jobs`,
                    targetManagers: Math.min(metrics.managerCount + 1, this.options.maxManagers)
                };
            }
        }
        
        // Scale up if response times are high
        if (metrics.avgResponseTime > 5000 && metrics.managerCount < this.options.maxManagers) {
            return {
                action: 'scale-up',
                reason: `High response time: ${(metrics.avgResponseTime / 1000).toFixed(1)}s`,
                targetManagers: Math.min(metrics.managerCount + 1, this.options.maxManagers)
            };
        }
        
        // Scale down conditions
        if (metrics.utilization <= this.options.scaleDownThreshold) {
            if (metrics.managerCount > this.options.minManagers) {
                return {
                    action: 'scale-down',
                    reason: `Low utilization: ${(metrics.utilization * 100).toFixed(1)}%`,
                    targetManagers: Math.max(metrics.managerCount - 1, this.options.minManagers)
                };
            }
        }
        
        return { action: 'none', reason: 'Metrics within normal range' };
    }

    /**
     * Check if we can scale (cooldown period)
     */
    canScale() {
        if (!this.lastScaleAction) return true;
        
        const timeSinceLastScale = Date.now() - this.lastScaleAction;
        return timeSinceLastScale >= this.options.cooldownPeriod;
    }

    /**
     * Execute scaling action
     */
    async executeScaling(decision) {
        console.log(`AutoScaler: ${decision.action} - ${decision.reason}`);
        
        try {
            if (decision.action === 'scale-up') {
                await this.scaleUp();
                this.metrics.scaleUpCount++;
            } else if (decision.action === 'scale-down') {
                await this.scaleDown();
                this.metrics.scaleDownCount++;
            }
            
            this.lastScaleAction = Date.now();
            
            // Record scaling action
            if (this.stateStore) {
                await this.stateStore.recordMetric('autoscaler_action', {
                    action: decision.action,
                    reason: decision.reason,
                    newManagerCount: this.metrics.currentManagers,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error(`Failed to execute ${decision.action}:`, error);
        }
    }

    /**
     * Scale up by adding a new Manager with Specialists
     */
    async scaleUp() {
        // Get executive instance
        const instances = await this.instanceManager.listInstances();
        const executive = instances.find(i => i.role === 'executive' && i.status === 'active');
        
        if (!executive) {
            throw new Error('No active executive to spawn Manager');
        }
        
        // Spawn new Manager
        const managerNumber = this.metrics.currentManagers + 1;
        const manager = await this.instanceManager.spawnInstance(
            'manager',
            executive.workDir,
            `You are Manager ${managerNumber} created by auto-scaling to handle increased load`,
            executive.instanceId
        );
        
        console.log(`Spawned new Manager: ${manager.instanceId}`);
        
        // Spawn Specialists for the new Manager
        const specialistPromises = [];
        for (let i = 1; i <= this.options.specialistsPerManager; i++) {
            const promise = this.instanceManager.spawnInstance(
                'specialist',
                executive.workDir,
                `You are Specialist ${i} under ${manager.instanceId} (auto-scaled)`,
                manager.instanceId
            );
            specialistPromises.push(promise);
        }
        
        const specialists = await Promise.all(specialistPromises);
        console.log(`Spawned ${specialists.length} Specialists for ${manager.instanceId}`);
        
        this.metrics.currentManagers++;
    }

    /**
     * Scale down by removing the least loaded Manager
     */
    async scaleDown() {
        // Get all managers
        const instances = await this.instanceManager.listInstances();
        const managers = instances.filter(i => i.role === 'manager' && i.status === 'active');
        
        if (managers.length <= this.options.minManagers) {
            console.log('Already at minimum managers, cannot scale down');
            return;
        }
        
        // Find least loaded manager (fewest active specialists)
        let leastLoadedManager = null;
        let minActiveSpecialists = Infinity;
        
        for (const manager of managers) {
            const specialists = instances.filter(
                i => i.role === 'specialist' && 
                i.parentId === manager.instanceId && 
                i.status === 'active'
            );
            
            if (specialists.length < minActiveSpecialists) {
                minActiveSpecialists = specialists.length;
                leastLoadedManager = manager;
            }
        }
        
        if (!leastLoadedManager) {
            console.log('Could not determine least loaded manager');
            return;
        }
        
        console.log(`Scaling down by removing ${leastLoadedManager.instanceId}`);
        
        // Gracefully terminate the manager and its specialists
        await this.instanceManager.terminateInstance(leastLoadedManager.instanceId, true);
        
        this.metrics.currentManagers--;
    }

    /**
     * Get current auto-scaler status
     */
    getStatus() {
        return {
            isMonitoring: this.isMonitoring,
            metrics: this.metrics,
            config: this.options,
            lastScaleAction: this.lastScaleAction,
            timeSinceLastScale: this.lastScaleAction ? 
                Date.now() - this.lastScaleAction : null
        };
    }
}