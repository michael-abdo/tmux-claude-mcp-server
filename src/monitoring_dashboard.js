/**
 * Comprehensive Monitoring Dashboard
 * 
 * Web-based dashboard for monitoring tmux-claude-mcp-server operations:
 * - Real-time instance status
 * - Performance metrics
 * - Git operation tracking
 * - Message flow visualization
 * - Alert management
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { OptimizedInstanceManager } from './optimized_instance_manager.js';
import { createPerformanceMonitor } from './performance_monitor.js';

export class MonitoringDashboard {
    constructor(port = 3001, dependencies = {}) {
        this.port = port;
        
        // Allow dependency injection or delayed initialization
        this.dependencies = dependencies;
        this.autoStart = dependencies.autoStart !== false;
        
        // Instance manager (can be injected)
        this.instanceManager = dependencies.instanceManager || this._createDefaultInstanceManager();
        
        // Performance monitor (can be injected)
        this.performanceMonitor = dependencies.performanceMonitor || 
            (this.instanceManager ? createPerformanceMonitor(this.instanceManager) : null);
        
        // Dashboard state
        this.state = {
            instances: {},
            performance: {},
            alerts: [],
            gitOperations: [],
            messages: []
        };
        
        // Update intervals
        this.updateIntervals = {};
        
        // Server components (only create if autoStart is true)
        if (this.autoStart) {
            this.app = express();
            this.server = createServer(this.app);
            this.wss = new WebSocketServer({ server: this.server });
            
            // Setup
            this.setupMiddleware();
            this.setupRoutes();
            this.setupWebSocket();
            this.setupMonitoring();
        }
    }
    
    /**
     * Create default instance manager (used when not injected)
     */
    _createDefaultInstanceManager() {
        if (process.env.NODE_ENV === 'test') {
            // In test mode, don't create a real instance manager
            return null;
        }
        return new OptimizedInstanceManager();
    }
    
    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.static(path.join(process.cwd(), 'src', 'dashboard', 'public')));
    }
    
    setupRoutes() {
        // Dashboard home
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(process.cwd(), 'src', 'dashboard', 'public', 'index.html'));
        });
        
        // API endpoints
        this.app.get('/api/state', (req, res) => {
            res.json(this.getFullState());
        });
        
        this.app.get('/api/instances', (req, res) => {
            res.json(this.state.instances);
        });
        
        this.app.get('/api/performance', (req, res) => {
            res.json(this.performanceMonitor.getReport());
        });
        
        this.app.get('/api/metrics', (req, res) => {
            res.json(this.instanceManager.getPerformanceMetrics());
        });
        
        this.app.get('/api/recommendations', (req, res) => {
            res.json(this.performanceMonitor.getRecommendations());
        });
        
        // Control endpoints
        this.app.post('/api/spawn', async (req, res) => {
            try {
                const { role, workDir, context, parentId, options } = req.body;
                const instance = await this.instanceManager.spawnInstance(
                    role, workDir, context, parentId, options
                );
                res.json({ success: true, instance });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });
        
        this.app.post('/api/spawn-batch', async (req, res) => {
            try {
                const { instances } = req.body;
                const results = await this.instanceManager.spawnInstancesBatch(instances);
                res.json({ success: true, instances: results });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });
        
        this.app.post('/api/send-message', async (req, res) => {
            try {
                const { instanceId, message, options } = req.body;
                const result = await this.instanceManager.sendMessage(
                    instanceId, message, options
                );
                res.json({ success: true, result });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });
        
        this.app.post('/api/optimize', async (req, res) => {
            try {
                const { settings } = req.body;
                const optimizer = this.instanceManager.optimizer;
                
                // Update settings
                Object.assign(optimizer.config, settings);
                
                res.json({ 
                    success: true, 
                    config: optimizer.config 
                });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });
        
        this.app.delete('/api/instance/:id', async (req, res) => {
            try {
                const { id } = req.params;
                await this.instanceManager.terminateInstance(id);
                res.json({ success: true });
            } catch (error) {
                res.status(500).json({ success: false, error: error.message });
            }
        });
    }
    
    setupWebSocket() {
        this.wss.on('connection', (ws) => {
            console.log('Dashboard client connected');
            
            // Send initial state
            ws.send(JSON.stringify({
                type: 'initial',
                data: this.getFullState()
            }));
            
            // Handle client messages
            ws.on('message', (message) => {
                try {
                    const msg = JSON.parse(message);
                    this.handleClientMessage(ws, msg);
                } catch (error) {
                    console.error('Invalid WebSocket message:', error);
                }
            });
            
            ws.on('close', () => {
                console.log('Dashboard client disconnected');
            });
        });
    }
    
    setupMonitoring() {
        // Start performance monitoring
        this.performanceMonitor.start();
        
        // Listen to performance events
        this.performanceMonitor.on('snapshot', (snapshot) => {
            this.state.performance = snapshot;
            this.broadcast({
                type: 'performance',
                data: snapshot
            });
        });
        
        this.performanceMonitor.on('health-check', (report) => {
            this.state.alerts = report.issues;
            this.broadcast({
                type: 'alerts',
                data: report.issues
            });
        });
        
        this.performanceMonitor.on('performance-alert', (alert) => {
            this.state.alerts.unshift(alert);
            if (this.state.alerts.length > 100) {
                this.state.alerts.pop();
            }
            this.broadcast({
                type: 'alert',
                data: alert
            });
        });
        
        // Monitor instance changes
        this.updateIntervals.instances = setInterval(() => {
            this.updateInstanceState();
        }, 1000);
        
        // Monitor git operations
        this.updateIntervals.gitOps = setInterval(() => {
            this.updateGitOperations();
        }, 2000);
        
        // Monitor messages
        this.instanceManager.perfEvents?.on('message-batch', (event) => {
            this.state.messages.unshift({
                timestamp: Date.now(),
                ...event
            });
            if (this.state.messages.length > 50) {
                this.state.messages.pop();
            }
            this.broadcast({
                type: 'message',
                data: event
            });
        });
    }
    
    async updateInstanceState() {
        try {
            const instances = await this.instanceManager.listInstances();
            const changed = JSON.stringify(instances) !== JSON.stringify(this.state.instances);
            
            if (changed) {
                this.state.instances = instances;
                this.broadcast({
                    type: 'instances',
                    data: instances
                });
            }
        } catch (error) {
            console.error('Error updating instance state:', error);
        }
    }
    
    async updateGitOperations() {
        try {
            // Get recent git operations from performance metrics
            const metrics = this.instanceManager.getPerformanceMetrics();
            
            if (metrics.optimizer.gitOps.total > 0) {
                const gitOp = {
                    timestamp: Date.now(),
                    total: metrics.optimizer.gitOps.total,
                    concurrent: metrics.optimizer.gitOps.concurrent,
                    avgTime: metrics.optimizer.gitOps.avgTime
                };
                
                this.state.gitOperations.unshift(gitOp);
                if (this.state.gitOperations.length > 20) {
                    this.state.gitOperations.pop();
                }
                
                this.broadcast({
                    type: 'git-operation',
                    data: gitOp
                });
            }
        } catch (error) {
            console.error('Error updating git operations:', error);
        }
    }
    
    handleClientMessage(ws, message) {
        switch (message.type) {
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong' }));
                break;
                
            case 'subscribe':
                // Client wants specific updates
                if (message.topics) {
                    ws.topics = message.topics;
                }
                break;
                
            case 'command':
                // Execute command and return result
                this.handleCommand(ws, message.command, message.params);
                break;
        }
    }
    
    async handleCommand(ws, command, params) {
        try {
            let result;
            
            switch (command) {
                case 'refresh':
                    result = this.getFullState();
                    break;
                    
                case 'clear-alerts':
                    this.state.alerts = [];
                    result = { success: true };
                    break;
                    
                case 'get-logs':
                    result = await this.getInstanceLogs(params.instanceId);
                    break;
                    
                default:
                    throw new Error(`Unknown command: ${command}`);
            }
            
            ws.send(JSON.stringify({
                type: 'command-result',
                command,
                result
            }));
        } catch (error) {
            ws.send(JSON.stringify({
                type: 'command-error',
                command,
                error: error.message
            }));
        }
    }
    
    async getInstanceLogs(instanceId) {
        try {
            const output = await this.instanceManager.readInstance(instanceId);
            return {
                instanceId,
                output,
                timestamp: Date.now()
            };
        } catch (error) {
            return {
                instanceId,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }
    
    getFullState() {
        return {
            instances: this.state.instances,
            performance: this.state.performance,
            alerts: this.state.alerts,
            gitOperations: this.state.gitOperations,
            messages: this.state.messages,
            metrics: this.instanceManager?.getPerformanceMetrics ? 
                this.instanceManager.getPerformanceMetrics() : {},
            recommendations: this.performanceMonitor?.getRecommendations ? 
                this.performanceMonitor.getRecommendations() : [],
            timestamp: Date.now()
        };
    }
    
    /**
     * Initialize server components (for manual initialization)
     */
    initializeServer() {
        if (!this.app) {
            this.app = express();
            this.server = createServer(this.app);
            this.wss = new WebSocketServer({ server: this.server });
            
            this.setupMiddleware();
            this.setupRoutes();
            this.setupWebSocket();
            this.setupMonitoring();
        }
    }
    
    /**
     * Get instance metrics for testing
     */
    async getInstanceMetrics() {
        if (!this.instanceManager) {
            return { total: 0, byRole: {}, byStatus: {} };
        }
        
        const instances = await this.instanceManager.getAllInstances();
        const metrics = {
            total: instances.length,
            byRole: {},
            byStatus: {}
        };
        
        instances.forEach(instance => {
            // Count by role
            metrics.byRole[instance.role] = (metrics.byRole[instance.role] || 0) + 1;
            // Count by status
            metrics.byStatus[instance.status] = (metrics.byStatus[instance.status] || 0) + 1;
        });
        
        return metrics;
    }
    
    broadcast(message) {
        const data = JSON.stringify(message);
        this.wss.clients.forEach((client) => {
            if (client.readyState === 1) { // WebSocket.OPEN
                // Check if client has topic subscriptions
                if (!client.topics || client.topics.includes(message.type)) {
                    client.send(data);
                }
            }
        });
    }
    
    start() {
        this.server.listen(this.port, () => {
            console.log(`🎯 Monitoring Dashboard running at http://localhost:${this.port}`);
            console.log(`📊 WebSocket endpoint: ws://localhost:${this.port}`);
        });
    }
    
    stop() {
        // Clear intervals
        Object.values(this.updateIntervals).forEach(interval => {
            clearInterval(interval);
        });
        
        // Stop monitoring
        if (this.performanceMonitor?.stop) {
            this.performanceMonitor.stop();
        }
        
        // Close WebSocket connections
        if (this.wss?.clients) {
            this.wss.clients.forEach((client) => {
                client.close();
            });
        }
        
        // Close server
        if (this.server) {
            this.server.close();
        }
        
        console.log('🛑 Monitoring Dashboard stopped');
    }
}

// Export for use
export function createMonitoringDashboard(port, dependencies = {}) {
    return new MonitoringDashboard(port, dependencies);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const dashboard = createMonitoringDashboard(process.env.DASHBOARD_PORT || 3001);
    dashboard.start();
    
    // Handle shutdown
    process.on('SIGINT', () => {
        console.log('\nShutting down dashboard...');
        dashboard.stop();
        process.exit(0);
    });
}