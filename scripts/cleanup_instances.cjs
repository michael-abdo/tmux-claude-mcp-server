#!/usr/bin/env node

/**
 * Instance Cleanup Utility for Claude Code Orchestration Platform
 * Safely removes stale instances and frees up system resources
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class InstanceCleaner {
    constructor() {
        this.stateFile = path.join(__dirname, '../state/instances.json');
        this.dryRun = false;
        this.staleThreshold = 3600000; // 1 hour in milliseconds
        this.cleanupLog = [];
    }

    async cleanup(options = {}) {
        console.log('🧹 Claude Instance Cleanup Utility');
        console.log(''.padEnd(50, '='));
        
        this.dryRun = options.dryRun || false;
        this.staleThreshold = options.staleThreshold || this.staleThreshold;
        
        if (this.dryRun) {
            console.log('🔍 DRY RUN MODE - No changes will be made');
        }
        console.log('');

        const instances = await this.loadInstances();
        const staleInstances = await this.identifyStaleInstances(instances);
        const orphanedSessions = await this.findOrphanedSessions(instances);
        const orphanedWorktrees = await this.findOrphanedWorktrees(instances);

        // Display summary
        console.log('📊 Cleanup Summary:');
        console.log(`   Total instances: ${Object.keys(instances).length}`);
        console.log(`   Stale instances: ${staleInstances.length}`);
        console.log(`   Orphaned tmux sessions: ${orphanedSessions.length}`);
        console.log(`   Orphaned worktrees: ${orphanedWorktrees.length}`);
        console.log('');

        if (staleInstances.length === 0 && orphanedSessions.length === 0 && orphanedWorktrees.length === 0) {
            console.log('✅ No cleanup needed - system is clean!');
            return { cleaned: 0, errors: 0 };
        }

        // Perform cleanup
        let cleaned = 0;
        let errors = 0;

        // Clean stale instances
        if (staleInstances.length > 0) {
            console.log('🔧 Cleaning stale instances...');
            for (const instance of staleInstances) {
                try {
                    await this.cleanupInstance(instance);
                    cleaned++;
                } catch (error) {
                    console.error(`   ❌ Failed to clean ${instance.instanceId}: ${error.message}`);
                    errors++;
                }
            }
        }

        // Clean orphaned sessions
        if (orphanedSessions.length > 0) {
            console.log('🔧 Cleaning orphaned tmux sessions...');
            for (const session of orphanedSessions) {
                try {
                    await this.cleanupSession(session);
                    cleaned++;
                } catch (error) {
                    console.error(`   ❌ Failed to clean session ${session}: ${error.message}`);
                    errors++;
                }
            }
        }

        // Clean orphaned worktrees
        if (orphanedWorktrees.length > 0) {
            console.log('🔧 Cleaning orphaned worktrees...');
            for (const worktree of orphanedWorktrees) {
                try {
                    await this.cleanupWorktree(worktree);
                    cleaned++;
                } catch (error) {
                    console.error(`   ❌ Failed to clean worktree ${worktree}: ${error.message}`);
                    errors++;
                }
            }
        }

        // Save updated state
        if (!this.dryRun && staleInstances.length > 0) {
            await this.saveInstances(instances);
        }

        // Save cleanup log
        await this.saveCleanupLog();

        console.log('');
        console.log('🎯 Cleanup Complete:');
        console.log(`   ✅ Cleaned: ${cleaned} items`);
        if (errors > 0) {
            console.log(`   ❌ Errors: ${errors}`);
        }
        console.log(''.padEnd(50, '-'));

        return { cleaned, errors };
    }

    async loadInstances() {
        try {
            const data = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
            return data.instances || {};
        } catch (error) {
            console.warn('⚠️  Could not load instance state:', error.message);
            return {};
        }
    }

    async saveInstances(instances) {
        try {
            const data = { instances };
            fs.writeFileSync(this.stateFile, JSON.stringify(data, null, 2));
            console.log('💾 Instance state updated');
        } catch (error) {
            console.error('❌ Failed to save instance state:', error.message);
        }
    }

    async identifyStaleInstances(instances) {
        const stale = [];
        const now = Date.now();

        for (const [id, instance] of Object.entries(instances)) {
            const age = now - new Date(instance.created).getTime();
            
            if (age > this.staleThreshold) {
                // Check if instance is still responsive
                const isResponsive = await this.checkInstanceResponsive(instance);
                
                if (!isResponsive || instance.status === 'initializing') {
                    stale.push(instance);
                    console.log(`   🔍 Stale: ${id} (age: ${Math.round(age / 1000 / 60)}m, status: ${instance.status})`);
                }
            }
        }

        return stale;
    }

    async checkInstanceResponsive(instance) {
        try {
            // Check if tmux session exists
            const sessionExists = await this.execCommand(
                `tmux has-session -t ${instance.sessionName} 2>/dev/null && echo "exists" || echo "missing"`
            );
            
            return sessionExists.trim() === 'exists';
        } catch (error) {
            return false;
        }
    }

    async findOrphanedSessions(instances) {
        try {
            // Get all tmux sessions
            const sessions = await this.execCommand('tmux list-sessions -F "#{session_name}" 2>/dev/null || echo ""');
            const sessionList = sessions.trim().split('\n').filter(s => s.startsWith('claude_'));
            
            // Find sessions not in instance registry
            const registeredSessions = Object.values(instances).map(i => i.sessionName);
            const orphaned = sessionList.filter(s => !registeredSessions.includes(s));
            
            orphaned.forEach(session => {
                console.log(`   🔍 Orphaned session: ${session}`);
            });
            
            return orphaned;
        } catch (error) {
            return [];
        }
    }

    async findOrphanedWorktrees(instances) {
        try {
            // Find all worktree directories
            const worktrees = await this.execCommand(
                'find . -name "*-worktrees" -type d 2>/dev/null | grep -E "(spec|mgr|exec)_[0-9]+_[0-9]+_[0-9]+" || echo ""'
            );
            
            const worktreeList = worktrees.trim().split('\n').filter(w => w.length > 0);
            const orphaned = [];
            
            // Check each worktree against instance registry
            for (const worktree of worktreeList) {
                const instanceId = path.basename(worktree).match(/(spec|mgr|exec)_[0-9]+_[0-9]+_[0-9]+/);
                if (instanceId && !instances[instanceId[0]]) {
                    orphaned.push(worktree);
                    console.log(`   🔍 Orphaned worktree: ${worktree}`);
                }
            }
            
            return orphaned;
        } catch (error) {
            return [];
        }
    }

    async cleanupInstance(instance) {
        console.log(`   🧹 Cleaning instance: ${instance.instanceId}`);
        this.cleanupLog.push({
            timestamp: new Date().toISOString(),
            action: 'cleanup_instance',
            instanceId: instance.instanceId,
            dryRun: this.dryRun
        });

        if (!this.dryRun) {
            // 1. Kill tmux session
            await this.execCommand(`tmux kill-session -t ${instance.sessionName} 2>/dev/null || true`);
            
            // 2. Remove worktree if exists
            if (instance.isWorktree && instance.projectDir) {
                await this.execCommand(`rm -rf "${instance.projectDir}" 2>/dev/null || true`);
            }
            
            // 3. Remove from state
            const instances = await this.loadInstances();
            delete instances[instance.instanceId];
            await this.saveInstances(instances);
        }
    }

    async cleanupSession(sessionName) {
        console.log(`   🧹 Cleaning orphaned session: ${sessionName}`);
        this.cleanupLog.push({
            timestamp: new Date().toISOString(),
            action: 'cleanup_session',
            sessionName,
            dryRun: this.dryRun
        });

        if (!this.dryRun) {
            await this.execCommand(`tmux kill-session -t ${sessionName} 2>/dev/null || true`);
        }
    }

    async cleanupWorktree(worktreePath) {
        console.log(`   🧹 Cleaning orphaned worktree: ${worktreePath}`);
        this.cleanupLog.push({
            timestamp: new Date().toISOString(),
            action: 'cleanup_worktree',
            worktreePath,
            dryRun: this.dryRun
        });

        if (!this.dryRun) {
            await this.execCommand(`rm -rf "${worktreePath}" 2>/dev/null || true`);
        }
    }

    async saveCleanupLog() {
        try {
            const logDir = path.join(__dirname, '../logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            
            const logFile = path.join(logDir, 'cleanup_history.json');
            let history = [];
            
            if (fs.existsSync(logFile)) {
                history = JSON.parse(fs.readFileSync(logFile, 'utf8'));
            }
            
            history.push({
                timestamp: new Date().toISOString(),
                actions: this.cleanupLog,
                summary: {
                    total: this.cleanupLog.length,
                    dryRun: this.dryRun
                }
            });
            
            // Keep last 50 cleanup runs
            if (history.length > 50) {
                history = history.slice(-50);
            }
            
            fs.writeFileSync(logFile, JSON.stringify(history, null, 2));
        } catch (error) {
            console.warn('⚠️  Could not save cleanup log:', error.message);
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
}

// Command line interface
if (require.main === module) {
    const cleaner = new InstanceCleaner();
    
    const args = process.argv.slice(2);
    const options = {
        dryRun: args.includes('--dry-run'),
        staleThreshold: 3600000 // 1 hour default
    };
    
    // Parse stale threshold
    const thresholdIndex = args.indexOf('--stale-threshold');
    if (thresholdIndex !== -1 && args[thresholdIndex + 1]) {
        const minutes = parseInt(args[thresholdIndex + 1]);
        if (!isNaN(minutes)) {
            options.staleThreshold = minutes * 60 * 1000;
        }
    }
    
    // Show help
    if (args.includes('--help')) {
        console.log('Usage: node cleanup_instances.js [options]');
        console.log('');
        console.log('Options:');
        console.log('  --dry-run              Show what would be cleaned without making changes');
        console.log('  --stale-threshold <m>  Consider instances stale after <m> minutes (default: 60)');
        console.log('  --help                 Show this help message');
        console.log('');
        console.log('Examples:');
        console.log('  node cleanup_instances.js --dry-run');
        console.log('  node cleanup_instances.js --stale-threshold 30');
        console.log('  node cleanup_instances.js --dry-run --stale-threshold 120');
        process.exit(0);
    }
    
    cleaner.cleanup(options)
        .then(result => {
            process.exit(result.errors > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('❌ Cleanup failed:', error.message);
            process.exit(1);
        });
}

module.exports = InstanceCleaner;