/**
 * Health Monitor for Phase 3
 * 
 * Monitors the health of all Claude instances and provides
 * auto-recovery capabilities for failed instances.
 */

export class HealthMonitor {
    constructor(mcpTools, stateStore = null) {
        this.mcpTools = mcpTools;
        this.stateStore = stateStore;
        this.checkInterval = 10000; // 10 seconds
        this.unhealthyThreshold = 3; // 3 failed checks before marking unhealthy
        this.recoveryDelay = 5000; // 5 seconds before attempting recovery
        
        this.healthChecks = new Map(); // instanceId -> check results
        this.isMonitoring = false;
        this.monitoringTimer = null;
        
        console.log('=== Health Monitor initialized ===');
    }

    /**
     * Start monitoring all instances
     */
    async startMonitoring() {
        if (this.isMonitoring) {
            console.log('Health monitoring already active');
            return;
        }
        
        this.isMonitoring = true;
        console.log('Starting health monitoring...');
        
        // Initial check
        await this.performHealthCheck();
        
        // Schedule periodic checks
        this.monitoringTimer = setInterval(async () => {
            await this.performHealthCheck();
        }, this.checkInterval);
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
            this.monitoringTimer = null;
        }
        this.isMonitoring = false;
        console.log('Health monitoring stopped');
    }

    /**
     * Perform health check on all instances
     */
    async performHealthCheck() {
        try {
            const instances = await this.mcpTools.list({});
            const checkPromises = instances.map(instance => this.checkInstance(instance));
            const results = await Promise.allSettled(checkPromises);
            
            // Process results and trigger recovery if needed
            for (let i = 0; i < instances.length; i++) {
                const instance = instances[i];
                const result = results[i];
                
                if (result.status === 'fulfilled' && result.value) {
                    await this.processHealthResult(instance, result.value);
                }
            }
            
            // Record metrics
            if (this.stateStore) {
                const healthyCount = Array.from(this.healthChecks.values())
                    .filter(h => h.status === 'healthy').length;
                const unhealthyCount = Array.from(this.healthChecks.values())
                    .filter(h => h.status === 'unhealthy').length;
                
                await this.stateStore.recordMetric('health_check', {
                    healthy: healthyCount,
                    unhealthy: unhealthyCount,
                    total: instances.length,
                    timestamp: new Date().toISOString()
                });
            }
            
        } catch (error) {
            console.error('Health check error:', error);
        }
    }

    /**
     * Check health of a single instance
     */
    async checkInstance(instance) {
        const startTime = Date.now();
        
        try {
            // Basic liveliness check - can we read from the instance?
            const readResult = await Promise.race([
                this.mcpTools.read({ instanceId: instance.instanceId, lines: 10 }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Read timeout')), 5000)
                )
            ]);
            
            // Check if instance is responsive
            const isResponsive = readResult && readResult.output !== undefined;
            
            // Check for stuck patterns
            const isStuck = this.detectStuckPatterns(readResult.output);
            
            // Check for error patterns
            const hasErrors = this.detectErrorPatterns(readResult.output);
            
            // Calculate health score
            const healthScore = this.calculateHealthScore({
                responsive: isResponsive,
                stuck: isStuck,
                errors: hasErrors,
                responseTime: Date.now() - startTime
            });
            
            return {
                instanceId: instance.instanceId,
                status: healthScore >= 70 ? 'healthy' : 'unhealthy',
                score: healthScore,
                responsive: isResponsive,
                stuck: isStuck,
                errors: hasErrors,
                responseTime: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                instanceId: instance.instanceId,
                status: 'unhealthy',
                score: 0,
                responsive: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Process health check result and trigger recovery if needed
     */
    async processHealthResult(instance, healthResult) {
        // Get previous health checks
        if (!this.healthChecks.has(instance.instanceId)) {
            this.healthChecks.set(instance.instanceId, {
                history: [],
                failureCount: 0,
                status: 'healthy'
            });
        }
        
        const healthData = this.healthChecks.get(instance.instanceId);
        healthData.history.push(healthResult);
        
        // Keep only recent history (last 10 checks)
        if (healthData.history.length > 10) {
            healthData.history.shift();
        }
        
        // Update failure count
        if (healthResult.status === 'unhealthy') {
            healthData.failureCount++;
        } else {
            healthData.failureCount = 0;
        }
        
        // Check if instance needs recovery
        if (healthData.failureCount >= this.unhealthyThreshold) {
            healthData.status = 'unhealthy';
            console.log(`Instance ${instance.instanceId} marked unhealthy after ${healthData.failureCount} failures`);
            
            // Trigger recovery
            await this.attemptRecovery(instance);
        } else {
            healthData.status = healthResult.status;
        }
    }

    /**
     * Attempt to recover an unhealthy instance
     */
    async attemptRecovery(instance) {
        console.log(`Attempting recovery for ${instance.instanceId}...`);
        
        try {
            // Wait before recovery
            await new Promise(resolve => setTimeout(resolve, this.recoveryDelay));
            
            // Check if instance is truly dead
            const isActive = await this.mcpTools.instanceManager.isInstanceActive(instance.instanceId);
            
            if (!isActive) {
                // Instance is dead, attempt restart
                console.log(`Restarting dead instance ${instance.instanceId}`);
                const result = await this.mcpTools.restart({ instanceId: instance.instanceId });
                
                if (result.status === 'restarted') {
                    console.log(`Successfully restarted ${instance.instanceId}`);
                    
                    // Reset health data
                    const healthData = this.healthChecks.get(instance.instanceId);
                    if (healthData) {
                        healthData.failureCount = 0;
                        healthData.status = 'recovering';
                    }
                    
                    // Record recovery metric
                    if (this.stateStore) {
                        await this.stateStore.recordMetric('instance_recovery', {
                            instanceId: instance.instanceId,
                            action: 'restart',
                            success: true
                        });
                    }
                }
            } else {
                // Instance is alive but unhealthy
                console.log(`Instance ${instance.instanceId} is alive but unhealthy`);
                
                // For Specialists, might need to terminate and respawn
                if (instance.role === 'specialist' && instance.parentId) {
                    console.log(`Terminating unhealthy specialist ${instance.instanceId}`);
                    await this.mcpTools.terminate({ instanceId: instance.instanceId });
                    
                    // Notify parent Manager
                    await this.mcpTools.send({
                        instanceId: instance.parentId,
                        text: `SPECIALIST_FAILED: ${instance.instanceId} was unhealthy and terminated`
                    });
                }
            }
            
        } catch (error) {
            console.error(`Recovery failed for ${instance.instanceId}:`, error);
            
            if (this.stateStore) {
                await this.stateStore.recordMetric('instance_recovery', {
                    instanceId: instance.instanceId,
                    action: 'restart',
                    success: false,
                    error: error.message
                });
            }
        }
    }

    /**
     * Detect if instance is stuck
     */
    detectStuckPatterns(output) {
        if (!output) return false;
        
        const stuckPatterns = [
            /Thinking\s+\(\d+\.\d+s\).*Thinking\s+\(\d+\.\d+s\)/s, // Multiple thinking
            /waiting for input.*waiting for input/is, // Repeated waiting
            /\n{10,}/  // Many blank lines
        ];
        
        return stuckPatterns.some(pattern => pattern.test(output));
    }

    /**
     * Detect error patterns
     */
    detectErrorPatterns(output) {
        if (!output) return false;
        
        const errorPatterns = [
            /fatal error/i,
            /unhandled exception/i,
            /segmentation fault/i,
            /out of memory/i,
            /permission denied/i,
            /cannot allocate/i
        ];
        
        return errorPatterns.some(pattern => pattern.test(output));
    }

    /**
     * Calculate health score (0-100)
     */
    calculateHealthScore(factors) {
        let score = 100;
        
        if (!factors.responsive) score -= 50;
        if (factors.stuck) score -= 30;
        if (factors.errors) score -= 20;
        if (factors.responseTime > 3000) score -= 10;
        if (factors.responseTime > 5000) score -= 10;
        
        return Math.max(0, score);
    }

    /**
     * Get health status summary
     */
    getHealthSummary() {
        const summary = {
            total: this.healthChecks.size,
            healthy: 0,
            unhealthy: 0,
            recovering: 0,
            instances: {}
        };
        
        for (const [instanceId, data] of this.healthChecks) {
            summary.instances[instanceId] = {
                status: data.status,
                failureCount: data.failureCount,
                lastCheck: data.history[data.history.length - 1]
            };
            
            switch (data.status) {
                case 'healthy':
                    summary.healthy++;
                    break;
                case 'unhealthy':
                    summary.unhealthy++;
                    break;
                case 'recovering':
                    summary.recovering++;
                    break;
            }
        }
        
        return summary;
    }
}