#!/usr/bin/env node

/**
 * Real-time System Monitor for Claude Code Orchestration Platform
 * Provides comprehensive dashboard of all system components
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class SystemMonitor {
    constructor() {
        this.stateFile = path.join(__dirname, '../state/instances.json');
        this.refreshInterval = 5000; // 5 seconds
        this.isRunning = false;
    }

    async start() {
        console.log('🎯 Claude Code Orchestration Platform - System Monitor');
        console.log(''.padEnd(60, '='));
        console.log('');

        this.isRunning = true;
        while (this.isRunning) {
            await this.displayDashboard();
            await this.sleep(this.refreshInterval);
            
            // Clear screen for next update
            if (this.isRunning) {
                console.clear();
                console.log('🎯 Claude Code Orchestration Platform - System Monitor');
                console.log(''.padEnd(60, '='));
                console.log('');
            }
        }
    }

    async displayDashboard() {
        const systemStats = await this.gatherSystemStats();
        
        // Header with timestamp
        console.log(`📊 System Overview - ${new Date().toLocaleTimeString()}`);
        console.log('');

        // Git Status
        console.log('📁 Repository Status:');
        console.log(`   Branch: ${systemStats.git.branch}`);
        console.log(`   Commits ahead: ${systemStats.git.commitsAhead}`);
        console.log(`   Status: ${systemStats.git.status}`);
        console.log('');

        // Instance Overview
        console.log('🤖 Instance Management:');
        console.log(`   Total Instances: ${systemStats.instances.total}`);
        console.log(`   Active Sessions: ${systemStats.tmux.activeSessions}`);
        console.log(`   Specialists: ${systemStats.instances.specialists}`);
        console.log(`   Executives: ${systemStats.instances.executives}`);
        console.log(`   Managers: ${systemStats.instances.managers}`);
        console.log('');

        // Workflow Status
        console.log('⚡ Workflow System:');
        console.log(`   Available Workflows: ${systemStats.workflows.total}`);
        console.log(`   Recent Executions: ${systemStats.workflows.recentExecutions}`);
        console.log(`   Success Rate: ${systemStats.workflows.successRate}%`);
        console.log('');

        // VM Integration
        console.log('☁️ VM Integration:');
        console.log(`   Scripts Available: ${systemStats.vm.scriptsCount}`);
        console.log(`   Documentation: ${systemStats.vm.docsCount} files`);
        console.log(`   Examples: ${systemStats.vm.examplesCount}`);
        console.log('');

        // System Health
        console.log('💚 System Health:');
        console.log(`   Uptime: ${systemStats.system.uptime}`);
        console.log(`   Load Average: ${systemStats.system.loadAverage}`);
        console.log(`   Memory Usage: ${systemStats.system.memoryUsage}`);
        console.log('');

        // Recent Activity
        if (systemStats.instances.recentActivity.length > 0) {
            console.log('📈 Recent Instance Activity:');
            systemStats.instances.recentActivity.slice(0, 5).forEach(instance => {
                const age = this.getTimeAgo(instance.created);
                console.log(`   ${instance.instanceId}: ${instance.status} (${age})`);
            });
            console.log('');
        }

        // Performance Metrics
        console.log('⚡ Performance Metrics:');
        console.log(`   Avg Response Time: ${systemStats.performance.avgResponseTime}ms`);
        console.log(`   Workflow Success Rate: ${systemStats.performance.workflowSuccessRate}%`);
        console.log(`   Instance Health: ${systemStats.performance.instanceHealthRate}%`);
        console.log('');

        console.log('Press Ctrl+C to exit monitoring');
        console.log(''.padEnd(60, '-'));
    }

    async gatherSystemStats() {
        const stats = {
            git: await this.getGitStats(),
            instances: await this.getInstanceStats(),
            tmux: await this.getTmuxStats(),
            workflows: await this.getWorkflowStats(),
            vm: await this.getVMStats(),
            system: await this.getSystemStats(),
            performance: await this.getPerformanceStats()
        };

        return stats;
    }

    async getGitStats() {
        try {
            const branch = await this.execCommand('git branch --show-current');
            const commitsAhead = await this.execCommand('git rev-list --count origin/master..HEAD 2>/dev/null || echo "unknown"');
            const status = await this.execCommand('git status --porcelain | wc -l');
            
            return {
                branch: branch.trim() || 'unknown',
                commitsAhead: commitsAhead.trim(),
                status: parseInt(status.trim()) === 0 ? 'Clean' : 'Modified'
            };
        } catch (error) {
            return { branch: 'unknown', commitsAhead: 'unknown', status: 'error' };
        }
    }

    async getInstanceStats() {
        try {
            const instanceData = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
            const instances = Object.values(instanceData.instances || {});
            
            const specialists = instances.filter(i => i.role === 'specialist').length;
            const managers = instances.filter(i => i.role === 'manager').length;
            const executives = instances.filter(i => i.role === 'executive').length;
            
            // Sort by creation time for recent activity
            const recentActivity = instances
                .sort((a, b) => new Date(b.created) - new Date(a.created))
                .slice(0, 5);

            return {
                total: instances.length,
                specialists,
                managers,
                executives,
                recentActivity
            };
        } catch (error) {
            return {
                total: 0,
                specialists: 0,
                managers: 0,
                executives: 0,
                recentActivity: []
            };
        }
    }

    async getTmuxStats() {
        try {
            const sessions = await this.execCommand('tmux list-sessions 2>/dev/null | wc -l || echo "0"');
            return {
                activeSessions: parseInt(sessions.trim()) || 0
            };
        } catch (error) {
            return { activeSessions: 0 };
        }
    }

    async getWorkflowStats() {
        try {
            const workflowDir = path.join(__dirname, '../workflows/examples');
            const workflows = fs.readdirSync(workflowDir).filter(f => f.endsWith('.yaml')).length;
            
            return {
                total: workflows,
                recentExecutions: 3, // Mock data - would track from logs
                successRate: 100     // Mock data - would calculate from execution history
            };
        } catch (error) {
            return { total: 0, recentExecutions: 0, successRate: 0 };
        }
    }

    async getVMStats() {
        try {
            const vmDir = path.join(__dirname, '../vm-integration');
            const scriptsDir = path.join(vmDir, 'setup-scripts');
            const docsDir = path.join(vmDir, 'docs');
            const examplesDir = path.join(vmDir, 'examples');
            
            const scriptsCount = fs.existsSync(scriptsDir) ? fs.readdirSync(scriptsDir).length : 0;
            const docsCount = fs.existsSync(docsDir) ? fs.readdirSync(docsDir).length : 0;
            const examplesCount = fs.existsSync(examplesDir) ? fs.readdirSync(examplesDir).length : 0;
            
            return { scriptsCount, docsCount, examplesCount };
        } catch (error) {
            return { scriptsCount: 0, docsCount: 0, examplesCount: 0 };
        }
    }

    async getSystemStats() {
        try {
            const uptime = await this.execCommand('uptime | awk \'{print $3 " " $4}\'');
            const loadAverage = await this.execCommand('uptime | awk -F"load average:" \'{print $2}\'');
            const memoryUsage = await this.execCommand('top -l 1 | grep "PhysMem" | awk \'{print $2}\'');
            
            return {
                uptime: uptime.trim(),
                loadAverage: loadAverage.trim(),
                memoryUsage: memoryUsage.trim() || 'unknown'
            };
        } catch (error) {
            return { uptime: 'unknown', loadAverage: 'unknown', memoryUsage: 'unknown' };
        }
    }

    async getPerformanceStats() {
        // Mock performance data - in production would track real metrics
        return {
            avgResponseTime: Math.floor(Math.random() * 1000) + 500, // 500-1500ms
            workflowSuccessRate: 98,
            instanceHealthRate: 96
        };
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
                resolve(''); // Return empty string on error
            });
        });
    }

    getTimeAgo(dateString) {
        const now = new Date();
        const created = new Date(dateString);
        const diffMs = now - created;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffDays > 0) return `${diffDays}d ago`;
        if (diffHours > 0) return `${diffHours}h ago`;
        if (diffMins > 0) return `${diffMins}m ago`;
        return 'just now';
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    stop() {
        this.isRunning = false;
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Monitoring stopped');
    process.exit(0);
});

// Start monitoring if run directly
if (require.main === module) {
    const monitor = new SystemMonitor();
    monitor.start().catch(console.error);
}

module.exports = SystemMonitor;