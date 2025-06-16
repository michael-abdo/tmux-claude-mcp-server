#!/usr/bin/env node

/**
 * Backup and Recovery System for Claude Code Orchestration Platform
 * Provides automated backups and disaster recovery capabilities
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');

class BackupRecovery {
    constructor() {
        this.backupDir = path.join(__dirname, '../backups');
        this.configFile = path.join(__dirname, '../config/backup.json');
        
        this.defaultConfig = {
            autoBackup: {
                enabled: true,
                interval: 3600000, // 1 hour
                retention: {
                    daily: 7,      // Keep 7 daily backups
                    weekly: 4,     // Keep 4 weekly backups
                    monthly: 3     // Keep 3 monthly backups
                }
            },
            include: [
                'state/',
                'config/',
                'workflows/',
                'logs/',
                'scripts/',
                'src/',
                'CLAUDE.md',
                'package.json'
            ],
            exclude: [
                'node_modules/',
                'backups/',
                '*-worktrees/',
                '.git/',
                '*.log'
            ],
            compression: true,
            encryption: false
        };
    }

    async backup(options = {}) {
        console.log('🔒 Starting Backup Process...');
        console.log(''.padEnd(60, '='));
        
        const backupType = options.type || 'manual';
        const description = options.description || 'Manual backup';
        
        try {
            // Ensure backup directory exists
            if (!fs.existsSync(this.backupDir)) {
                fs.mkdirSync(this.backupDir, { recursive: true });
            }
            
            // Load configuration
            await this.loadConfig();
            
            // Create backup metadata
            const backupId = this.generateBackupId();
            const timestamp = new Date().toISOString();
            const backupName = `backup_${backupType}_${backupId}`;
            const backupPath = path.join(this.backupDir, backupName);
            
            const metadata = {
                id: backupId,
                type: backupType,
                description,
                timestamp,
                system: await this.getSystemInfo(),
                files: [],
                size: 0,
                compressed: this.config.compression,
                encrypted: this.config.encryption
            };
            
            console.log(`📦 Creating backup: ${backupName}`);
            console.log(`   Type: ${backupType}`);
            console.log(`   Time: ${new Date(timestamp).toLocaleString()}`);
            
            // Create temporary directory for backup
            const tempDir = `${backupPath}_temp`;
            fs.mkdirSync(tempDir, { recursive: true });
            
            // Copy files to backup
            let totalFiles = 0;
            let totalSize = 0;
            
            for (const includePath of this.config.include) {
                const sourcePath = path.join(__dirname, '..', includePath);
                
                if (fs.existsSync(sourcePath)) {
                    console.log(`   📄 Backing up: ${includePath}`);
                    const result = await this.copyPath(sourcePath, tempDir, includePath);
                    totalFiles += result.files;
                    totalSize += result.size;
                    metadata.files.push({
                        path: includePath,
                        files: result.files,
                        size: result.size
                    });
                }
            }
            
            metadata.totalFiles = totalFiles;
            metadata.size = totalSize;
            
            // Save metadata
            fs.writeFileSync(
                path.join(tempDir, 'backup_metadata.json'),
                JSON.stringify(metadata, null, 2)
            );
            
            // Create state snapshot
            await this.createStateSnapshot(tempDir);
            
            // Compress if enabled
            if (this.config.compression) {
                console.log('   🗜️  Compressing backup...');
                await this.compressBackup(tempDir, `${backupPath}.tar.gz`);
                
                // Remove temp directory
                await this.execCommand(`rm -rf "${tempDir}"`);
                
                // Update metadata with compressed size
                const stats = fs.statSync(`${backupPath}.tar.gz`);
                metadata.compressedSize = stats.size;
                
                console.log(`   ✅ Compressed size: ${this.formatSize(stats.size)}`);
            } else {
                // Just rename temp directory
                fs.renameSync(tempDir, backupPath);
            }
            
            // Save backup registry
            await this.updateBackupRegistry(metadata);
            
            // Cleanup old backups
            await this.cleanupOldBackups();
            
            console.log('');
            console.log('✅ Backup completed successfully!');
            console.log(`   Backup ID: ${backupId}`);
            console.log(`   Files: ${totalFiles}`);
            console.log(`   Size: ${this.formatSize(totalSize)}`);
            
            return metadata;
            
        } catch (error) {
            console.error('❌ Backup failed:', error.message);
            throw error;
        }
    }

    async restore(backupId, options = {}) {
        console.log('🔄 Starting Restore Process...');
        console.log(''.padEnd(60, '='));
        
        try {
            // Find backup
            const backup = await this.findBackup(backupId);
            if (!backup) {
                throw new Error(`Backup not found: ${backupId}`);
            }
            
            console.log(`📦 Restoring backup: ${backup.id}`);
            console.log(`   Type: ${backup.type}`);
            console.log(`   Created: ${new Date(backup.timestamp).toLocaleString()}`);
            console.log(`   Files: ${backup.totalFiles}`);
            console.log(`   Size: ${this.formatSize(backup.size)}`);
            
            // Confirm restore
            if (!options.force) {
                console.log('');
                console.log('⚠️  WARNING: This will overwrite current files!');
                console.log('   Use --force to skip confirmation');
                
                // In a real implementation, would prompt for confirmation
                if (!options.autoConfirm) {
                    console.log('   Restore cancelled (no confirmation)');
                    return false;
                }
            }
            
            // Create restore point
            if (!options.noBackup) {
                console.log('');
                console.log('📸 Creating restore point...');
                await this.backup({
                    type: 'restore_point',
                    description: `Before restoring ${backupId}`
                });
            }
            
            // Prepare restore
            const backupPath = this.getBackupPath(backup);
            const tempDir = path.join(this.backupDir, `restore_${Date.now()}`);
            
            // Extract if compressed
            if (backup.compressed) {
                console.log('   🗜️  Extracting backup...');
                fs.mkdirSync(tempDir, { recursive: true });
                await this.extractBackup(backupPath, tempDir);
            } else {
                // Use backup directory directly
                tempDir = backupPath;
            }
            
            // Restore files
            console.log('   📄 Restoring files...');
            let restoredFiles = 0;
            
            for (const fileGroup of backup.files) {
                const sourcePath = path.join(tempDir, fileGroup.path);
                const destPath = path.join(__dirname, '..', fileGroup.path);
                
                if (fs.existsSync(sourcePath)) {
                    console.log(`      Restoring: ${fileGroup.path}`);
                    await this.restorePath(sourcePath, destPath);
                    restoredFiles += fileGroup.files;
                }
            }
            
            // Restore state
            await this.restoreState(tempDir);
            
            // Cleanup temp directory
            if (backup.compressed && fs.existsSync(tempDir)) {
                await this.execCommand(`rm -rf "${tempDir}"`);
            }
            
            console.log('');
            console.log('✅ Restore completed successfully!');
            console.log(`   Restored files: ${restoredFiles}`);
            console.log(`   From backup: ${backupId}`);
            
            // Log restore operation
            await this.logRestoreOperation(backup, restoredFiles);
            
            return true;
            
        } catch (error) {
            console.error('❌ Restore failed:', error.message);
            throw error;
        }
    }

    async list() {
        console.log('📋 Available Backups');
        console.log(''.padEnd(80, '='));
        
        const registry = await this.loadBackupRegistry();
        
        if (registry.backups.length === 0) {
            console.log('No backups found.');
            return;
        }
        
        // Group by type
        const grouped = {};
        registry.backups.forEach(backup => {
            if (!grouped[backup.type]) {
                grouped[backup.type] = [];
            }
            grouped[backup.type].push(backup);
        });
        
        // Display by type
        for (const [type, backups] of Object.entries(grouped)) {
            console.log(`\n${type.toUpperCase()} Backups:`);
            console.log(''.padEnd(80, '-'));
            
            backups
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .slice(0, 10)
                .forEach(backup => {
                    const age = this.getAge(backup.timestamp);
                    const size = backup.compressedSize || backup.size;
                    
                    console.log(`ID: ${backup.id}`);
                    console.log(`   Created: ${new Date(backup.timestamp).toLocaleString()} (${age})`);
                    console.log(`   Size: ${this.formatSize(size)}`);
                    console.log(`   Files: ${backup.totalFiles}`);
                    console.log(`   Description: ${backup.description}`);
                    console.log('');
                });
        }
        
        // Summary
        console.log(''.padEnd(80, '-'));
        console.log(`Total backups: ${registry.backups.length}`);
        const totalSize = registry.backups.reduce((sum, b) => sum + (b.compressedSize || b.size), 0);
        console.log(`Total size: ${this.formatSize(totalSize)}`);
    }

    async verify(backupId) {
        console.log('🔍 Verifying Backup...');
        
        try {
            const backup = await this.findBackup(backupId);
            if (!backup) {
                throw new Error(`Backup not found: ${backupId}`);
            }
            
            const backupPath = this.getBackupPath(backup);
            
            // Check if backup exists
            if (!fs.existsSync(backupPath)) {
                console.error('❌ Backup file missing!');
                return false;
            }
            
            // Verify file integrity
            console.log('   Checking file integrity...');
            
            if (backup.compressed) {
                // Test archive integrity
                const result = await this.execCommand(`tar -tzf "${backupPath}" > /dev/null 2>&1 && echo "OK" || echo "CORRUPT"`);
                if (result.trim() !== 'OK') {
                    console.error('❌ Archive is corrupted!');
                    return false;
                }
            }
            
            console.log('✅ Backup verified successfully!');
            return true;
            
        } catch (error) {
            console.error('❌ Verification failed:', error.message);
            return false;
        }
    }

    // Helper Methods

    async loadConfig() {
        try {
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
        const configDir = path.dirname(this.configFile);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
    }

    generateBackupId() {
        const timestamp = Date.now().toString(36);
        const random = crypto.randomBytes(4).toString('hex');
        return `${timestamp}_${random}`;
    }

    async getSystemInfo() {
        return {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            cwd: process.cwd(),
            hostname: await this.execCommand('hostname') || 'unknown'
        };
    }

    async copyPath(source, dest, relativePath) {
        let files = 0;
        let size = 0;
        
        const destPath = path.join(dest, relativePath);
        
        if (fs.statSync(source).isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            
            const items = fs.readdirSync(source);
            for (const item of items) {
                // Check exclusions
                if (this.shouldExclude(item)) continue;
                
                const itemPath = path.join(source, item);
                const result = await this.copyPath(
                    itemPath,
                    dest,
                    path.join(relativePath, item)
                );
                files += result.files;
                size += result.size;
            }
        } else {
            // Copy file
            const dir = path.dirname(destPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.copyFileSync(source, destPath);
            const stats = fs.statSync(source);
            files = 1;
            size = stats.size;
        }
        
        return { files, size };
    }

    shouldExclude(item) {
        return this.config.exclude.some(pattern => {
            if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace('*', '.*'));
                return regex.test(item);
            }
            return item === pattern || item === pattern.replace('/', '');
        });
    }

    async createStateSnapshot(backupDir) {
        const snapshot = {
            timestamp: new Date().toISOString(),
            instances: {},
            tmuxSessions: [],
            gitStatus: {}
        };
        
        // Get instance state
        const stateFile = path.join(__dirname, '../state/instances.json');
        if (fs.existsSync(stateFile)) {
            const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
            snapshot.instances = state.instances || {};
        }
        
        // Get tmux sessions
        try {
            const sessions = await this.execCommand('tmux list-sessions -F "#{session_name}:#{session_created}" 2>/dev/null || echo ""');
            snapshot.tmuxSessions = sessions.trim().split('\n').filter(s => s);
        } catch (error) {
            // Ignore tmux errors
        }
        
        // Get git status
        try {
            snapshot.gitStatus.branch = await this.execCommand('git branch --show-current');
            snapshot.gitStatus.commit = await this.execCommand('git rev-parse HEAD');
            snapshot.gitStatus.status = await this.execCommand('git status --porcelain');
        } catch (error) {
            // Ignore git errors
        }
        
        fs.writeFileSync(
            path.join(backupDir, 'state_snapshot.json'),
            JSON.stringify(snapshot, null, 2)
        );
    }

    async compressBackup(source, dest) {
        await this.execCommand(`tar -czf "${dest}" -C "${path.dirname(source)}" "${path.basename(source)}"`);
    }

    async extractBackup(source, dest) {
        await this.execCommand(`tar -xzf "${source}" -C "${dest}" --strip-components=1`);
    }

    async restorePath(source, dest) {
        if (fs.existsSync(dest)) {
            // Backup existing file/directory
            const backupPath = `${dest}.backup_${Date.now()}`;
            fs.renameSync(dest, backupPath);
        }
        
        // Copy from backup
        await this.execCommand(`cp -r "${source}" "${dest}"`);
    }

    async restoreState(backupDir) {
        const snapshotPath = path.join(backupDir, 'state_snapshot.json');
        
        if (fs.existsSync(snapshotPath)) {
            const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
            
            // Restore instance state
            const stateFile = path.join(__dirname, '../state/instances.json');
            const stateDir = path.dirname(stateFile);
            
            if (!fs.existsSync(stateDir)) {
                fs.mkdirSync(stateDir, { recursive: true });
            }
            
            fs.writeFileSync(stateFile, JSON.stringify({
                instances: snapshot.instances
            }, null, 2));
            
            console.log(`   ✅ Restored ${Object.keys(snapshot.instances).length} instance states`);
        }
    }

    async updateBackupRegistry(metadata) {
        const registry = await this.loadBackupRegistry();
        
        registry.backups.push({
            ...metadata,
            path: this.getBackupFilename(metadata)
        });
        
        // Sort by timestamp
        registry.backups.sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        registry.lastUpdated = new Date().toISOString();
        
        await this.saveBackupRegistry(registry);
    }

    async loadBackupRegistry() {
        const registryPath = path.join(this.backupDir, 'backup_registry.json');
        
        if (fs.existsSync(registryPath)) {
            return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
        }
        
        return {
            version: '1.0',
            backups: [],
            lastUpdated: new Date().toISOString()
        };
    }

    async saveBackupRegistry(registry) {
        const registryPath = path.join(this.backupDir, 'backup_registry.json');
        fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
    }

    async findBackup(backupId) {
        const registry = await this.loadBackupRegistry();
        return registry.backups.find(b => b.id === backupId || b.id.startsWith(backupId));
    }

    getBackupPath(backup) {
        return path.join(this.backupDir, backup.path);
    }

    getBackupFilename(metadata) {
        const name = `backup_${metadata.type}_${metadata.id}`;
        return metadata.compressed ? `${name}.tar.gz` : name;
    }

    async cleanupOldBackups() {
        // Implementation for retention policy
        console.log('   🧹 Checking retention policy...');
        
        const registry = await this.loadBackupRegistry();
        const now = Date.now();
        const toDelete = [];
        
        // Group backups by type and age
        const grouped = {
            daily: [],
            weekly: [],
            monthly: []
        };
        
        registry.backups.forEach(backup => {
            const age = now - new Date(backup.timestamp).getTime();
            const days = age / (1000 * 60 * 60 * 24);
            
            if (days <= 7) {
                grouped.daily.push(backup);
            } else if (days <= 30) {
                grouped.weekly.push(backup);
            } else {
                grouped.monthly.push(backup);
            }
        });
        
        // Apply retention policy
        const retention = this.config.autoBackup.retention;
        
        if (grouped.daily.length > retention.daily) {
            toDelete.push(...grouped.daily.slice(retention.daily));
        }
        
        if (grouped.weekly.length > retention.weekly) {
            toDelete.push(...grouped.weekly.slice(retention.weekly));
        }
        
        if (grouped.monthly.length > retention.monthly) {
            toDelete.push(...grouped.monthly.slice(retention.monthly));
        }
        
        // Delete old backups
        for (const backup of toDelete) {
            const backupPath = this.getBackupPath(backup);
            if (fs.existsSync(backupPath)) {
                fs.rmSync(backupPath, { recursive: true, force: true });
                console.log(`      Deleted old backup: ${backup.id}`);
            }
        }
        
        // Update registry
        if (toDelete.length > 0) {
            registry.backups = registry.backups.filter(b => 
                !toDelete.find(d => d.id === b.id)
            );
            await this.saveBackupRegistry(registry);
        }
    }

    async logRestoreOperation(backup, restoredFiles) {
        const logDir = path.join(__dirname, '../logs');
        const logFile = path.join(logDir, 'restore_history.json');
        
        let history = [];
        if (fs.existsSync(logFile)) {
            history = JSON.parse(fs.readFileSync(logFile, 'utf8'));
        }
        
        history.push({
            timestamp: new Date().toISOString(),
            backupId: backup.id,
            backupType: backup.type,
            backupDate: backup.timestamp,
            restoredFiles,
            success: true
        });
        
        // Keep last 50 entries
        if (history.length > 50) {
            history = history.slice(-50);
        }
        
        fs.writeFileSync(logFile, JSON.stringify(history, null, 2));
    }

    formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unit = 0;
        
        while (size >= 1024 && unit < units.length - 1) {
            size /= 1024;
            unit++;
        }
        
        return `${size.toFixed(2)} ${units[unit]}`;
    }

    getAge(timestamp) {
        const diff = Date.now() - new Date(timestamp).getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        return 'just now';
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
                    resolve(output.trim());
                } else {
                    reject(new Error(error || `Command failed: ${command}`));
                }
            });
        });
    }
}

// CLI Interface
if (require.main === module) {
    const backup = new BackupRecovery();
    const args = process.argv.slice(2);
    const command = args[0];
    
    const showHelp = () => {
        console.log('Usage: node backup_recovery.cjs <command> [options]');
        console.log('');
        console.log('Commands:');
        console.log('  backup [description]   Create a new backup');
        console.log('  restore <id>          Restore from a backup');
        console.log('  list                  List all backups');
        console.log('  verify <id>           Verify backup integrity');
        console.log('  auto                  Run automated backup');
        console.log('');
        console.log('Options:');
        console.log('  --type <type>         Backup type (manual, auto, restore_point)');
        console.log('  --force               Skip confirmation prompts');
        console.log('  --no-backup           Don\'t create restore point before restoring');
        console.log('');
        console.log('Examples:');
        console.log('  node backup_recovery.cjs backup "Before major update"');
        console.log('  node backup_recovery.cjs restore abc123');
        console.log('  node backup_recovery.cjs list');
    };
    
    (async () => {
        try {
            switch (command) {
                case 'backup':
                    await backup.backup({
                        description: args[1] || 'Manual backup',
                        type: args.includes('--type') ? 
                            args[args.indexOf('--type') + 1] : 'manual'
                    });
                    break;
                    
                case 'restore':
                    if (!args[1]) {
                        console.error('Error: Backup ID required');
                        showHelp();
                        process.exit(1);
                    }
                    await backup.restore(args[1], {
                        force: args.includes('--force'),
                        noBackup: args.includes('--no-backup'),
                        autoConfirm: true // For CLI, auto-confirm
                    });
                    break;
                    
                case 'list':
                    await backup.list();
                    break;
                    
                case 'verify':
                    if (!args[1]) {
                        console.error('Error: Backup ID required');
                        showHelp();
                        process.exit(1);
                    }
                    await backup.verify(args[1]);
                    break;
                    
                case 'auto':
                    await backup.backup({
                        type: 'auto',
                        description: 'Automated backup'
                    });
                    break;
                    
                default:
                    showHelp();
                    process.exit(command ? 1 : 0);
            }
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
    })();
}

module.exports = BackupRecovery;