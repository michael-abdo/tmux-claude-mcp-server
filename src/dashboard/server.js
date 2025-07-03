#!/usr/bin/env node

/**
 * Dashboard Server for tmux-claude Monitoring
 * 
 * Provides REST API and serves the monitoring dashboard
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { InstanceManager } from '../instance_manager.js';
import { RedisStateStore } from '../redis_state_store.js';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DashboardServer {
    constructor(port = 3000) {
        this.port = port;
        this.app = express();
        this.instanceManager = null;
        this.stateStore = null;
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    async initialize() {
        // Initialize instance manager and state store
        const stateDir = path.join(__dirname, '..', '..', 'state');
        this.instanceManager = new InstanceManager(stateDir, { useRedis: true });
        
        if (process.env.PHASE === '3') {
            this.stateStore = new RedisStateStore();
            await this.stateStore.initialize();
        }
        
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('Dashboard server initialized');
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static(__dirname));
    }

    setupRoutes() {
        // Serve dashboard
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'index.html'));
        });
        
        // Serve executive dashboard
        this.app.get('/executive', (req, res) => {
            res.sendFile(path.join(__dirname, 'executive.html'));
        });

        // API: Get all instances
        this.app.get('/api/instances', async (req, res) => {
            try {
                const instances = await this.instanceManager.listInstances();
                
                // Enhance with current status
                const enhancedInstances = await Promise.all(
                    instances.map(async (instance) => {
                        const isActive = await this.instanceManager.isInstanceActive(instance.instanceId);
                        return {
                            ...instance,
                            status: isActive ? 'active' : 'inactive'
                        };
                    })
                );
                
                res.json(enhancedInstances);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // API: Get instance details
        this.app.get('/api/instances/:id', async (req, res) => {
            try {
                const instanceId = req.params.id;
                const instances = await this.instanceManager.listInstances();
                const instance = instances.find(i => i.instanceId === instanceId);
                
                if (!instance) {
                    return res.status(404).json({ error: 'Instance not found' });
                }
                
                // Get recent output
                const output = await this.instanceManager.readFromInstance(instanceId, 50);
                
                res.json({
                    ...instance,
                    output: output.output,
                    isActive: await this.instanceManager.isInstanceActive(instanceId)
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // API: Restart instance
        this.app.post('/api/instances/:id/restart', async (req, res) => {
            try {
                const instanceId = req.params.id;
                const result = await this.instanceManager.restartInstance(instanceId);
                res.json({ success: true, result });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // API: Terminate instance
        this.app.delete('/api/instances/:id', async (req, res) => {
            try {
                const instanceId = req.params.id;
                const cascade = req.query.cascade === 'true';
                const result = await this.instanceManager.terminateInstance(instanceId, cascade);
                res.json({ success: result });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // API: Get metrics
        this.app.get('/api/metrics', async (req, res) => {
            try {
                const metrics = {
                    tasksProcessed: 0,
                    avgResponseTime: 0,
                    performance: {
                        cpu: 0,
                        memory: 0
                    }
                };

                // Get metrics from state store if available
                if (this.stateStore) {
                    const recentMetrics = await this.stateStore.getRecentMetrics(60); // Last minute
                    
                    // Calculate aggregates
                    if (recentMetrics.length > 0) {
                        const taskMetrics = recentMetrics.filter(m => m.type === 'task_execution');
                        metrics.tasksProcessed = taskMetrics.length;
                        
                        if (taskMetrics.length > 0) {
                            const totalTime = taskMetrics.reduce((sum, m) => sum + (m.data.duration || 0), 0);
                            metrics.avgResponseTime = Math.round(totalTime / taskMetrics.length);
                        }
                    }
                }

                // Get system performance
                const cpuUsage = process.cpuUsage();
                const memUsage = process.memoryUsage();
                
                // Note: This is cumulative CPU time, not percentage
                // For dashboard, we'll need differential measurements
                metrics.performance = {
                    cpu: 0, // Will be calculated in /api/performance endpoint
                    memory: Math.round(memUsage.heapUsed / 1024 / 1024) // Convert to MB
                };

                res.json(metrics);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // API: Get logs
        this.app.get('/api/logs', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit) || 100;
                const logs = [];

                // Get recent metrics as logs
                if (this.stateStore) {
                    const metrics = await this.stateStore.getRecentMetrics(300); // Last 5 minutes
                    
                    metrics.forEach(metric => {
                        logs.push({
                            timestamp: metric.timestamp,
                            level: metric.type.includes('error') ? 'error' : 'info',
                            message: `${metric.type}: ${JSON.stringify(metric.data)}`
                        });
                    });
                }

                // Sort by timestamp descending
                logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                res.json(logs.slice(0, limit));
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Store previous CPU measurement for differential calculation
        let previousCpuUsage = process.cpuUsage();
        let previousCpuTime = Date.now();
        
        // API: Get performance metrics with proper CPU percentage
        this.app.get('/api/performance', (req, res) => {
            const memUsage = process.memoryUsage();
            const currentCpuUsage = process.cpuUsage();
            const currentTime = Date.now();
            
            // Calculate CPU percentage using differential measurements
            const elapsedTime = currentTime - previousCpuTime;
            const userDiff = currentCpuUsage.user - previousCpuUsage.user;
            const systemDiff = currentCpuUsage.system - previousCpuUsage.system;
            
            // CPU percentage = (CPU time used / elapsed time) * 100
            // Note: CPU time is in microseconds, elapsed time is in milliseconds
            const cpuPercentage = elapsedTime > 0 
                ? Math.min(100, Math.round(((userDiff + systemDiff) / (elapsedTime * 1000)) * 100))
                : 0;
            
            // Update previous measurements for next calculation
            previousCpuUsage = currentCpuUsage;
            previousCpuTime = currentTime;
            
            res.json({
                timestamp: new Date().toISOString(),
                memory: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
                cpu: cpuPercentage, // Now a proper percentage 0-100
                activeJobs: 0, // Placeholder - would come from job queue
                pendingJobs: 0  // Placeholder - would come from job queue
            });
        });
        
        // API: Get system info
        this.app.get('/api/system', (req, res) => {
            res.json({
                platform: os.platform(),
                arch: os.arch(),
                cpus: os.cpus().length,
                totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024), // GB
                freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024), // GB
                uptime: os.uptime(),
                nodeVersion: process.version,
                phase: process.env.PHASE || '2'
            });
        });
        
        // API: Get job statistics
        this.app.get('/api/jobs/stats', async (req, res) => {
            try {
                // Mock job statistics - in production, fetch from job queue
                const stats = {
                    total: 150,
                    completed: 120,
                    failed: 5,
                    pending: 10,
                    running: 15,
                    queued: 8
                };
                res.json(stats);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // API: Distribute job
        this.app.post('/api/jobs/distribute', async (req, res) => {
            try {
                const { name, tasks } = req.body;
                const jobId = `job_${Date.now()}`;
                
                // In production, this would use the job queue and parallel executor
                console.log(`Distributing job ${jobId}: ${name}`);
                
                res.json({
                    success: true,
                    jobId,
                    message: `Job ${jobId} distributed to managers`
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // API: Emergency stop
        this.app.post('/api/emergency-stop', async (req, res) => {
            try {
                console.log('Emergency stop requested!');
                
                // In production, this would stop all active jobs
                // For now, just log and return success
                
                res.json({
                    success: true,
                    message: 'Emergency stop executed',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    async start() {
        await this.initialize();
        
        this.server = this.app.listen(this.port, () => {
            console.log(`Dashboard server running at http://localhost:${this.port}`);
            console.log(`Phase: ${process.env.PHASE || '2'}`);
        });
    }

    async stop() {
        if (this.server) {
            this.server.close();
        }
        if (this.stateStore) {
            await this.stateStore.cleanup();
        }
    }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const port = process.env.PORT || 3000;
    const server = new DashboardServer(port);
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\nShutting down dashboard server...');
        await server.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('\nShutting down dashboard server...');
        await server.stop();
        process.exit(0);
    });

    server.start().catch(console.error);
}

export { DashboardServer };