#!/usr/bin/env node

/**
 * Automated Health Check System for Claude Code Orchestration Platform
 * Continuously monitors system health and alerts on issues
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class HealthMonitor {
    constructor() {
        this.stateFile = path.join(__dirname, '../state/instances.json');
        this.healthLog = path.join(__dirname, '../logs/health_status.json');
        this.checkInterval = 60000; // 1 minute
        this.isRunning = false;
        
        this.healthChecks = {
            git: { status: 'unknown', lastCheck: null, issues: [] },
            instances: { status: 'unknown', lastCheck: null, issues: [] },
            tmux: { status: 'unknown', lastCheck: null, issues: [] },
            filesystem: { status: 'unknown', lastCheck: null, issues: [] },
            memory: { status: 'unknown', lastCheck: null, issues: [] },
            workflows: { status: 'unknown', lastCheck: null, issues: [] }
        };
        
        this.thresholds = {
            maxInstances: 30,
            minFreeMemory: 20, // percentage
            maxLoadAverage: 4.0,
            maxStaleInstances: 5,
            maxSessionAge: 7200000, // 2 hours
            minDiskSpace: 10 // percentage
        };
    }

    async start(options = {}) {
        console.log('🏥 Health Monitor Starting...');
        console.log(''.padEnd(60, '='));
        
        this.checkInterval = options.interval || this.checkInterval;
        const runOnce = options.once || false;
        
        this.isRunning = true;
        
        while (this.isRunning) {
            await this.performHealthChecks();
            await this.displayHealthStatus();
            await this.saveHealthLog();
            
            if (runOnce) {
                break;
            }
            
            console.log(`\n⏰ Next check in ${this.checkInterval / 1000} seconds...`);
            await this.sleep(this.checkInterval);
            
            if (this.isRunning) {
                console.clear();
            }
        }
    }

    async performHealthChecks() {
        console.log('🔍 Performing health checks...\n');
        
        await Promise.all([
            this.checkGitHealth(),
            this.checkInstanceHealth(),
            this.checkTmuxHealth(),
            this.checkFilesystemHealth(),
            this.checkMemoryHealth(),
            this.checkWorkflowHealth()
        ]);
    }

    async checkGitHealth() {
        const check = this.healthChecks.git;
        check.issues = [];
        check.lastCheck = new Date().toISOString();
        
        try {
            // Check repository integrity
            const fsck = await this.execCommand('git fsck --no-progress 2>&1 | grep -E "(error|missing)" | wc -l');
            const errors = parseInt(fsck.trim()) || 0;
            
            if (errors > 0) {
                check.issues.push(`Git repository has ${errors} integrity issues`);
            }
            
            // Check for uncommitted changes
            const changes = await this.execCommand('git status --porcelain | wc -l');
            const changeCount = parseInt(changes.trim()) || 0;
            
            if (changeCount > 20) {
                check.issues.push(`High number of uncommitted changes (${changeCount})`);
            }
            
            // Check remote connectivity
            const remoteCheck = await this.execCommand('git ls-remote --heads origin 2>&1 | grep -c "refs/heads" || echo "0"');
            if (parseInt(remoteCheck.trim()) === 0) {
                check.issues.push('Cannot connect to remote repository');
            }
            
            check.status = check.issues.length === 0 ? 'healthy' : 
                          check.issues.length <= 1 ? 'warning' : 'critical';
                          
        } catch (error) {
            check.status = 'error';
            check.issues.push(`Health check failed: ${error.message}`);
        }
    }

    async checkInstanceHealth() {
        const check = this.healthChecks.instances;
        check.issues = [];
        check.lastCheck = new Date().toISOString();
        
        try {
            const data = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
            const instances = Object.values(data.instances || {});
            
            // Check total instance count
            if (instances.length > this.thresholds.maxInstances) {
                check.issues.push(`Too many instances (${instances.length}/${this.thresholds.maxInstances})`);
            }
            
            // Check for stale instances
            const now = Date.now();
            const staleInstances = instances.filter(inst => {
                const age = now - new Date(inst.created).getTime();
                return age > this.thresholds.maxSessionAge;
            });
            
            if (staleInstances.length > this.thresholds.maxStaleInstances) {
                check.issues.push(`Too many stale instances (${staleInstances.length})`);
            }
            
            // Check for stuck initializing instances
            const initializingCount = instances.filter(i => i.status === 'initializing').length;
            if (initializingCount > 3) {
                check.issues.push(`${initializingCount} instances stuck in initializing state`);
            }
            
            // Check instance distribution
            const roleCount = {
                specialist: instances.filter(i => i.role === 'specialist').length,
                manager: instances.filter(i => i.role === 'manager').length,
                executive: instances.filter(i => i.role === 'executive').length
            };
            
            if (roleCount.specialist > 20 && roleCount.manager === 0) {
                check.issues.push('Many specialists but no managers - consider hierarchical organization');
            }
            
            check.status = check.issues.length === 0 ? 'healthy' : 
                          check.issues.length <= 1 ? 'warning' : 'critical';
                          
        } catch (error) {
            check.status = 'error';
            check.issues.push(`Health check failed: ${error.message}`);
        }
    }

    async checkTmuxHealth() {
        const check = this.healthChecks.tmux;
        check.issues = [];
        check.lastCheck = new Date().toISOString();
        
        try {
            // Check tmux server
            const serverCheck = await this.execCommand('tmux info 2>&1 | grep -q "server" && echo "running" || echo "stopped"');
            if (serverCheck.trim() === 'stopped') {
                check.issues.push('Tmux server not running');
                check.status = 'critical';
                return;
            }
            
            // Check session count vs instance count
            const sessionCount = await this.execCommand('tmux list-sessions 2>/dev/null | wc -l || echo "0"');
            const sessions = parseInt(sessionCount.trim()) || 0;
            
            const data = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
            const instanceCount = Object.keys(data.instances || {}).length;
            
            if (Math.abs(sessions - instanceCount) > 5) {
                check.issues.push(`Session/instance mismatch (${sessions} sessions, ${instanceCount} instances)`);
            }
            
            // Check for zombie sessions
            const zombieSessions = await this.execCommand(
                'tmux list-sessions -F "#{session_name} #{session_created}" 2>/dev/null | ' +
                'awk \'{ if (systime() - $2 > 7200) print $1 }\' | wc -l || echo "0"'
            );
            const zombieCount = parseInt(zombieSessions.trim()) || 0;
            
            if (zombieCount > 0) {
                check.issues.push(`${zombieCount} potential zombie sessions detected`);
            }
            
            check.status = check.issues.length === 0 ? 'healthy' : 
                          check.issues.length <= 1 ? 'warning' : 'critical';
                          
        } catch (error) {
            check.status = 'error';
            check.issues.push(`Health check failed: ${error.message}`);
        }
    }

    async checkFilesystemHealth() {
        const check = this.healthChecks.filesystem;
        check.issues = [];
        check.lastCheck = new Date().toISOString();
        
        try {
            // Check disk space
            const diskUsage = await this.execCommand('df -h . | tail -1 | awk \'{print $5}\' | tr -d "%"');
            const usage = parseInt(diskUsage.trim()) || 0;
            
            if (usage > (100 - this.thresholds.minDiskSpace)) {
                check.issues.push(`Low disk space (${usage}% used)`);
            }
            
            // Check critical directories
            const criticalDirs = ['src', 'scripts', 'state', 'workflows'];
            for (const dir of criticalDirs) {
                const exists = fs.existsSync(path.join(__dirname, '..', dir));
                if (!exists) {
                    check.issues.push(`Missing critical directory: ${dir}`);
                }
            }
            
            // Check worktree proliferation
            const worktreeCount = await this.execCommand('find . -name "*-worktrees" -type d 2>/dev/null | wc -l');
            const worktrees = parseInt(worktreeCount.trim()) || 0;
            
            if (worktrees > 10) {
                check.issues.push(`High worktree count (${worktrees}) - consider cleanup`);
            }
            
            // Check file handle usage
            const openFiles = await this.execCommand('lsof 2>/dev/null | grep -c "node" || echo "0"');
            const fileHandles = parseInt(openFiles.trim()) || 0;
            
            if (fileHandles > 1000) {
                check.issues.push(`High file handle usage (${fileHandles})`);
            }
            
            check.status = check.issues.length === 0 ? 'healthy' : 
                          check.issues.length <= 1 ? 'warning' : 'critical';
                          
        } catch (error) {
            check.status = 'error';
            check.issues.push(`Health check failed: ${error.message}`);
        }
    }

    async checkMemoryHealth() {
        const check = this.healthChecks.memory;
        check.issues = [];
        check.lastCheck = new Date().toISOString();
        
        try {
            // Check system load
            const loadAvg = await this.execCommand('uptime | awk -F"load average:" \'{print $2}\' | awk -F"," \'{print $1}\'');
            const load = parseFloat(loadAvg.trim()) || 0;
            
            if (load > this.thresholds.maxLoadAverage) {
                check.issues.push(`High system load (${load.toFixed(2)})`);
            }
            
            // Check memory pressure (macOS specific)
            const memPressure = await this.execCommand('vm_stat | grep "Pages free" | awk \'{print $3}\' | tr -d "."');
            const freePages = parseInt(memPressure.trim()) || 0;
            const freeMemoryPercent = (freePages * 4096) / (16 * 1024 * 1024 * 1024) * 100; // Assuming 16GB RAM
            
            if (freeMemoryPercent < this.thresholds.minFreeMemory) {
                check.issues.push(`Low free memory (${freeMemoryPercent.toFixed(1)}%)`);
            }
            
            // Check swap usage
            const swapUsage = await this.execCommand('sysctl vm.swapusage 2>/dev/null | awk \'{print $7}\' | tr -d "M" || echo "0"');
            const swapMB = parseInt(swapUsage.trim()) || 0;
            
            if (swapMB > 1000) {
                check.issues.push(`High swap usage (${swapMB}MB)`);
            }
            
            check.status = check.issues.length === 0 ? 'healthy' : 
                          check.issues.length <= 1 ? 'warning' : 'critical';
                          
        } catch (error) {
            check.status = 'error';
            check.issues.push(`Health check failed: ${error.message}`);
        }
    }

    async checkWorkflowHealth() {
        const check = this.healthChecks.workflows;
        check.issues = [];
        check.lastCheck = new Date().toISOString();
        
        try {
            const workflowDir = path.join(__dirname, '../workflows/examples');
            
            // Check workflow directory
            if (!fs.existsSync(workflowDir)) {
                check.issues.push('Workflow directory not found');
                check.status = 'critical';
                return;
            }
            
            // Check workflow files
            const workflowFiles = fs.readdirSync(workflowDir).filter(f => f.endsWith('.yaml'));
            
            if (workflowFiles.length === 0) {
                check.issues.push('No workflow files found');
            }
            
            // Validate workflow syntax (basic check)
            let invalidWorkflows = 0;
            for (const file of workflowFiles.slice(0, 5)) { // Check first 5
                try {
                    const content = fs.readFileSync(path.join(workflowDir, file), 'utf8');
                    if (!content.includes('stages:') || !content.includes('name:')) {
                        invalidWorkflows++;
                    }
                } catch (e) {
                    invalidWorkflows++;
                }
            }
            
            if (invalidWorkflows > 0) {
                check.issues.push(`${invalidWorkflows} workflows have invalid syntax`);
            }
            
            // Check workflow engine
            const enginePath = path.join(__dirname, '../src/workflow/workflow_engine.cjs');
            if (!fs.existsSync(enginePath)) {
                check.issues.push('Workflow engine not found');
            }
            
            check.status = check.issues.length === 0 ? 'healthy' : 
                          check.issues.length <= 1 ? 'warning' : 'critical';
                          
        } catch (error) {
            check.status = 'error';
            check.issues.push(`Health check failed: ${error.message}`);
        }
    }

    async displayHealthStatus() {
        console.clear();
        console.log('🏥 System Health Status');
        console.log(''.padEnd(60, '='));
        console.log(`Last Update: ${new Date().toLocaleTimeString()}`);
        console.log('');
        
        // Calculate overall health
        const statuses = Object.values(this.healthChecks).map(c => c.status);
        const criticalCount = statuses.filter(s => s === 'critical').length;
        const warningCount = statuses.filter(s => s === 'warning').length;
        const healthyCount = statuses.filter(s => s === 'healthy').length;
        
        let overallStatus = 'healthy';
        if (criticalCount > 0) overallStatus = 'critical';
        else if (warningCount > 2) overallStatus = 'warning';
        
        const statusIcon = {
            healthy: '🟢',
            warning: '🟡',
            critical: '🔴',
            error: '⚫',
            unknown: '⚪'
        };
        
        console.log(`${statusIcon[overallStatus]} Overall Status: ${overallStatus.toUpperCase()}`);
        console.log('');
        
        // Display individual checks
        console.log('Component Health:');
        for (const [component, check] of Object.entries(this.healthChecks)) {
            const icon = statusIcon[check.status];
            const name = component.charAt(0).toUpperCase() + component.slice(1);
            console.log(`  ${icon} ${name}: ${check.status}`);
            
            if (check.issues.length > 0) {
                check.issues.forEach(issue => {
                    console.log(`     └─ ${issue}`);
                });
            }
        }
        
        console.log('');
        console.log('Summary:');
        console.log(`  Healthy: ${healthyCount} | Warnings: ${warningCount} | Critical: ${criticalCount}`);
        
        // Recommendations
        if (criticalCount > 0 || warningCount > 0) {
            console.log('');
            console.log('🔧 Recommendations:');
            
            if (this.healthChecks.instances.issues.length > 0) {
                console.log('  • Run cleanup: node scripts/cleanup_instances.cjs');
            }
            
            if (this.healthChecks.memory.issues.length > 0) {
                console.log('  • Optimize performance: node scripts/performance_optimizer.cjs');
            }
            
            if (this.healthChecks.git.issues.length > 0) {
                console.log('  • Check git status and commit changes');
            }
        }
        
        console.log('');
        console.log('Press Ctrl+C to stop monitoring');
        console.log(''.padEnd(60, '-'));
    }

    async saveHealthLog() {
        try {
            const logDir = path.join(__dirname, '../logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            
            const summary = {
                timestamp: new Date().toISOString(),
                overallStatus: this.calculateOverallStatus(),
                checks: this.healthChecks,
                metrics: {
                    uptime: await this.getSystemUptime(),
                    instanceCount: await this.getInstanceCount(),
                    sessionCount: await this.getSessionCount()
                }
            };
            
            // Load existing log
            let history = [];
            if (fs.existsSync(this.healthLog)) {
                history = JSON.parse(fs.readFileSync(this.healthLog, 'utf8'));
            }
            
            history.push(summary);
            
            // Keep last 100 entries
            if (history.length > 100) {
                history = history.slice(-100);
            }
            
            fs.writeFileSync(this.healthLog, JSON.stringify(history, null, 2));
        } catch (error) {
            console.warn('⚠️  Could not save health log:', error.message);
        }
    }

    calculateOverallStatus() {
        const statuses = Object.values(this.healthChecks).map(c => c.status);
        
        if (statuses.includes('critical')) return 'critical';
        if (statuses.filter(s => s === 'warning').length > 2) return 'warning';
        if (statuses.includes('error')) return 'error';
        if (statuses.includes('unknown')) return 'unknown';
        
        return 'healthy';
    }

    async getSystemUptime() {
        try {
            const uptime = await this.execCommand('uptime | awk \'{print $3 " " $4}\'');
            return uptime.trim();
        } catch (error) {
            return 'unknown';
        }
    }

    async getInstanceCount() {
        try {
            const data = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
            return Object.keys(data.instances || {}).length;
        } catch (error) {
            return 0;
        }
    }

    async getSessionCount() {
        try {
            const sessions = await this.execCommand('tmux list-sessions 2>/dev/null | wc -l || echo "0"');
            return parseInt(sessions.trim()) || 0;
        } catch (error) {
            return 0;
        }
    }

    async execCommand(command) {
        return new Promise((resolve) => {
            const child = spawn('bash', ['-c', command]);
            let output = '';
            
            child.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            child.on('close', () => {
                resolve(output);
            });
            
            child.on('error', () => {
                resolve('');
            });
        });
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    stop() {
        this.isRunning = false;
    }
}

// Command line interface
if (require.main === module) {
    const monitor = new HealthMonitor();
    
    const args = process.argv.slice(2);
    const options = {
        once: args.includes('--once'),
        interval: 60000 // 1 minute default
    };
    
    // Parse interval
    const intervalIndex = args.indexOf('--interval');
    if (intervalIndex !== -1 && args[intervalIndex + 1]) {
        const seconds = parseInt(args[intervalIndex + 1]);
        if (!isNaN(seconds)) {
            options.interval = seconds * 1000;
        }
    }
    
    // Show help
    if (args.includes('--help')) {
        console.log('Usage: node health_monitor.cjs [options]');
        console.log('');
        console.log('Options:');
        console.log('  --once             Run health check once and exit');
        console.log('  --interval <s>     Check interval in seconds (default: 60)');
        console.log('  --help             Show this help message');
        console.log('');
        console.log('Examples:');
        console.log('  node health_monitor.cjs');
        console.log('  node health_monitor.cjs --once');
        console.log('  node health_monitor.cjs --interval 30');
        process.exit(0);
    }
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Health monitoring stopped');
        monitor.stop();
        process.exit(0);
    });
    
    monitor.start(options).catch(console.error);
}

module.exports = HealthMonitor;