#!/usr/bin/env node

/**
 * Distributed Orchestration Coordinator for Claude Code Platform
 * Manages multiple Claude environments and coordinates cross-platform tasks
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');

class DistributedCoordinator {
    constructor() {
        this.configFile = path.join(__dirname, '../config/distributed.json');
        this.nodesFile = path.join(__dirname, '../state/nodes.json');
        this.tasksFile = path.join(__dirname, '../state/distributed_tasks.json');
        
        this.nodeId = this.generateNodeId();
        this.isLeader = false;
        this.nodes = new Map();
        this.tasks = new Map();
        
        this.defaultConfig = {
            cluster: {
                name: 'claude-orchestration',
                heartbeatInterval: 30000, // 30 seconds
                leaderElection: true,
                loadBalancing: true,
                failover: true
            },
            node: {
                role: 'worker', // leader, worker, specialist
                capacity: {
                    maxInstances: 20,
                    maxMemory: '8GB',
                    maxCPU: 80 // percentage
                },
                capabilities: ['claude-instances', 'workflows', 'monitoring'],
                tags: ['development']
            },
            communication: {
                protocol: 'http',
                port: 8080,
                encryption: false,
                timeout: 30000
            },
            taskDistribution: {
                algorithm: 'round-robin', // round-robin, least-loaded, capability-based
                retryAttempts: 3,
                retryDelay: 5000
            }
        };
    }

    async start() {
        console.log('🌐 Starting Distributed Orchestration Coordinator...');
        console.log(''.padEnd(80, '='));
        
        try {
            // Load configuration
            await this.loadConfig();
            
            // Initialize node
            await this.initializeNode();
            
            // Start services
            await this.startServices();
            
            // Join cluster
            await this.joinCluster();
            
            // Start main loop
            await this.mainLoop();
            
        } catch (error) {
            console.error('❌ Coordinator startup failed:', error.message);
            process.exit(1);
        }
    }

    async initializeNode() {
        console.log(`🔧 Initializing node: ${this.nodeId}`);
        
        // Get system information
        const systemInfo = await this.getSystemInfo();
        
        this.nodeInfo = {
            id: this.nodeId,
            role: this.config.node.role,
            status: 'initializing',
            capabilities: this.config.node.capabilities,
            capacity: this.config.node.capacity,
            tags: this.config.node.tags,
            system: systemInfo,
            lastHeartbeat: new Date().toISOString(),
            started: new Date().toISOString(),
            tasks: [],
            load: {
                instances: 0,
                memory: 0,
                cpu: 0
            }
        };
        
        console.log(`   Role: ${this.nodeInfo.role}`);
        console.log(`   Capabilities: ${this.nodeInfo.capabilities.join(', ')}`);
        console.log(`   Max Instances: ${this.nodeInfo.capacity.maxInstances}`);
    }

    async joinCluster() {
        console.log('🔗 Joining cluster...');
        
        // Load existing nodes
        await this.loadNodes();
        
        // Register this node
        this.nodes.set(this.nodeId, this.nodeInfo);
        
        // Save nodes state
        await this.saveNodes();
        
        // Trigger leader election if needed
        if (this.config.cluster.leaderElection) {
            await this.electLeader();
        }
        
        this.nodeInfo.status = 'active';
        console.log(`   ✅ Joined cluster: ${this.config.cluster.name}`);
        console.log(`   🆔 Node ID: ${this.nodeId}`);
        console.log(`   👑 Leader: ${this.isLeader ? 'Yes' : 'No'}`);
    }

    async mainLoop() {
        console.log('🔄 Starting main coordination loop...');
        
        while (true) {
            try {
                // Send heartbeat
                await this.sendHeartbeat();
                
                // Process tasks if leader
                if (this.isLeader) {
                    await this.processTasks();
                    await this.monitorCluster();
                }
                
                // Execute assigned tasks
                await this.executeAssignedTasks();
                
                // Update load metrics
                await this.updateLoadMetrics();
                
                // Sleep until next cycle
                await this.sleep(this.config.cluster.heartbeatInterval);
                
            } catch (error) {
                console.error('❌ Main loop error:', error.message);
                await this.sleep(5000); // Brief pause before retry
            }
        }
    }

    async electLeader() {
        const activeNodes = Array.from(this.nodes.values())
            .filter(node => node.status === 'active')
            .sort((a, b) => a.started.localeCompare(b.started));
        
        if (activeNodes.length === 0) {
            this.isLeader = true;
            return;
        }
        
        // Oldest node becomes leader
        const leaderId = activeNodes[0].id;
        this.isLeader = (leaderId === this.nodeId);
        
        if (this.isLeader) {
            console.log('👑 Elected as cluster leader');
            this.nodeInfo.role = 'leader';
        }
    }

    async submitTask(task) {
        console.log('📋 Submitting distributed task...');
        
        const taskId = this.generateTaskId();
        const distributedTask = {
            id: taskId,
            type: task.type,
            priority: task.priority || 'medium',
            payload: task.payload,
            requirements: task.requirements || {},
            submitted: new Date().toISOString(),
            submittedBy: this.nodeId,
            status: 'pending',
            assignedTo: null,
            attempts: 0,
            maxAttempts: this.config.taskDistribution.retryAttempts,
            results: null
        };
        
        // Add to task queue
        this.tasks.set(taskId, distributedTask);
        await this.saveTasks();
        
        console.log(`   Task ID: ${taskId}`);
        console.log(`   Type: ${task.type}`);
        console.log(`   Priority: ${distributedTask.priority}`);
        
        return taskId;
    }

    async processTasks() {
        if (!this.isLeader) return;
        
        const pendingTasks = Array.from(this.tasks.values())
            .filter(task => task.status === 'pending')
            .sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));
        
        for (const task of pendingTasks) {
            try {
                const assignedNode = await this.selectNodeForTask(task);
                
                if (assignedNode) {
                    await this.assignTask(task, assignedNode);
                }
                
            } catch (error) {
                console.error(`❌ Failed to process task ${task.id}:`, error.message);
            }
        }
    }

    async selectNodeForTask(task) {
        const availableNodes = Array.from(this.nodes.values())
            .filter(node => 
                node.status === 'active' &&
                this.nodeCanHandleTask(node, task)
            );
        
        if (availableNodes.length === 0) {
            return null;
        }
        
        const algorithm = this.config.taskDistribution.algorithm;
        
        switch (algorithm) {
            case 'round-robin':
                return this.selectRoundRobin(availableNodes);
                
            case 'least-loaded':
                return this.selectLeastLoaded(availableNodes);
                
            case 'capability-based':
                return this.selectBestCapability(availableNodes, task);
                
            default:
                return availableNodes[0];
        }
    }

    nodeCanHandleTask(node, task) {
        // Check capacity
        if (node.load.instances >= node.capacity.maxInstances) {
            return false;
        }
        
        // Check capabilities
        if (task.requirements.capabilities) {
            const hasCapabilities = task.requirements.capabilities.every(cap =>
                node.capabilities.includes(cap)
            );
            if (!hasCapabilities) {
                return false;
            }
        }
        
        // Check tags
        if (task.requirements.tags) {
            const hasTags = task.requirements.tags.some(tag =>
                node.tags.includes(tag)
            );
            if (!hasTags) {
                return false;
            }
        }
        
        return true;
    }

    selectRoundRobin(nodes) {
        // Simple implementation - rotate through available nodes
        const sortedNodes = nodes.sort((a, b) => a.id.localeCompare(b.id));
        const index = Date.now() % sortedNodes.length;
        return sortedNodes[index];
    }

    selectLeastLoaded(nodes) {
        return nodes.reduce((least, current) => {
            const leastScore = this.calculateLoadScore(least);
            const currentScore = this.calculateLoadScore(current);
            return currentScore < leastScore ? current : least;
        });
    }

    selectBestCapability(nodes, task) {
        // Score nodes based on capability match
        const scored = nodes.map(node => ({
            node,
            score: this.calculateCapabilityScore(node, task)
        }));
        
        scored.sort((a, b) => b.score - a.score);
        return scored[0].node;
    }

    calculateLoadScore(node) {
        return (
            (node.load.instances / node.capacity.maxInstances) * 0.4 +
            (node.load.memory / 100) * 0.3 +
            (node.load.cpu / 100) * 0.3
        );
    }

    calculateCapabilityScore(node, task) {
        let score = 0;
        
        // Basic capability match
        if (task.requirements.capabilities) {
            const matches = task.requirements.capabilities.filter(cap =>
                node.capabilities.includes(cap)
            ).length;
            score += matches * 10;
        }
        
        // Tag preference
        if (task.requirements.tags) {
            const tagMatches = task.requirements.tags.filter(tag =>
                node.tags.includes(tag)
            ).length;
            score += tagMatches * 5;
        }
        
        // Load factor (prefer less loaded nodes)
        score += (1 - this.calculateLoadScore(node)) * 20;
        
        return score;
    }

    async assignTask(task, node) {
        console.log(`📤 Assigning task ${task.id} to node ${node.id}`);
        
        task.status = 'assigned';
        task.assignedTo = node.id;
        task.assignedAt = new Date().toISOString();
        task.attempts++;
        
        // Add task to node's task list
        if (!node.tasks) node.tasks = [];
        node.tasks.push(task.id);
        
        // Update load
        node.load.instances++;
        
        await this.saveTasks();
        await this.saveNodes();
        
        // Send task to node (in real implementation, would use network)
        if (node.id === this.nodeId) {
            // Local task execution
            setImmediate(() => this.executeTask(task));
        }
    }

    async executeAssignedTasks() {
        const myTasks = Array.from(this.tasks.values())
            .filter(task => 
                task.assignedTo === this.nodeId && 
                task.status === 'assigned'
            );
        
        for (const task of myTasks) {
            await this.executeTask(task);
        }
    }

    async executeTask(task) {
        console.log(`⚡ Executing task: ${task.id}`);
        
        task.status = 'running';
        task.startedAt = new Date().toISOString();
        
        try {
            let result;
            
            switch (task.type) {
                case 'spawn-instance':
                    result = await this.executeSpawnInstance(task.payload);
                    break;
                    
                case 'run-workflow':
                    result = await this.executeRunWorkflow(task.payload);
                    break;
                    
                case 'health-check':
                    result = await this.executeHealthCheck(task.payload);
                    break;
                    
                case 'cleanup':
                    result = await this.executeCleanup(task.payload);
                    break;
                    
                case 'backup':
                    result = await this.executeBackup(task.payload);
                    break;
                    
                default:
                    throw new Error(`Unknown task type: ${task.type}`);
            }
            
            task.status = 'completed';
            task.results = result;
            task.completedAt = new Date().toISOString();
            
            console.log(`   ✅ Task completed: ${task.id}`);
            
        } catch (error) {
            task.status = 'failed';
            task.error = error.message;
            task.failedAt = new Date().toISOString();
            
            console.log(`   ❌ Task failed: ${task.id} - ${error.message}`);
            
            // Retry logic
            if (task.attempts < task.maxAttempts) {
                task.status = 'pending';
                task.assignedTo = null;
                
                setTimeout(() => {
                    // Task will be reassigned in next processing cycle
                }, this.config.taskDistribution.retryDelay);
            }
        }
        
        // Update node load
        const node = this.nodes.get(this.nodeId);
        if (node) {
            node.load.instances = Math.max(0, node.load.instances - 1);
            if (node.tasks) {
                node.tasks = node.tasks.filter(id => id !== task.id);
            }
        }
        
        await this.saveTasks();
        await this.saveNodes();
    }

    // Task Execution Methods

    async executeSpawnInstance(payload) {
        const command = `node scripts/mcp_bridge.js spawn '${JSON.stringify(payload)}'`;
        return await this.execCommand(command);
    }

    async executeRunWorkflow(payload) {
        const command = `node src/workflow/workflow_engine.cjs ${payload.workflowPath}`;
        return await this.execCommand(command);
    }

    async executeHealthCheck(payload) {
        const command = 'npm run health';
        return await this.execCommand(command);
    }

    async executeCleanup(payload) {
        const options = payload.options || '';
        const command = `node scripts/cleanup_instances.cjs ${options}`;
        return await this.execCommand(command);
    }

    async executeBackup(payload) {
        const description = payload.description || 'Distributed backup';
        const command = `node scripts/backup_recovery.cjs backup "${description}"`;
        return await this.execCommand(command);
    }

    async sendHeartbeat() {
        this.nodeInfo.lastHeartbeat = new Date().toISOString();
        
        // Update load metrics
        await this.updateLoadMetrics();
        
        // Save node state
        this.nodes.set(this.nodeId, this.nodeInfo);
        await this.saveNodes();
    }

    async monitorCluster() {
        if (!this.isLeader) return;
        
        const now = Date.now();
        const deadlineMs = this.config.cluster.heartbeatInterval * 3; // 3 missed heartbeats
        
        for (const [nodeId, node] of this.nodes) {
            const lastHeartbeat = new Date(node.lastHeartbeat).getTime();
            const age = now - lastHeartbeat;
            
            if (age > deadlineMs && node.status === 'active') {
                console.log(`⚠️  Node ${nodeId} appears to be down (last heartbeat: ${Math.floor(age/1000)}s ago)`);
                node.status = 'down';
                
                // Reassign tasks from down node
                await this.reassignTasksFromNode(nodeId);
            }
        }
    }

    async reassignTasksFromNode(nodeId) {
        console.log(`🔄 Reassigning tasks from down node: ${nodeId}`);
        
        const tasksToReassign = Array.from(this.tasks.values())
            .filter(task => task.assignedTo === nodeId && task.status === 'running');
        
        for (const task of tasksToReassign) {
            task.status = 'pending';
            task.assignedTo = null;
            task.attempts = Math.max(1, task.attempts - 1); // Don't penalize for node failure
            
            console.log(`   📋 Reassigning task: ${task.id}`);
        }
        
        await this.saveTasks();
    }

    async updateLoadMetrics() {
        try {
            // Get instance count
            const instanceData = await this.loadInstanceState();
            this.nodeInfo.load.instances = Object.keys(instanceData.instances || {}).length;
            
            // Get memory usage (approximate)
            const memInfo = await this.execCommand('vm_stat | grep "Pages free" | awk \'{print $3}\' | tr -d "."');
            const freePages = parseInt(memInfo.trim()) || 0;
            this.nodeInfo.load.memory = Math.max(0, 100 - (freePages * 4096 / (16 * 1024 * 1024 * 1024) * 100));
            
            // Get CPU usage (load average)
            const loadAvg = await this.execCommand('uptime | awk -F"load average:" \'{print $2}\' | awk -F"," \'{print $1}\'');
            this.nodeInfo.load.cpu = Math.min(100, parseFloat(loadAvg.trim()) * 25); // Rough conversion
            
        } catch (error) {
            // Use default values on error
            this.nodeInfo.load = { instances: 0, memory: 0, cpu: 0 };
        }
    }

    async getClusterStatus() {
        const activeNodes = Array.from(this.nodes.values()).filter(n => n.status === 'active');
        const totalTasks = this.tasks.size;
        const runningTasks = Array.from(this.tasks.values()).filter(t => t.status === 'running').length;
        const pendingTasks = Array.from(this.tasks.values()).filter(t => t.status === 'pending').length;
        
        return {
            cluster: this.config.cluster.name,
            nodes: {
                total: this.nodes.size,
                active: activeNodes.length,
                leader: this.isLeader ? this.nodeId : null
            },
            tasks: {
                total: totalTasks,
                running: runningTasks,
                pending: pendingTasks
            },
            load: {
                totalInstances: activeNodes.reduce((sum, n) => sum + n.load.instances, 0),
                averageMemory: activeNodes.reduce((sum, n) => sum + n.load.memory, 0) / activeNodes.length,
                averageCPU: activeNodes.reduce((sum, n) => sum + n.load.cpu, 0) / activeNodes.length
            }
        };
    }

    // Utility Methods

    generateNodeId() {
        const hostname = require('os').hostname();
        const random = crypto.randomBytes(4).toString('hex');
        return `node_${hostname}_${random}`;
    }

    generateTaskId() {
        const timestamp = Date.now().toString(36);
        const random = crypto.randomBytes(4).toString('hex');
        return `task_${timestamp}_${random}`;
    }

    getPriorityWeight(priority) {
        const weights = { high: 3, medium: 2, low: 1 };
        return weights[priority] || 1;
    }

    async getSystemInfo() {
        try {
            return {
                hostname: require('os').hostname(),
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                memory: require('os').totalmem(),
                cpus: require('os').cpus().length
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    async loadConfig() {
        try {
            const configDir = path.dirname(this.configFile);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            
            if (fs.existsSync(this.configFile)) {
                const saved = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
                this.config = { ...this.defaultConfig, ...saved };
            } else {
                this.config = this.defaultConfig;
                await this.saveConfig();
            }
        } catch (error) {
            this.config = this.defaultConfig;
        }
    }

    async saveConfig() {
        fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
    }

    async loadNodes() {
        try {
            if (fs.existsSync(this.nodesFile)) {
                const data = JSON.parse(fs.readFileSync(this.nodesFile, 'utf8'));
                this.nodes = new Map(Object.entries(data));
            }
        } catch (error) {
            this.nodes = new Map();
        }
    }

    async saveNodes() {
        const data = Object.fromEntries(this.nodes);
        const dir = path.dirname(this.nodesFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.nodesFile, JSON.stringify(data, null, 2));
    }

    async loadTasks() {
        try {
            if (fs.existsSync(this.tasksFile)) {
                const data = JSON.parse(fs.readFileSync(this.tasksFile, 'utf8'));
                this.tasks = new Map(Object.entries(data));
            }
        } catch (error) {
            this.tasks = new Map();
        }
    }

    async saveTasks() {
        const data = Object.fromEntries(this.tasks);
        const dir = path.dirname(this.tasksFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.tasksFile, JSON.stringify(data, null, 2));
    }

    async loadInstanceState() {
        try {
            const stateFile = path.join(__dirname, '../state/instances.json');
            return JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        } catch (error) {
            return { instances: {} };
        }
    }

    async execCommand(command) {
        return new Promise((resolve, reject) => {
            const child = spawn('bash', ['-c', command]);
            let output = '';
            
            child.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            child.on('close', (code) => {
                if (code === 0) {
                    resolve(output.trim());
                } else {
                    reject(new Error(`Command failed with code ${code}`));
                }
            });
            
            child.on('error', reject);
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async startServices() {
        // Initialize task queue
        await this.loadTasks();
        
        // Start HTTP server for cluster communication (simplified)
        console.log(`🌐 Starting services on port ${this.config.communication.port}`);
    }
}

// CLI Interface
if (require.main === module) {
    const coordinator = new DistributedCoordinator();
    const args = process.argv.slice(2);
    const command = args[0];
    
    const showHelp = () => {
        console.log('Usage: node distributed_coordinator.cjs <command> [options]');
        console.log('');
        console.log('Commands:');
        console.log('  start                  Start coordinator node');
        console.log('  submit <type> <data>   Submit task to cluster');
        console.log('  status                 Show cluster status');
        console.log('  nodes                  List cluster nodes');
        console.log('  tasks                  List cluster tasks');
        console.log('');
        console.log('Task Types:');
        console.log('  spawn-instance         Spawn Claude instance');
        console.log('  run-workflow          Execute workflow');
        console.log('  health-check          Run health check');
        console.log('  cleanup               Clean stale resources');
        console.log('  backup                Create backup');
        console.log('');
        console.log('Examples:');
        console.log('  node distributed_coordinator.cjs start');
        console.log('  node distributed_coordinator.cjs submit spawn-instance \'{"role":"specialist"}\'');
        console.log('  node distributed_coordinator.cjs status');
    };
    
    (async () => {
        try {
            switch (command) {
                case 'start':
                    await coordinator.start();
                    break;
                    
                case 'submit':
                    if (!args[1] || !args[2]) {
                        console.error('Error: Task type and data required');
                        showHelp();
                        process.exit(1);
                    }
                    await coordinator.loadConfig();
                    await coordinator.loadNodes();
                    await coordinator.loadTasks();
                    
                    const taskId = await coordinator.submitTask({
                        type: args[1],
                        payload: JSON.parse(args[2])
                    });
                    console.log(`Task submitted: ${taskId}`);
                    break;
                    
                case 'status':
                    await coordinator.loadConfig();
                    await coordinator.loadNodes();
                    await coordinator.loadTasks();
                    
                    const status = await coordinator.getClusterStatus();
                    console.log('🌐 Cluster Status');
                    console.log(''.padEnd(40, '='));
                    console.log(`Cluster: ${status.cluster}`);
                    console.log(`Nodes: ${status.nodes.active}/${status.nodes.total} active`);
                    console.log(`Leader: ${status.nodes.leader || 'None'}`);
                    console.log(`Tasks: ${status.tasks.running} running, ${status.tasks.pending} pending`);
                    console.log(`Load: ${status.load.totalInstances} instances, ${status.load.averageMemory.toFixed(1)}% memory`);
                    break;
                    
                case 'nodes':
                    await coordinator.loadNodes();
                    console.log('🖥️  Cluster Nodes');
                    console.log(''.padEnd(60, '='));
                    for (const [id, node] of coordinator.nodes) {
                        console.log(`${id}:`);
                        console.log(`   Status: ${node.status}`);
                        console.log(`   Role: ${node.role}`);
                        console.log(`   Load: ${node.load.instances} instances, ${node.load.memory.toFixed(1)}% memory`);
                        console.log(`   Last Heartbeat: ${new Date(node.lastHeartbeat).toLocaleString()}`);
                        console.log('');
                    }
                    break;
                    
                case 'tasks':
                    await coordinator.loadTasks();
                    console.log('📋 Cluster Tasks');
                    console.log(''.padEnd(60, '='));
                    for (const [id, task] of coordinator.tasks) {
                        console.log(`${id}:`);
                        console.log(`   Type: ${task.type}`);
                        console.log(`   Status: ${task.status}`);
                        console.log(`   Assigned: ${task.assignedTo || 'None'}`);
                        console.log(`   Submitted: ${new Date(task.submitted).toLocaleString()}`);
                        console.log('');
                    }
                    break;
                    
                default:
                    showHelp();
                    process.exit(command ? 1 : 0);
            }
        } catch (error) {
            console.error('Coordinator Error:', error.message);
            process.exit(1);
        }
    })();
}

module.exports = DistributedCoordinator;