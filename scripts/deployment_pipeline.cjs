#!/usr/bin/env node

/**
 * Automated Deployment Pipeline for Claude Code Orchestration Platform
 * Provides CI/CD capabilities and environment management
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class DeploymentPipeline {
    constructor() {
        this.configFile = path.join(__dirname, '../config/deployment.json');
        this.deploymentLog = path.join(__dirname, '../logs/deployment.log');
        
        this.defaultConfig = {
            environments: {
                development: {
                    branch: 'main',
                    autoBackup: true,
                    runTests: true,
                    healthChecks: true,
                    deploymentHooks: ['pre-deploy', 'post-deploy']
                },
                staging: {
                    branch: 'staging',
                    autoBackup: true,
                    runTests: true,
                    healthChecks: true,
                    requireApproval: false,
                    deploymentHooks: ['pre-deploy', 'validate', 'post-deploy']
                },
                production: {
                    branch: 'production',
                    autoBackup: true,
                    runTests: true,
                    healthChecks: true,
                    requireApproval: true,
                    rollbackOnFailure: true,
                    deploymentHooks: ['pre-deploy', 'validate', 'deploy', 'smoke-test', 'post-deploy']
                }
            },
            hooks: {
                'pre-deploy': ['npm run cleanup', 'npm run health'],
                'validate': ['npm run test'],
                'deploy': ['npm run backup', 'git pull'],
                'smoke-test': ['npm run health', 'npm run monitor --once'],
                'post-deploy': ['npm run optimize']
            },
            notifications: {
                enabled: false,
                webhook: '',
                channels: ['#deployments']
            }
        };
        
        this.deploymentStages = [
            'prepare',
            'backup',
            'test',
            'deploy',
            'validate',
            'health-check',
            'finalize'
        ];
    }

    async deploy(environment, options = {}) {
        console.log('🚀 Starting Deployment Pipeline...');
        console.log(''.padEnd(80, '='));
        
        const deploymentId = this.generateDeploymentId();
        const timestamp = new Date().toISOString();
        
        try {
            // Load configuration
            await this.loadConfig();
            
            // Validate environment
            const envConfig = this.config.environments[environment];
            if (!envConfig) {
                throw new Error(`Unknown environment: ${environment}`);
            }
            
            console.log(`🎯 Environment: ${environment}`);
            console.log(`📋 Deployment ID: ${deploymentId}`);
            console.log(`⏰ Started: ${new Date(timestamp).toLocaleString()}`);
            console.log('');
            
            // Create deployment context
            const deployment = {
                id: deploymentId,
                environment,
                timestamp,
                config: envConfig,
                options,
                status: 'running',
                stages: {},
                rollbackInfo: null
            };
            
            // Run deployment stages
            await this.runDeploymentStages(deployment);
            
            deployment.status = 'completed';
            deployment.completedAt = new Date().toISOString();
            
            // Log deployment
            await this.logDeployment(deployment);
            
            // Send notification
            if (this.config.notifications.enabled) {
                await this.sendNotification(deployment);
            }
            
            console.log('');
            console.log('✅ Deployment completed successfully!');
            console.log(`🆔 Deployment ID: ${deploymentId}`);
            console.log(`⏱️  Duration: ${this.getDuration(timestamp)}`);
            
            return deployment;
            
        } catch (error) {
            console.error('❌ Deployment failed:', error.message);
            
            // Attempt rollback if configured
            if (envConfig?.rollbackOnFailure && !options.noRollback) {
                console.log('');
                console.log('🔄 Attempting automatic rollback...');
                await this.rollback(environment, { automatic: true });
            }
            
            throw error;
        }
    }

    async rollback(environment, options = {}) {
        console.log('🔄 Starting Rollback Process...');
        console.log(''.padEnd(80, '='));
        
        try {
            // Find last successful deployment
            const lastDeployment = await this.getLastSuccessfulDeployment(environment);
            
            if (!lastDeployment) {
                throw new Error('No successful deployment found for rollback');
            }
            
            console.log(`📋 Rolling back to: ${lastDeployment.id}`);
            console.log(`⏰ Deployed: ${new Date(lastDeployment.timestamp).toLocaleString()}`);
            
            // Create rollback backup
            if (!options.noBackup) {
                console.log('');
                console.log('💾 Creating rollback backup...');
                await this.execCommand('node scripts/backup_recovery.cjs backup "Before rollback"');
            }
            
            // Restore from backup
            if (lastDeployment.backupId) {
                console.log('');
                console.log('📦 Restoring from backup...');
                await this.execCommand(
                    `node scripts/backup_recovery.cjs restore ${lastDeployment.backupId} --force`
                );
            }
            
            // Run post-rollback health check
            console.log('');
            console.log('🏥 Running health check...');
            await this.execCommand('npm run health');
            
            console.log('');
            console.log('✅ Rollback completed successfully!');
            
            return true;
            
        } catch (error) {
            console.error('❌ Rollback failed:', error.message);
            throw error;
        }
    }

    async runDeploymentStages(deployment) {
        const stages = this.deploymentStages;
        
        for (const stageName of stages) {
            console.log(`\n🔄 Stage: ${stageName}`);
            console.log(''.padEnd(60, '-'));
            
            const stageStart = Date.now();
            
            try {
                await this.runStage(stageName, deployment);
                
                const duration = Date.now() - stageStart;
                deployment.stages[stageName] = {
                    status: 'success',
                    duration,
                    timestamp: new Date().toISOString()
                };
                
                console.log(`   ✅ ${stageName} completed (${duration}ms)`);
                
            } catch (error) {
                deployment.stages[stageName] = {
                    status: 'failed',
                    error: error.message,
                    timestamp: new Date().toISOString()
                };
                
                console.log(`   ❌ ${stageName} failed: ${error.message}`);
                throw error;
            }
        }
    }

    async runStage(stageName, deployment) {
        const { environment, config, options } = deployment;
        
        switch (stageName) {
            case 'prepare':
                await this.stagePrepare(deployment);
                break;
                
            case 'backup':
                await this.stageBackup(deployment);
                break;
                
            case 'test':
                await this.stageTest(deployment);
                break;
                
            case 'deploy':
                await this.stageDeploy(deployment);
                break;
                
            case 'validate':
                await this.stageValidate(deployment);
                break;
                
            case 'health-check':
                await this.stageHealthCheck(deployment);
                break;
                
            case 'finalize':
                await this.stageFinalize(deployment);
                break;
                
            default:
                throw new Error(`Unknown stage: ${stageName}`);
        }
    }

    async stagePrepare(deployment) {
        console.log('   📋 Preparing deployment environment...');
        
        // Run pre-deploy hooks
        if (deployment.config.deploymentHooks?.includes('pre-deploy')) {
            const hooks = this.config.hooks['pre-deploy'] || [];
            for (const hook of hooks) {
                console.log(`      Running: ${hook}`);
                await this.execCommand(hook);
            }
        }
        
        // Check git status
        const gitStatus = await this.execCommand('git status --porcelain');
        if (gitStatus.trim() && !deployment.options.allowDirty) {
            throw new Error('Working directory not clean. Commit or stash changes.');
        }
        
        // Verify branch
        const currentBranch = await this.execCommand('git branch --show-current');
        const targetBranch = deployment.config.branch;
        
        if (currentBranch.trim() !== targetBranch) {
            console.log(`      Switching to branch: ${targetBranch}`);
            await this.execCommand(`git checkout ${targetBranch}`);
            await this.execCommand('git pull origin ' + targetBranch);
        }
    }

    async stageBackup(deployment) {
        if (!deployment.config.autoBackup) {
            console.log('   ⏭️  Backup skipped (disabled)');
            return;
        }
        
        console.log('   💾 Creating deployment backup...');
        
        const backupResult = await this.execCommand(
            `node scripts/backup_recovery.cjs backup "Deployment ${deployment.id}"`
        );
        
        // Extract backup ID from output
        const backupMatch = backupResult.match(/Backup ID: ([a-zA-Z0-9_]+)/);
        if (backupMatch) {
            deployment.backupId = backupMatch[1];
            console.log(`      Backup ID: ${deployment.backupId}`);
        }
    }

    async stageTest(deployment) {
        if (!deployment.config.runTests) {
            console.log('   ⏭️  Tests skipped (disabled)');
            return;
        }
        
        console.log('   🧪 Running test suite...');
        
        const testResult = await this.execCommand('npm run test');
        
        // Parse test results
        const successMatch = testResult.match(/Success Rate: ([\d.]+)%/);
        if (successMatch) {
            const successRate = parseFloat(successMatch[1]);
            if (successRate < 90) {
                throw new Error(`Test success rate too low: ${successRate}%`);
            }
            console.log(`      Success rate: ${successRate}%`);
        }
    }

    async stageDeploy(deployment) {
        console.log('   🚀 Deploying application...');
        
        // Run deploy hooks
        if (deployment.config.deploymentHooks?.includes('deploy')) {
            const hooks = this.config.hooks['deploy'] || [];
            for (const hook of hooks) {
                console.log(`      Running: ${hook}`);
                await this.execCommand(hook);
            }
        }
        
        // Restart services if needed
        if (!deployment.options.noRestart) {
            console.log('      Restarting services...');
            await this.execCommand('./stop_monitoring.sh || true');
            await this.execCommand('./start_monitoring.sh');
        }
    }

    async stageValidate(deployment) {
        console.log('   ✅ Validating deployment...');
        
        // Run validation hooks
        if (deployment.config.deploymentHooks?.includes('validate')) {
            const hooks = this.config.hooks['validate'] || [];
            for (const hook of hooks) {
                console.log(`      Running: ${hook}`);
                await this.execCommand(hook);
            }
        }
        
        // Check critical services
        const services = ['system_monitor', 'maintenance_scheduler'];
        for (const service of services) {
            try {
                await this.execCommand(`pgrep -f ${service} > /dev/null`);
                console.log(`      ✓ Service running: ${service}`);
            } catch (error) {
                console.log(`      ⚠ Service not running: ${service}`);
            }
        }
    }

    async stageHealthCheck(deployment) {
        if (!deployment.config.healthChecks) {
            console.log('   ⏭️  Health checks skipped (disabled)');
            return;
        }
        
        console.log('   🏥 Running health checks...');
        
        const healthResult = await this.execCommand('npm run health');
        
        // Parse health status
        const statusMatch = healthResult.match(/Overall Status: (\w+)/);
        if (statusMatch) {
            const status = statusMatch[1].toLowerCase();
            if (status === 'critical') {
                throw new Error('System health check failed - critical issues detected');
            }
            console.log(`      Health status: ${status}`);
        }
    }

    async stageFinalize(deployment) {
        console.log('   🎯 Finalizing deployment...');
        
        // Run post-deploy hooks
        if (deployment.config.deploymentHooks?.includes('post-deploy')) {
            const hooks = this.config.hooks['post-deploy'] || [];
            for (const hook of hooks) {
                console.log(`      Running: ${hook}`);
                await this.execCommand(hook);
            }
        }
        
        // Update deployment tracking
        const trackingFile = path.join(__dirname, '../logs/last_deployment.json');
        fs.writeFileSync(trackingFile, JSON.stringify({
            id: deployment.id,
            environment: deployment.environment,
            timestamp: deployment.timestamp,
            backupId: deployment.backupId
        }, null, 2));
        
        console.log('      Deployment tracking updated');
    }

    async list() {
        console.log('📜 Deployment History');
        console.log(''.padEnd(80, '='));
        
        const deployments = await this.getDeploymentHistory();
        
        if (deployments.length === 0) {
            console.log('No deployments found.');
            return;
        }
        
        deployments.slice(0, 10).forEach(deployment => {
            const duration = deployment.completedAt ? 
                this.getDuration(deployment.timestamp, deployment.completedAt) : 'N/A';
            
            console.log(`ID: ${deployment.id}`);
            console.log(`   Environment: ${deployment.environment}`);
            console.log(`   Status: ${this.getStatusIcon(deployment.status)} ${deployment.status}`);
            console.log(`   Started: ${new Date(deployment.timestamp).toLocaleString()}`);
            console.log(`   Duration: ${duration}`);
            if (deployment.backupId) {
                console.log(`   Backup ID: ${deployment.backupId}`);
            }
            console.log('');
        });
    }

    async status() {
        console.log('📊 Deployment Status');
        console.log(''.padEnd(80, '='));
        
        // Get last deployment for each environment
        const environments = Object.keys(this.config.environments);
        
        for (const env of environments) {
            const lastDeployment = await this.getLastDeployment(env);
            
            console.log(`${env.toUpperCase()}:`);
            if (lastDeployment) {
                const age = this.getAge(lastDeployment.timestamp);
                console.log(`   Last Deployment: ${lastDeployment.id} (${age})`);
                console.log(`   Status: ${this.getStatusIcon(lastDeployment.status)} ${lastDeployment.status}`);
            } else {
                console.log('   No deployments found');
            }
            console.log('');
        }
        
        // Show current system status
        console.log('Current System:');
        try {
            const gitBranch = await this.execCommand('git branch --show-current');
            const gitCommit = await this.execCommand('git rev-parse --short HEAD');
            
            console.log(`   Branch: ${gitBranch.trim()}`);
            console.log(`   Commit: ${gitCommit.trim()}`);
        } catch (error) {
            console.log('   Git info unavailable');
        }
    }

    // Helper Methods

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

    generateDeploymentId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `deploy_${timestamp}_${random}`;
    }

    async logDeployment(deployment) {
        const logDir = path.dirname(this.deploymentLog);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        
        const logEntry = {
            ...deployment,
            loggedAt: new Date().toISOString()
        };
        
        fs.appendFileSync(this.deploymentLog, JSON.stringify(logEntry) + '\n');
    }

    async getDeploymentHistory() {
        if (!fs.existsSync(this.deploymentLog)) {
            return [];
        }
        
        const content = fs.readFileSync(this.deploymentLog, 'utf8');
        const lines = content.trim().split('\n').filter(line => line);
        
        return lines.map(line => {
            try {
                return JSON.parse(line);
            } catch (error) {
                return null;
            }
        }).filter(Boolean).reverse(); // Most recent first
    }

    async getLastDeployment(environment) {
        const history = await this.getDeploymentHistory();
        return history.find(d => d.environment === environment);
    }

    async getLastSuccessfulDeployment(environment) {
        const history = await this.getDeploymentHistory();
        return history.find(d => d.environment === environment && d.status === 'completed');
    }

    getDuration(start, end = null) {
        const startTime = new Date(start).getTime();
        const endTime = end ? new Date(end).getTime() : Date.now();
        const duration = endTime - startTime;
        
        const seconds = Math.floor(duration / 1000);
        const minutes = Math.floor(seconds / 60);
        
        if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        return `${seconds}s`;
    }

    getAge(timestamp) {
        const diff = Date.now() - new Date(timestamp).getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        return 'just now';
    }

    getStatusIcon(status) {
        const icons = {
            running: '🔄',
            completed: '✅',
            failed: '❌',
            rolled_back: '🔄'
        };
        return icons[status] || '❓';
    }

    async sendNotification(deployment) {
        // Implementation for webhook notifications
        console.log('📢 Sending deployment notification...');
    }

    async execCommand(command) {
        return new Promise((resolve, reject) => {
            const child = spawn('bash', ['-c', command]);
            let output = '';
            let error = '';
            
            child.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            child.stderr.on('data', (data) => {
                error += data.toString();
            });
            
            child.on('close', (code) => {
                if (code === 0) {
                    resolve(output);
                } else {
                    reject(new Error(error || `Command failed: ${command}`));
                }
            });
        });
    }
}

// CLI Interface
if (require.main === module) {
    const pipeline = new DeploymentPipeline();
    const args = process.argv.slice(2);
    const command = args[0];
    
    const showHelp = () => {
        console.log('Usage: node deployment_pipeline.cjs <command> [options]');
        console.log('');
        console.log('Commands:');
        console.log('  deploy <env>           Deploy to environment');
        console.log('  rollback <env>         Rollback environment');
        console.log('  list                   List deployment history');
        console.log('  status                 Show deployment status');
        console.log('');
        console.log('Environments:');
        console.log('  development            Development environment');
        console.log('  staging               Staging environment');
        console.log('  production            Production environment');
        console.log('');
        console.log('Options:');
        console.log('  --allow-dirty         Allow deployment with uncommitted changes');
        console.log('  --no-backup           Skip backup creation');
        console.log('  --no-restart          Skip service restart');
        console.log('  --no-rollback         Disable automatic rollback on failure');
        console.log('');
        console.log('Examples:');
        console.log('  node deployment_pipeline.cjs deploy development');
        console.log('  node deployment_pipeline.cjs deploy production --no-restart');
        console.log('  node deployment_pipeline.cjs rollback staging');
    };
    
    (async () => {
        try {
            switch (command) {
                case 'deploy':
                    if (!args[1]) {
                        console.error('Error: Environment required');
                        showHelp();
                        process.exit(1);
                    }
                    await pipeline.deploy(args[1], {
                        allowDirty: args.includes('--allow-dirty'),
                        noBackup: args.includes('--no-backup'),
                        noRestart: args.includes('--no-restart'),
                        noRollback: args.includes('--no-rollback')
                    });
                    break;
                    
                case 'rollback':
                    if (!args[1]) {
                        console.error('Error: Environment required');
                        showHelp();
                        process.exit(1);
                    }
                    await pipeline.rollback(args[1], {
                        noBackup: args.includes('--no-backup')
                    });
                    break;
                    
                case 'list':
                    await pipeline.list();
                    break;
                    
                case 'status':
                    await pipeline.status();
                    break;
                    
                default:
                    showHelp();
                    process.exit(command ? 1 : 0);
            }
        } catch (error) {
            console.error('Pipeline Error:', error.message);
            process.exit(1);
        }
    })();
}

module.exports = DeploymentPipeline;