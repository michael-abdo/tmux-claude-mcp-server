/**
 * Dashboard Client JavaScript
 * 
 * Handles WebSocket connection and UI updates
 */

class Dashboard {
    constructor() {
        this.ws = null;
        this.state = {
            instances: {},
            performance: {},
            alerts: [],
            gitOperations: [],
            messages: [],
            metrics: {},
            recommendations: []
        };
        
        this.reconnectInterval = null;
        this.connect();
    }
    
    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        console.log('Connecting to WebSocket:', wsUrl);
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.updateConnectionStatus(true);
            
            // Clear reconnect interval
            if (this.reconnectInterval) {
                clearInterval(this.reconnectInterval);
                this.reconnectInterval = null;
            }
            
            // Subscribe to all updates
            this.ws.send(JSON.stringify({
                type: 'subscribe',
                topics: ['instances', 'performance', 'alerts', 'git-operation', 'message']
            }));
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.updateConnectionStatus(false);
            
            // Attempt to reconnect
            if (!this.reconnectInterval) {
                this.reconnectInterval = setInterval(() => {
                    console.log('Attempting to reconnect...');
                    this.connect();
                }, 5000);
            }
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };
    }
    
    handleMessage(message) {
        switch (message.type) {
            case 'initial':
                this.state = message.data;
                this.updateAll();
                break;
                
            case 'instances':
                this.state.instances = message.data;
                this.updateInstances();
                break;
                
            case 'performance':
                this.state.performance = message.data;
                this.updatePerformance();
                break;
                
            case 'alerts':
            case 'alert':
                if (Array.isArray(message.data)) {
                    this.state.alerts = message.data;
                } else {
                    this.state.alerts.unshift(message.data);
                    if (this.state.alerts.length > 50) {
                        this.state.alerts.pop();
                    }
                }
                this.updateAlerts();
                break;
                
            case 'git-operation':
                this.state.gitOperations.unshift(message.data);
                if (this.state.gitOperations.length > 20) {
                    this.state.gitOperations.pop();
                }
                this.updateGitOperations();
                break;
                
            case 'message':
                this.state.messages.unshift(message.data);
                if (this.state.messages.length > 50) {
                    this.state.messages.pop();
                }
                break;
                
            case 'command-result':
                console.log('Command result:', message.result);
                break;
                
            case 'command-error':
                console.error('Command error:', message.error);
                alert(`Error: ${message.error}`);
                break;
        }
    }
    
    updateAll() {
        this.updateInstances();
        this.updatePerformance();
        this.updateAlerts();
        this.updateGitOperations();
        this.updateMetrics();
        this.updateRecommendations();
    }
    
    updateInstances() {
        const container = document.getElementById('instance-list');
        const count = document.getElementById('instance-count');
        
        const instances = Object.values(this.state.instances || {});
        count.textContent = instances.length;
        
        if (instances.length === 0) {
            container.innerHTML = '<div class="loading">No active instances</div>';
            return;
        }
        
        container.innerHTML = instances.map(instance => `
            <div class="instance-item">
                <div class="instance-info">
                    <div>
                        <span class="instance-id">${instance.instanceId}</span>
                        <span class="instance-role role-${instance.role}">${instance.role}</span>
                    </div>
                    <div class="instance-status">
                        ${instance.workingDirectory || 'No directory'} | 
                        ${instance.status || 'active'}
                    </div>
                </div>
                <button onclick="dashboard.terminateInstance('${instance.instanceId}')" 
                        style="padding: 5px 10px; font-size: 12px;">
                    Terminate
                </button>
            </div>
        `).join('');
    }
    
    updatePerformance() {
        const perf = this.state.performance;
        if (!perf || !perf.optimizer) return;
        
        // Update metrics
        document.getElementById('total-instances').textContent = 
            perf.instances?.total || 0;
        document.getElementById('active-spawns').textContent = 
            perf.optimizer?.spawns?.concurrent || 0;
        document.getElementById('message-queue').textContent = 
            perf.optimizer?.queues?.spawn?.pending || 0;
        document.getElementById('cache-hit-rate').textContent = 
            Math.round((perf.optimizer?.cache?.hitRate || 0) * 100) + '%';
        
        // Update pools
        document.getElementById('instance-pool').textContent = 
            perf.optimizer?.pools?.instance || 0;
        document.getElementById('worktree-pool').textContent = 
            perf.optimizer?.pools?.worktree || 0;
        document.getElementById('redis-status').textContent = 
            perf.redis?.connected ? 'Connected' : 'Disconnected';
        
        // Update performance score
        this.updatePerformanceScore();
    }
    
    updatePerformanceScore() {
        const scoreElement = document.getElementById('performance-score');
        const summaryElement = document.getElementById('performance-summary');
        
        // Calculate score (simplified version)
        let score = 100;
        const metrics = this.state.metrics || {};
        const optimizer = metrics.optimizer || {};
        
        // Deduct for queue backlogs
        if (optimizer.queues) {
            score -= Math.min(optimizer.queues.spawn?.pending * 2 || 0, 20);
            score -= Math.min(optimizer.queues.git?.pending || 0, 10);
        }
        
        // Deduct for low cache hit rate
        if (optimizer.cache) {
            const hitRate = optimizer.cache.hitRate || 0;
            if (hitRate < 0.8) {
                score -= (0.8 - hitRate) * 20;
            }
        }
        
        // Deduct for high instance count
        const instanceCount = metrics.instances?.total || 0;
        if (instanceCount > 50) {
            score -= Math.min((instanceCount - 50) * 0.5, 20);
        }
        
        score = Math.max(0, Math.round(score));
        
        // Update display
        scoreElement.textContent = score;
        scoreElement.className = 'performance-score';
        
        if (score >= 90) {
            scoreElement.classList.add('score-excellent');
            summaryElement.textContent = 'System performing excellently';
        } else if (score >= 70) {
            scoreElement.classList.add('score-good');
            summaryElement.textContent = 'System performing well';
        } else if (score >= 50) {
            scoreElement.classList.add('score-fair');
            summaryElement.textContent = 'System needs optimization';
        } else {
            scoreElement.classList.add('score-poor');
            summaryElement.textContent = 'System performance degraded';
        }
    }
    
    updateAlerts() {
        const container = document.getElementById('alert-list');
        const count = document.getElementById('alert-count');
        
        const alerts = this.state.alerts || [];
        count.textContent = alerts.length;
        
        if (alerts.length === 0) {
            container.innerHTML = '<div class="loading">No alerts</div>';
            return;
        }
        
        container.innerHTML = alerts.map(alert => {
            const severity = alert.severity || 'info';
            const time = alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : '';
            
            return `
                <div class="alert-item ${severity}">
                    <div>${alert.message || alert.type}</div>
                    ${time ? `<div class="alert-time">${time}</div>` : ''}
                </div>
            `;
        }).join('');
    }
    
    updateGitOperations() {
        const container = document.getElementById('git-operations');
        const ops = this.state.gitOperations || [];
        
        if (ops.length === 0) {
            container.innerHTML = '<div class="loading">No recent operations</div>';
            return;
        }
        
        container.innerHTML = ops.slice(0, 10).map(op => {
            const time = new Date(op.timestamp).toLocaleTimeString();
            return `
                <div class="git-operation">
                    <span>${time}</span>
                    <span>${op.total} ops, ${op.concurrent} concurrent</span>
                    <span>${op.avgTime}ms avg</span>
                </div>
            `;
        }).join('');
    }
    
    updateMetrics() {
        // Fetch latest metrics
        fetch('/api/metrics')
            .then(res => res.json())
            .then(metrics => {
                this.state.metrics = metrics;
                this.updatePerformance();
            })
            .catch(err => console.error('Error fetching metrics:', err));
    }
    
    updateRecommendations() {
        const container = document.getElementById('recommendations');
        const recs = this.state.recommendations || [];
        
        if (recs.length === 0) {
            fetch('/api/recommendations')
                .then(res => res.json())
                .then(recommendations => {
                    this.state.recommendations = recommendations;
                    this.displayRecommendations();
                })
                .catch(err => console.error('Error fetching recommendations:', err));
        } else {
            this.displayRecommendations();
        }
    }
    
    displayRecommendations() {
        const container = document.getElementById('recommendations');
        const recs = this.state.recommendations || [];
        
        if (recs.length === 0) {
            container.innerHTML = '<div class="loading">No recommendations at this time</div>';
            return;
        }
        
        container.innerHTML = recs.map(rec => `
            <div class="recommendation-item">
                <strong>[${rec.priority}]</strong> ${rec.suggestion}
                <br><small>Impact: ${rec.impact}</small>
            </div>
        `).join('');
    }
    
    updateConnectionStatus(connected) {
        const dot = document.getElementById('connection-dot');
        const text = document.getElementById('connection-text');
        
        if (connected) {
            dot.classList.remove('disconnected');
            text.textContent = 'Connected';
        } else {
            dot.classList.add('disconnected');
            text.textContent = 'Disconnected';
        }
    }
    
    // Control methods
    refresh() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'command',
                command: 'refresh'
            }));
        }
    }
    
    clearAlerts() {
        this.state.alerts = [];
        this.updateAlerts();
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'command',
                command: 'clear-alerts'
            }));
        }
    }
    
    async terminateInstance(instanceId) {
        if (!confirm(`Terminate instance ${instanceId}?`)) return;
        
        try {
            const response = await fetch(`/api/instance/${instanceId}`, {
                method: 'DELETE'
            });
            
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error);
            }
            
            console.log(`Instance ${instanceId} terminated`);
        } catch (error) {
            alert(`Error terminating instance: ${error.message}`);
        }
    }
    
    showSpawnDialog() {
        const role = prompt('Enter role (executive/manager/specialist):');
        if (!role) return;
        
        const workDir = prompt('Enter working directory:', '/tmp');
        if (!workDir) return;
        
        const context = prompt('Enter context:', 'Manual spawn from dashboard');
        if (!context) return;
        
        this.spawnInstance(role, workDir, context);
    }
    
    async spawnInstance(role, workDir, context) {
        try {
            const response = await fetch('/api/spawn', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role, workDir, context })
            });
            
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error);
            }
            
            console.log('Instance spawned:', result.instance);
        } catch (error) {
            alert(`Error spawning instance: ${error.message}`);
        }
    }
    
    showOptimizeDialog() {
        const current = this.state.metrics?.optimizer?.config || {};
        
        const settings = {
            maxConcurrentSpawns: parseInt(prompt('Max concurrent spawns:', current.maxConcurrentSpawns || 5)),
            messageBatchSize: parseInt(prompt('Message batch size:', current.messageBatchSize || 10)),
            messageBatchDelay: parseInt(prompt('Message batch delay (ms):', current.messageBatchDelay || 100))
        };
        
        if (Object.values(settings).some(v => isNaN(v))) {
            alert('Invalid settings');
            return;
        }
        
        this.optimizeSettings(settings);
    }
    
    async optimizeSettings(settings) {
        try {
            const response = await fetch('/api/optimize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings })
            });
            
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error);
            }
            
            console.log('Settings optimized:', result.config);
            alert('Settings updated successfully');
        } catch (error) {
            alert(`Error optimizing settings: ${error.message}`);
        }
    }
}

// Initialize dashboard
const dashboard = new Dashboard();