#!/usr/bin/env node

/**
 * Automated Maintenance Scheduler for Claude Code Orchestration Platform
 * Runs periodic maintenance tasks to keep the system healthy
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class MaintenanceScheduler {
    constructor() {
        this.configFile = path.join(__dirname, '../config/maintenance.json');
        this.logFile = path.join(__dirname, '../logs/maintenance.log');
        this.isRunning = false;
        
        this.defaultConfig = {
            enabled: true,
            schedules: {
                cleanup: {
                    enabled: true,
                    interval: 3600000, // 1 hour
                    lastRun: null,
                    options: {
                        staleThreshold: 60 // minutes
                    }
                },
                healthCheck: {
                    enabled: true,
                    interval: 1800000, // 30 minutes
                    lastRun: null,
                    options: {
                        once: true
                    }
                },
                performanceOptimization: {
                    enabled: true,
                    interval: 7200000, // 2 hours
                    lastRun: null,
                    options: {
                        detailed: false
                    }
                },
                gitMaintenance: {
                    enabled: true,
                    interval: 86400000, // 24 hours
                    lastRun: null,
                    options: {}
                },
                logRotation: {
                    enabled: true,
                    interval: 86400000, // 24 hours
                    lastRun: null,
                    options: {
                        maxAge: 7, // days
                        maxSize: 100 // MB
                    }
                }
            }
        };
        
        this.tasks = {
            cleanup: this.runCleanup.bind(this),
            healthCheck: this.runHealthCheck.bind(this),
            performanceOptimization: this.runPerformanceOptimization.bind(this),
            gitMaintenance: this.runGitMaintenance.bind(this),
            logRotation: this.runLogRotation.bind(this)
        };
    }

    async start() {
        console.log('🔧 Maintenance Scheduler Starting...');
        console.log(''.padEnd(60, '='));
        
        await this.loadConfig();
        this.isRunning = true;
        
        // Initial status
        await this.displayStatus();
        
        // Main loop
        while (this.isRunning) {
            await this.checkAndRunTasks();
            
            // Sleep for 1 minute between checks
            await this.sleep(60000);
        }
    }

    async loadConfig() {
        try {
            const configDir = path.dirname(this.configFile);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            
            if (fs.existsSync(this.configFile)) {
                const savedConfig = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
                this.config = { ...this.defaultConfig, ...savedConfig };
            } else {
                this.config = this.defaultConfig;
                await this.saveConfig();
            }
        } catch (error) {
            console.warn('⚠️  Using default configuration:', error.message);
            this.config = this.defaultConfig;
        }
    }

    async saveConfig() {
        try {
            fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('❌ Failed to save config:', error.message);
        }
    }

    async checkAndRunTasks() {
        const now = Date.now();
        let tasksRun = 0;
        
        for (const [taskName, taskConfig] of Object.entries(this.config.schedules)) {
            if (!taskConfig.enabled) continue;
            
            const lastRun = taskConfig.lastRun ? new Date(taskConfig.lastRun).getTime() : 0;
            const nextRun = lastRun + taskConfig.interval;
            
            if (now >= nextRun) {
                console.log(`\n⚡ Running scheduled task: ${taskName}`);
                await this.logMaintenance(`Starting ${taskName}`, 'info');
                
                try {
                    const result = await this.tasks[taskName](taskConfig.options);
                    
                    // Update last run time
                    this.config.schedules[taskName].lastRun = new Date().toISOString();
                    await this.saveConfig();
                    
                    await this.logMaintenance(`Completed ${taskName}: ${JSON.stringify(result)}`, 'success');
                    tasksRun++;
                    
                } catch (error) {
                    console.error(`❌ Task ${taskName} failed:`, error.message);
                    await this.logMaintenance(`Failed ${taskName}: ${error.message}`, 'error');
                }
            }
        }
        
        if (tasksRun > 0) {
            console.log(`\n✅ Completed ${tasksRun} maintenance tasks`);
            await this.displayStatus();
        }
    }

    async displayStatus() {
        console.clear();
        console.log('🔧 Maintenance Scheduler Status');
        console.log(''.padEnd(60, '='));
        console.log(`Current Time: ${new Date().toLocaleString()}`);
        console.log('');
        
        console.log('📅 Scheduled Tasks:');
        
        for (const [taskName, taskConfig] of Object.entries(this.config.schedules)) {
            const status = taskConfig.enabled ? '✅' : '❌';
            const lastRun = taskConfig.lastRun ? new Date(taskConfig.lastRun) : null;
            const nextRun = lastRun ? new Date(lastRun.getTime() + taskConfig.interval) : new Date();
            
            console.log(`  ${status} ${taskName}:`);
            console.log(`     Interval: ${this.formatInterval(taskConfig.interval)}`);
            console.log(`     Last Run: ${lastRun ? this.getTimeAgo(lastRun) : 'Never'}`);
            console.log(`     Next Run: ${this.getTimeUntil(nextRun)}`);
        }
        
        console.log('');
        console.log('💡 Commands:');
        console.log('  • Press Ctrl+C to stop');
        console.log('  • Edit config/maintenance.json to customize');
        console.log('  • Check logs/maintenance.log for history');
        console.log(''.padEnd(60, '-'));
    }

    // Task Implementations

    async runCleanup(options) {
        console.log('🧹 Running instance cleanup...');
        
        const result = await this.execCommand(
            `node scripts/cleanup_instances.cjs --stale-threshold ${options.staleThreshold}`
        );
        
        // Parse cleanup results
        const cleaned = result.match(/Cleaned: (\d+)/) || [0, 0];
        const errors = result.match(/Errors: (\d+)/) || [0, 0];
        
        return {
            cleaned: parseInt(cleaned[1]),
            errors: parseInt(errors[1]),
            timestamp: new Date().toISOString()
        };
    }

    async runHealthCheck(options) {
        console.log('🏥 Running health check...');
        
        const result = await this.execCommand('node scripts/health_monitor.cjs --once');
        
        // Parse health status
        const overallStatus = result.match(/Overall Status: (\w+)/) || ['', 'unknown'];
        const healthy = (result.match(/Healthy: (\d+)/) || [0, 0])[1];
        const warnings = (result.match(/Warnings: (\d+)/) || [0, 0])[1];
        const critical = (result.match(/Critical: (\d+)/) || [0, 0])[1];
        
        return {
            status: overallStatus[1].toLowerCase(),
            healthy: parseInt(healthy),
            warnings: parseInt(warnings),
            critical: parseInt(critical),
            timestamp: new Date().toISOString()
        };
    }

    async runPerformanceOptimization(options) {
        console.log('⚡ Running performance optimization...');
        
        const cmd = options.detailed ? 
            'node scripts/performance_optimizer.cjs --detailed' :
            'node scripts/performance_optimizer.cjs';
            
        const result = await this.execCommand(cmd);
        
        // Parse performance score
        const score = result.match(/Performance Score: (\d+)/) || [0, 0];
        const issues = result.match(/Issues Identified:[\s\S]*?(?=💡)/) || [''];
        
        return {
            score: parseInt(score[1]),
            issueCount: (issues[0].match(/🟡|🔴/g) || []).length,
            timestamp: new Date().toISOString()
        };
    }

    async runGitMaintenance(options) {
        console.log('📁 Running git maintenance...');
        
        const commands = [
            'git gc --auto',
            'git prune',
            'git remote prune origin 2>/dev/null || true',
            'find . -name "*.orig" -type f -delete 2>/dev/null || true'
        ];
        
        let success = 0;
        let failed = 0;
        
        for (const cmd of commands) {
            try {
                await this.execCommand(cmd);
                success++;
            } catch (error) {
                failed++;
            }
        }
        
        return {
            commandsRun: commands.length,
            success,
            failed,
            timestamp: new Date().toISOString()
        };
    }

    async runLogRotation(options) {
        console.log('📄 Running log rotation...');
        
        const logDir = path.join(__dirname, '../logs');
        let rotated = 0;
        let deleted = 0;
        
        try {
            const files = fs.readdirSync(logDir);
            const now = Date.now();
            const maxAge = options.maxAge * 24 * 60 * 60 * 1000; // days to ms
            const maxSize = options.maxSize * 1024 * 1024; // MB to bytes
            
            for (const file of files) {
                const filePath = path.join(logDir, file);
                const stats = fs.statSync(filePath);
                
                // Skip non-files
                if (!stats.isFile()) continue;
                
                // Check age
                if (now - stats.mtime.getTime() > maxAge) {
                    fs.unlinkSync(filePath);
                    deleted++;
                    continue;
                }
                
                // Check size
                if (stats.size > maxSize) {
                    // Rotate large files
                    const rotatedPath = `${filePath}.${new Date().toISOString().split('T')[0]}`;
                    fs.renameSync(filePath, rotatedPath);
                    fs.writeFileSync(filePath, ''); // Create new empty file
                    rotated++;
                }
            }
            
        } catch (error) {
            console.error('Log rotation error:', error.message);
        }
        
        return {
            rotated,
            deleted,
            timestamp: new Date().toISOString()
        };
    }

    // Utility Methods

    async execCommand(command) {
        return new Promise((resolve, reject) => {
            const child = spawn('bash', ['-c', command]);
            let output = '';
            let errorOutput = '';
            
            child.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            child.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            child.on('close', (code) => {
                if (code === 0) {
                    resolve(output);
                } else {
                    reject(new Error(errorOutput || `Command failed with code ${code}`));
                }
            });
        });
    }

    async logMaintenance(message, level = 'info') {
        try {
            const logDir = path.dirname(this.logFile);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            
            const logEntry = {
                timestamp: new Date().toISOString(),
                level,
                message
            };
            
            fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
        } catch (error) {
            console.error('Failed to write log:', error.message);
        }
    }

    formatInterval(ms) {
        const hours = Math.floor(ms / (1000 * 60 * 60));
        const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }

    getTimeAgo(date) {
        const diff = Date.now() - date.getTime();
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        return `${minutes}m ago`;
    }

    getTimeUntil(date) {
        const diff = date.getTime() - Date.now();
        
        if (diff <= 0) return 'Now';
        
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) return `in ${hours}h ${minutes % 60}m`;
        return `in ${minutes}m`;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    stop() {
        console.log('\n🛑 Maintenance scheduler stopping...');
        this.isRunning = false;
    }
}

// Command line interface
if (require.main === module) {
    const scheduler = new MaintenanceScheduler();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        scheduler.stop();
        process.exit(0);
    });
    
    scheduler.start().catch(console.error);
}

module.exports = MaintenanceScheduler;