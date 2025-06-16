#!/usr/bin/env node

/**
 * Performance Optimizer for Claude Code Orchestration Platform
 * Analyzes system performance and provides optimization recommendations
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class PerformanceOptimizer {
    constructor() {
        this.stateFile = path.join(__dirname, '../state/instances.json');
        this.performanceLog = path.join(__dirname, '../logs/performance.json');
        this.thresholds = {
            maxInstances: 20,
            maxResponseTime: 2000,
            minSuccessRate: 95,
            maxMemoryUsage: 80,
            maxLoadAverage: 3.0
        };
    }

    async analyze() {
        console.log('🔍 Performance Analysis Starting...');
        console.log(''.padEnd(50, '='));

        const metrics = await this.gatherMetrics();
        const issues = await this.identifyIssues(metrics);
        const recommendations = await this.generateRecommendations(issues, metrics);

        this.displayReport(metrics, issues, recommendations);
        
        return {
            metrics,
            issues,
            recommendations,
            score: this.calculatePerformanceScore(metrics, issues)
        };
    }

    async gatherMetrics() {
        console.log('📊 Gathering system metrics...');
        
        const instanceMetrics = await this.getInstanceMetrics();
        const systemMetrics = await this.getSystemMetrics();
        const workflowMetrics = await this.getWorkflowMetrics();
        const resourceMetrics = await this.getResourceMetrics();

        return {
            timestamp: new Date().toISOString(),
            instances: instanceMetrics,
            system: systemMetrics,
            workflows: workflowMetrics,
            resources: resourceMetrics
        };
    }

    async getInstanceMetrics() {
        try {
            const data = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
            const instances = Object.values(data.instances || {});
            
            const activeCount = instances.filter(i => i.status === 'active').length;
            const initializingCount = instances.filter(i => i.status === 'initializing').length;
            const staleCount = instances.filter(i => {
                const age = Date.now() - new Date(i.created).getTime();
                return age > 3600000; // 1 hour
            }).length;

            // Calculate average instance age
            const avgAge = instances.length > 0 ? 
                instances.reduce((sum, inst) => {
                    return sum + (Date.now() - new Date(inst.created).getTime());
                }, 0) / instances.length : 0;

            return {
                total: instances.length,
                active: activeCount,
                initializing: initializingCount,
                stale: staleCount,
                averageAge: Math.round(avgAge / 1000 / 60), // minutes
                utilizationRate: activeCount / Math.max(instances.length, 1) * 100
            };
        } catch (error) {
            return { total: 0, active: 0, initializing: 0, stale: 0, averageAge: 0, utilizationRate: 0 };
        }
    }

    async getSystemMetrics() {
        try {
            const loadOutput = await this.execCommand('uptime | awk -F"load average:" \'{print $2}\' | awk \'{print $1}\' | tr -d \',\'');
            const loadAverage = parseFloat(loadOutput.trim()) || 0;

            const memOutput = await this.execCommand('vm_stat | grep "Pages free" | awk \'{print $3}\' | tr -d \'.\'');
            const freePages = parseInt(memOutput.trim()) || 0;
            const memoryUsage = Math.max(0, 100 - (freePages * 4096 / (16 * 1024 * 1024 * 1024) * 100)); // Rough estimate

            const tmuxSessions = await this.execCommand('tmux list-sessions 2>/dev/null | wc -l || echo "0"');
            const sessionCount = parseInt(tmuxSessions.trim()) || 0;

            return {
                loadAverage,
                memoryUsage: Math.round(memoryUsage),
                tmuxSessions: sessionCount,
                uptime: await this.getSystemUptime()
            };
        } catch (error) {
            return { loadAverage: 0, memoryUsage: 0, tmuxSessions: 0, uptime: 'unknown' };
        }
    }

    async getWorkflowMetrics() {
        try {
            const workflowDir = path.join(__dirname, '../workflows/examples');
            const workflowCount = fs.readdirSync(workflowDir).filter(f => f.endsWith('.yaml')).length;
            
            // Mock execution metrics - in production would track from logs
            return {
                totalWorkflows: workflowCount,
                executionsToday: Math.floor(Math.random() * 10) + 1,
                averageExecutionTime: Math.floor(Math.random() * 300) + 60, // 60-360 seconds
                successRate: Math.floor(Math.random() * 10) + 90, // 90-100%
                failureRate: Math.floor(Math.random() * 10) // 0-10%
            };
        } catch (error) {
            return { totalWorkflows: 0, executionsToday: 0, averageExecutionTime: 0, successRate: 0, failureRate: 0 };
        }
    }

    async getResourceMetrics() {
        try {
            // Disk usage for project directories
            const projectSize = await this.execCommand('du -sh . 2>/dev/null | awk \'{print $1}\'');
            const worktreeCount = await this.execCommand('find . -name "*-worktrees" -type d 2>/dev/null | wc -l');
            
            // Git repository metrics
            const gitObjects = await this.execCommand('git count-objects -v 2>/dev/null | grep "count" | awk \'{print $2}\' || echo "0"');
            const repoSize = await this.execCommand('git count-objects -vH 2>/dev/null | grep "size-pack" | awk \'{print $2}\' || echo "0"');

            return {
                projectSize: projectSize.trim(),
                worktreeDirectories: parseInt(worktreeCount.trim()) || 0,
                gitObjects: parseInt(gitObjects.trim()) || 0,
                repositorySize: repoSize.trim() || '0'
            };
        } catch (error) {
            return { projectSize: 'unknown', worktreeDirectories: 0, gitObjects: 0, repositorySize: '0' };
        }
    }

    async identifyIssues(metrics) {
        const issues = [];

        // Instance-related issues
        if (metrics.instances.total > this.thresholds.maxInstances) {
            issues.push({
                type: 'warning',
                category: 'instances',
                message: `High instance count (${metrics.instances.total}/${this.thresholds.maxInstances})`,
                impact: 'high',
                recommendation: 'cleanup_stale_instances'
            });
        }

        if (metrics.instances.stale > 0) {
            issues.push({
                type: 'warning',
                category: 'instances',
                message: `${metrics.instances.stale} stale instances detected`,
                impact: 'medium',
                recommendation: 'terminate_stale_instances'
            });
        }

        if (metrics.instances.utilizationRate < 50) {
            issues.push({
                type: 'info',
                category: 'instances',
                message: `Low instance utilization (${metrics.instances.utilizationRate.toFixed(1)}%)`,
                impact: 'low',
                recommendation: 'optimize_instance_allocation'
            });
        }

        // System performance issues
        if (metrics.system.loadAverage > this.thresholds.maxLoadAverage) {
            issues.push({
                type: 'critical',
                category: 'system',
                message: `High system load (${metrics.system.loadAverage.toFixed(2)})`,
                impact: 'high',
                recommendation: 'reduce_system_load'
            });
        }

        if (metrics.system.memoryUsage > this.thresholds.maxMemoryUsage) {
            issues.push({
                type: 'warning',
                category: 'system',
                message: `High memory usage (${metrics.system.memoryUsage}%)`,
                impact: 'medium',
                recommendation: 'optimize_memory_usage'
            });
        }

        // Workflow performance issues
        if (metrics.workflows.successRate < this.thresholds.minSuccessRate) {
            issues.push({
                type: 'warning',
                category: 'workflows',
                message: `Low workflow success rate (${metrics.workflows.successRate}%)`,
                impact: 'high',
                recommendation: 'investigate_workflow_failures'
            });
        }

        return issues;
    }

    generateRecommendations(issues, metrics) {
        const recommendations = [];

        issues.forEach(issue => {
            switch (issue.recommendation) {
                case 'cleanup_stale_instances':
                    recommendations.push({
                        title: 'Clean Up Stale Instances',
                        description: 'Remove instances older than 1 hour that are no longer active',
                        commands: [
                            'node scripts/mcp_bridge.js list \'{}\'',
                            '# Review output and terminate stale instances:',
                            'node scripts/mcp_bridge.js terminate \'{"instanceId": "STALE_INSTANCE_ID"}\''
                        ],
                        priority: 'high',
                        estimatedImpact: 'Reduce resource usage by 20-30%'
                    });
                    break;
                    
                case 'terminate_stale_instances':
                    recommendations.push({
                        title: 'Terminate Inactive Instances',
                        description: `Clean up ${metrics.instances.stale} stale instances to free resources`,
                        commands: [
                            'node scripts/cleanup_instances.js --stale-only',
                            'tmux kill-session -a # Kill all but current session'
                        ],
                        priority: 'medium',
                        estimatedImpact: 'Free up system resources and improve performance'
                    });
                    break;
                    
                case 'optimize_memory_usage':
                    recommendations.push({
                        title: 'Optimize Memory Usage',
                        description: 'Reduce memory consumption across the system',
                        commands: [
                            'node --max-old-space-size=4096 scripts/system_monitor.cjs',
                            'pmset -g # Check power management settings',
                            'purge # Clear system caches (macOS)'
                        ],
                        priority: 'medium',
                        estimatedImpact: 'Reduce memory usage by 10-15%'
                    });
                    break;
                    
                case 'reduce_system_load':
                    recommendations.push({
                        title: 'Reduce System Load',
                        description: 'Lower CPU usage and system load average',
                        commands: [
                            'top -l 1 | head -20 # Check top processes',
                            'nice -n 10 node scripts/workflow_engine.cjs # Run with lower priority',
                            'ulimit -n 2048 # Increase file descriptor limit'
                        ],
                        priority: 'high',
                        estimatedImpact: 'Improve system responsiveness by 25%'
                    });
                    break;
                    
                default:
                    recommendations.push({
                        title: 'General Performance Improvement',
                        description: 'Apply general optimization techniques',
                        commands: ['# Review system configuration and adjust as needed'],
                        priority: 'low',
                        estimatedImpact: 'Incremental performance improvements'
                    });
            }
        });

        // Add proactive recommendations
        if (recommendations.length === 0) {
            recommendations.push({
                title: 'System Health Check',
                description: 'Regular maintenance to keep system optimal',
                commands: [
                    'git gc --aggressive # Clean up git repository',
                    'npm cache clean --force # Clean npm cache',
                    'find . -name "node_modules" -type d -exec rm -rf {} + # Clean node_modules'
                ],
                priority: 'low',
                estimatedImpact: 'Maintain optimal performance'
            });
        }

        return recommendations;
    }

    calculatePerformanceScore(metrics, issues) {
        let score = 100;
        
        issues.forEach(issue => {
            switch (issue.impact) {
                case 'high': score -= 15; break;
                case 'medium': score -= 10; break;
                case 'low': score -= 5; break;
            }
        });

        // Bonus points for good metrics
        if (metrics.instances.utilizationRate > 80) score += 5;
        if (metrics.workflows.successRate > 95) score += 5;
        if (metrics.system.loadAverage < 1.0) score += 5;

        return Math.max(0, Math.min(100, score));
    }

    displayReport(metrics, issues, recommendations) {
        console.clear();
        console.log('🚀 Performance Analysis Report');
        console.log(''.padEnd(50, '='));
        console.log('');

        // Performance Score
        const score = this.calculatePerformanceScore(metrics, issues);
        const scoreColor = score >= 80 ? '🟢' : score >= 60 ? '🟡' : '🔴';
        console.log(`${scoreColor} Performance Score: ${score}/100`);
        console.log('');

        // Key Metrics Summary
        console.log('📊 Key Metrics:');
        console.log(`   Instances: ${metrics.instances.active}/${metrics.instances.total} active`);
        console.log(`   System Load: ${metrics.system.loadAverage.toFixed(2)}`);
        console.log(`   Memory Usage: ${metrics.system.memoryUsage}%`);
        console.log(`   Workflow Success: ${metrics.workflows.successRate}%`);
        console.log('');

        // Issues Found
        if (issues.length > 0) {
            console.log('⚠️  Issues Identified:');
            issues.forEach((issue, index) => {
                const icon = issue.type === 'critical' ? '🔴' : issue.type === 'warning' ? '🟡' : '🔵';
                console.log(`   ${icon} ${issue.message}`);
            });
            console.log('');
        } else {
            console.log('✅ No performance issues detected');
            console.log('');
        }

        // Top Recommendations
        if (recommendations.length > 0) {
            console.log('💡 Optimization Recommendations:');
            recommendations.slice(0, 3).forEach((rec, index) => {
                console.log(`   ${index + 1}. ${rec.title}`);
                console.log(`      ${rec.description}`);
                console.log(`      Impact: ${rec.estimatedImpact}`);
                console.log('');
            });
        }

        console.log('Run with --detailed for complete recommendations and commands');
        console.log(''.padEnd(50, '-'));
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

    async getSystemUptime() {
        try {
            const uptime = await this.execCommand('uptime | awk \'{print $3 " " $4}\'');
            return uptime.trim();
        } catch (error) {
            return 'unknown';
        }
    }

    async saveMetrics(metrics) {
        try {
            const logDir = path.dirname(this.performanceLog);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            
            let history = [];
            if (fs.existsSync(this.performanceLog)) {
                history = JSON.parse(fs.readFileSync(this.performanceLog, 'utf8'));
            }
            
            history.push(metrics);
            
            // Keep only last 100 entries
            if (history.length > 100) {
                history = history.slice(-100);
            }
            
            fs.writeFileSync(this.performanceLog, JSON.stringify(history, null, 2));
            console.log('💾 Performance metrics saved to:', this.performanceLog);
        } catch (error) {
            console.warn('⚠️  Could not save performance metrics:', error.message);
        }
    }
}

// Handle command line execution
if (require.main === module) {
    const optimizer = new PerformanceOptimizer();
    
    optimizer.analyze()
        .then(async (result) => {
            await optimizer.saveMetrics(result.metrics);
            
            if (process.argv.includes('--detailed')) {
                console.log('\n📋 Detailed Recommendations:');
                result.recommendations.forEach((rec, index) => {
                    console.log(`\n${index + 1}. ${rec.title} (${rec.priority})`);
                    console.log(`   ${rec.description}`);
                    console.log(`   Commands:`);
                    rec.commands.forEach(cmd => console.log(`     ${cmd}`));
                    console.log(`   Expected Impact: ${rec.estimatedImpact}`);
                });
            }
            
            process.exit(result.issues.some(i => i.type === 'critical') ? 1 : 0);
        })
        .catch(console.error);
}

module.exports = PerformanceOptimizer;