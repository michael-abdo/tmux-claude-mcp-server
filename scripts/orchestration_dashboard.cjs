#!/usr/bin/env node

/**
 * Interactive Orchestration Dashboard for Claude Code Platform
 * Real-time monitoring and control of all Claude instances
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

class OrchestrationDashboard {
    constructor() {
        this.stateFile = path.join(__dirname, '../state/instances.json');
        this.refreshInterval = 2000; // 2 seconds
        this.selectedInstance = null;
        this.viewMode = 'overview'; // overview, details, logs, control
        this.isRunning = false;
        this.commands = [];
        
        // Setup readline interface
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        // Non-blocking input
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
    }

    async start() {
        console.log('🎮 Claude Orchestration Dashboard');
        console.log('Press ? for help, q to quit');
        console.log('');
        
        this.isRunning = true;
        
        // Handle keyboard input
        process.stdin.on('data', (key) => this.handleKeypress(key));
        
        // Main display loop
        while (this.isRunning) {
            await this.render();
            await this.sleep(this.refreshInterval);
        }
        
        this.cleanup();
    }

    async render() {
        console.clear();
        
        // Header
        console.log('🎮 Claude Orchestration Dashboard');
        console.log(''.padEnd(80, '='));
        
        // Display based on view mode
        switch (this.viewMode) {
            case 'overview':
                await this.renderOverview();
                break;
            case 'details':
                await this.renderDetails();
                break;
            case 'logs':
                await this.renderLogs();
                break;
            case 'control':
                await this.renderControl();
                break;
        }
        
        // Footer
        this.renderFooter();
    }

    async renderOverview() {
        const instances = await this.loadInstances();
        const stats = this.calculateStats(instances);
        
        // Summary Stats
        console.log('📊 System Overview');
        console.log(`   Total Instances: ${stats.total}`);
        console.log(`   Active: ${stats.active} | Initializing: ${stats.initializing} | Failed: ${stats.failed}`);
        console.log(`   Specialists: ${stats.specialists} | Managers: ${stats.managers} | Executives: ${stats.executives}`);
        console.log('');
        
        // Instance Table
        console.log('🤖 Active Instances:');
        console.log(''.padEnd(80, '-'));
        console.log('ID'.padEnd(20) + 'Role'.padEnd(12) + 'Status'.padEnd(15) + 'Age'.padEnd(10) + 'Branch');
        console.log(''.padEnd(80, '-'));
        
        const sortedInstances = Object.entries(instances)
            .sort(([,a], [,b]) => new Date(b.created) - new Date(a.created))
            .slice(0, 15); // Show top 15
        
        sortedInstances.forEach(([id, instance], index) => {
            const age = this.getAge(instance.created);
            const branch = instance.branchName || 'N/A';
            const row = id.padEnd(20) + 
                       instance.role.padEnd(12) + 
                       this.getStatusIcon(instance.status).padEnd(15) + 
                       age.padEnd(10) + 
                       branch.substring(0, 30);
            
            if (index === this.selectedInstance) {
                console.log(`> ${row} <`);
            } else {
                console.log(`  ${row}`);
            }
        });
        
        if (instances.length === 0) {
            console.log('  No active instances');
        }
        
        console.log('');
        
        // System Health
        await this.renderHealthSummary();
    }

    async renderDetails() {
        const instances = await this.loadInstances();
        const instanceList = Object.entries(instances);
        
        if (this.selectedInstance === null || this.selectedInstance >= instanceList.length) {
            console.log('⚠️  No instance selected. Press arrow keys to select.');
            return;
        }
        
        const [id, instance] = instanceList[this.selectedInstance];
        
        console.log('📋 Instance Details');
        console.log(''.padEnd(80, '-'));
        console.log(`ID: ${id}`);
        console.log(`Role: ${instance.role}`);
        console.log(`Status: ${this.getStatusIcon(instance.status)}`);
        console.log(`Created: ${new Date(instance.created).toLocaleString()}`);
        console.log(`Age: ${this.getAge(instance.created)}`);
        console.log('');
        
        console.log('Configuration:');
        console.log(`  Session: ${instance.sessionName}`);
        console.log(`  Project Dir: ${instance.projectDir}`);
        console.log(`  Work Dir: ${instance.workDir}`);
        console.log(`  Branch: ${instance.branchName || 'None'}`);
        console.log(`  Is Worktree: ${instance.isWorktree ? 'Yes' : 'No'}`);
        console.log(`  Git Enabled: ${instance.gitEnabled ? 'Yes' : 'No'}`);
        console.log('');
        
        // Check if session is alive
        const sessionAlive = await this.checkSessionAlive(instance.sessionName);
        console.log('Session Status:');
        console.log(`  Tmux Session: ${sessionAlive ? '🟢 Active' : '🔴 Dead'}`);
        console.log(`  Pane Target: ${instance.paneTarget}`);
        
        // Show recent output if available
        if (sessionAlive) {
            console.log('');
            console.log('Recent Output:');
            console.log(''.padEnd(80, '-'));
            const output = await this.getInstanceOutput(instance);
            console.log(output || '  No recent output');
        }
    }

    async renderLogs() {
        console.log('📜 System Logs');
        console.log(''.padEnd(80, '-'));
        
        // Show recent logs from various sources
        const logs = await this.gatherLogs();
        
        logs.forEach(log => {
            const timestamp = new Date(log.timestamp).toLocaleTimeString();
            const level = this.getLevelIcon(log.level);
            console.log(`${timestamp} ${level} ${log.message}`);
        });
        
        if (logs.length === 0) {
            console.log('No recent logs available');
        }
    }

    async renderControl() {
        const instances = await this.loadInstances();
        const instanceList = Object.entries(instances);
        
        console.log('🎛️  Control Panel');
        console.log(''.padEnd(80, '-'));
        
        if (this.selectedInstance !== null && this.selectedInstance < instanceList.length) {
            const [id, instance] = instanceList[this.selectedInstance];
            console.log(`Selected: ${id} (${instance.role})`);
            console.log('');
            console.log('Available Actions:');
            console.log('  1. Send Message');
            console.log('  2. View Full Output');
            console.log('  3. Restart Instance');
            console.log('  4. Terminate Instance');
            console.log('  5. Create Worktree');
            console.log('  6. Run Workflow');
            console.log('');
            console.log('Press number to execute action, ESC to go back');
        } else {
            console.log('Select an instance first (use arrow keys in overview)');
        }
        
        // Show command history
        if (this.commands.length > 0) {
            console.log('');
            console.log('Recent Commands:');
            this.commands.slice(-5).forEach(cmd => {
                console.log(`  • ${cmd.timestamp}: ${cmd.action} on ${cmd.instance}`);
            });
        }
    }

    async renderHealthSummary() {
        console.log('💚 System Health:');
        
        try {
            // Quick health checks
            const tmuxSessions = await this.execCommand('tmux list-sessions 2>/dev/null | wc -l || echo "0"');
            const gitStatus = await this.execCommand('git status --porcelain | wc -l || echo "0"');
            const diskUsage = await this.execCommand('df -h . | tail -1 | awk \'{print $5}\'');
            
            console.log(`  Tmux Sessions: ${tmuxSessions.trim()}`);
            console.log(`  Git Changes: ${gitStatus.trim()}`);
            console.log(`  Disk Usage: ${diskUsage.trim()}`);
        } catch (error) {
            console.log('  ⚠️  Could not fetch health data');
        }
    }

    renderFooter() {
        console.log('');
        console.log(''.padEnd(80, '-'));
        
        const modeIndicators = {
            overview: '[O]verview',
            details: '[D]etails',
            logs: '[L]ogs',
            control: '[C]ontrol'
        };
        
        const modes = Object.entries(modeIndicators).map(([mode, label]) => 
            mode === this.viewMode ? `*${label}*` : label
        ).join(' | ');
        
        console.log(modes);
        console.log('↑↓ Navigate | Enter Select | [?] Help | [Q] Quit');
    }

    async handleKeypress(key) {
        // Handle special keys
        if (key === '\u0003' || key === 'q' || key === 'Q') { // Ctrl+C or Q
            this.isRunning = false;
            return;
        }
        
        // View mode switching
        switch (key.toLowerCase()) {
            case 'o':
                this.viewMode = 'overview';
                break;
            case 'd':
                this.viewMode = 'details';
                break;
            case 'l':
                this.viewMode = 'logs';
                break;
            case 'c':
                this.viewMode = 'control';
                break;
            case '?':
                await this.showHelp();
                break;
        }
        
        // Navigation in overview
        if (this.viewMode === 'overview') {
            const instances = await this.loadInstances();
            const maxIndex = Object.keys(instances).length - 1;
            
            if (key === '\u001b[A') { // Up arrow
                if (this.selectedInstance === null) {
                    this.selectedInstance = 0;
                } else if (this.selectedInstance > 0) {
                    this.selectedInstance--;
                }
            } else if (key === '\u001b[B') { // Down arrow
                if (this.selectedInstance === null) {
                    this.selectedInstance = 0;
                } else if (this.selectedInstance < maxIndex) {
                    this.selectedInstance++;
                }
            } else if (key === '\r') { // Enter
                this.viewMode = 'details';
            }
        }
        
        // Control panel actions
        if (this.viewMode === 'control') {
            if (key >= '1' && key <= '6') {
                await this.executeAction(parseInt(key));
            } else if (key === '\u001b') { // ESC
                this.viewMode = 'overview';
            }
        }
    }

    async executeAction(action) {
        const instances = await this.loadInstances();
        const instanceList = Object.entries(instances);
        
        if (this.selectedInstance === null || this.selectedInstance >= instanceList.length) {
            return;
        }
        
        const [id, instance] = instanceList[this.selectedInstance];
        
        console.log(`\nExecuting action ${action} on ${id}...`);
        
        try {
            switch (action) {
                case 1: // Send Message
                    await this.sendMessage(id);
                    break;
                case 2: // View Full Output
                    await this.viewFullOutput(instance);
                    break;
                case 3: // Restart Instance
                    await this.restartInstance(id, instance);
                    break;
                case 4: // Terminate Instance
                    await this.terminateInstance(id);
                    break;
                case 5: // Create Worktree
                    console.log('Creating worktree... (not implemented)');
                    break;
                case 6: // Run Workflow
                    console.log('Running workflow... (not implemented)');
                    break;
            }
            
            this.commands.push({
                timestamp: new Date().toLocaleTimeString(),
                action: this.getActionName(action),
                instance: id
            });
            
        } catch (error) {
            console.error(`Action failed: ${error.message}`);
        }
        
        await this.sleep(2000);
    }

    async sendMessage(instanceId) {
        // In a real implementation, this would use the MCP bridge
        console.log(`Sending message to ${instanceId}...`);
        const cmd = `node scripts/mcp_bridge.js send '{"instanceId": "${instanceId}", "text": "Hello from dashboard!"}'`;
        await this.execCommand(cmd);
    }

    async viewFullOutput(instance) {
        const output = await this.execCommand(
            `tmux capture-pane -t ${instance.paneTarget} -p -S -100 2>/dev/null || echo "No output available"`
        );
        console.log('\nFull Output:');
        console.log(''.padEnd(80, '-'));
        console.log(output);
        console.log(''.padEnd(80, '-'));
        console.log('Press any key to continue...');
        await this.waitForKey();
    }

    async restartInstance(id, instance) {
        console.log(`Restarting ${id}...`);
        // Implementation would restart the Claude instance
        console.log('Restart functionality not yet implemented');
    }

    async terminateInstance(id) {
        console.log(`Terminating ${id}...`);
        const cmd = `node scripts/mcp_bridge.js terminate '{"instanceId": "${id}"}'`;
        await this.execCommand(cmd);
    }

    // Utility Methods

    async loadInstances() {
        try {
            const data = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
            return data.instances || {};
        } catch (error) {
            return {};
        }
    }

    calculateStats(instances) {
        const instanceList = Object.values(instances);
        return {
            total: instanceList.length,
            active: instanceList.filter(i => i.status === 'active').length,
            initializing: instanceList.filter(i => i.status === 'initializing').length,
            failed: instanceList.filter(i => i.status === 'failed').length,
            specialists: instanceList.filter(i => i.role === 'specialist').length,
            managers: instanceList.filter(i => i.role === 'manager').length,
            executives: instanceList.filter(i => i.role === 'executive').length
        };
    }

    getAge(created) {
        const diff = Date.now() - new Date(created).getTime();
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d`;
        if (hours > 0) return `${hours}h`;
        return `${minutes}m`;
    }

    getStatusIcon(status) {
        const icons = {
            active: '🟢 Active',
            initializing: '🟡 Starting',
            failed: '🔴 Failed',
            terminated: '⚫ Terminated'
        };
        return icons[status] || `❓ ${status}`;
    }

    getLevelIcon(level) {
        const icons = {
            info: 'ℹ️ ',
            success: '✅',
            warning: '⚠️ ',
            error: '❌'
        };
        return icons[level] || '📝';
    }

    getActionName(action) {
        const actions = {
            1: 'Send Message',
            2: 'View Output',
            3: 'Restart',
            4: 'Terminate',
            5: 'Create Worktree',
            6: 'Run Workflow'
        };
        return actions[action] || 'Unknown';
    }

    async checkSessionAlive(sessionName) {
        try {
            const result = await this.execCommand(
                `tmux has-session -t ${sessionName} 2>/dev/null && echo "alive" || echo "dead"`
            );
            return result.trim() === 'alive';
        } catch (error) {
            return false;
        }
    }

    async getInstanceOutput(instance) {
        try {
            const output = await this.execCommand(
                `tmux capture-pane -t ${instance.paneTarget} -p -S -10 2>/dev/null`
            );
            return output.trim().split('\n').slice(-5).join('\n');
        } catch (error) {
            return null;
        }
    }

    async gatherLogs() {
        const logs = [];
        
        try {
            // Read recent maintenance log
            const maintenanceLog = path.join(__dirname, '../logs/maintenance.log');
            if (fs.existsSync(maintenanceLog)) {
                const content = fs.readFileSync(maintenanceLog, 'utf8');
                const lines = content.trim().split('\n').slice(-10);
                
                lines.forEach(line => {
                    try {
                        const entry = JSON.parse(line);
                        logs.push(entry);
                    } catch (e) {
                        // Skip invalid JSON
                    }
                });
            }
        } catch (error) {
            // Ignore log reading errors
        }
        
        return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);
    }

    async showHelp() {
        console.clear();
        console.log('🎮 Orchestration Dashboard Help');
        console.log(''.padEnd(80, '='));
        console.log('');
        console.log('Navigation:');
        console.log('  ↑/↓        Navigate through instances');
        console.log('  Enter      Select instance for details');
        console.log('  O          Switch to Overview mode');
        console.log('  D          Switch to Details mode');
        console.log('  L          Switch to Logs mode');
        console.log('  C          Switch to Control mode');
        console.log('');
        console.log('Control Mode Actions:');
        console.log('  1          Send message to instance');
        console.log('  2          View full output');
        console.log('  3          Restart instance');
        console.log('  4          Terminate instance');
        console.log('  5          Create worktree');
        console.log('  6          Run workflow');
        console.log('');
        console.log('General:');
        console.log('  ?          Show this help');
        console.log('  Q          Quit dashboard');
        console.log('');
        console.log('Press any key to continue...');
        
        await this.waitForKey();
    }

    async waitForKey() {
        return new Promise(resolve => {
            const handler = () => {
                process.stdin.removeListener('data', handler);
                resolve();
            };
            process.stdin.once('data', handler);
        });
    }

    async execCommand(command) {
        return new Promise((resolve, reject) => {
            const child = spawn('bash', ['-c', command]);
            let output = '';
            
            child.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            child.on('close', (code) => {
                resolve(output);
            });
            
            child.on('error', (error) => {
                reject(error);
            });
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    cleanup() {
        this.rl.close();
        process.stdin.setRawMode(false);
        process.stdin.pause();
        console.clear();
        console.log('👋 Dashboard closed');
    }
}

// Start dashboard
if (require.main === module) {
    const dashboard = new OrchestrationDashboard();
    
    dashboard.start().catch(error => {
        console.error('Dashboard error:', error);
        process.exit(1);
    });
}

module.exports = OrchestrationDashboard;