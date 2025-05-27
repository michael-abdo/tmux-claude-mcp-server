#!/usr/bin/env node

/**
 * Test Cleanup Utility
 * Provides comprehensive cleanup mechanisms for integration tests
 * to prevent resource leaks and test interference
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

export class TestCleanupUtility {
    constructor() {
        this.resources = new Map(); // Track all resources by type
        this.cleanupHandlers = new Map(); // Custom cleanup handlers
        this.setupExitHandlers();
    }

    /**
     * Register a resource for cleanup
     * @param {string} type - Resource type (tmux, directory, file, etc.)
     * @param {string} identifier - Unique identifier for the resource
     * @param {Object} metadata - Additional data needed for cleanup
     */
    registerResource(type, identifier, metadata = {}) {
        if (!this.resources.has(type)) {
            this.resources.set(type, new Map());
        }
        this.resources.get(type).set(identifier, {
            ...metadata,
            registeredAt: new Date()
        });
    }

    /**
     * Unregister a resource (already cleaned up)
     */
    unregisterResource(type, identifier) {
        if (this.resources.has(type)) {
            this.resources.get(type).delete(identifier);
        }
    }

    /**
     * Register a custom cleanup handler for a resource type
     */
    registerCleanupHandler(type, handler) {
        this.cleanupHandlers.set(type, handler);
    }

    /**
     * Clean up all resources of a specific type
     */
    async cleanupType(type, options = {}) {
        const { force = false, silent = false } = options;
        
        if (!this.resources.has(type)) {
            return { cleaned: 0, failed: 0 };
        }

        const resources = this.resources.get(type);
        const results = { cleaned: 0, failed: 0 };

        for (const [identifier, metadata] of resources.entries()) {
            try {
                await this.cleanupResource(type, identifier, metadata, { force, silent });
                resources.delete(identifier);
                results.cleaned++;
            } catch (error) {
                results.failed++;
                if (!silent) {
                    console.error(`Failed to cleanup ${type} '${identifier}': ${error.message}`);
                }
            }
        }

        return results;
    }

    /**
     * Clean up a specific resource
     */
    async cleanupResource(type, identifier, metadata = {}, options = {}) {
        const { force = false, silent = false } = options;

        // Use custom handler if available
        if (this.cleanupHandlers.has(type)) {
            return await this.cleanupHandlers.get(type)(identifier, metadata, options);
        }

        // Built-in handlers
        switch (type) {
            case 'tmux':
                await this.cleanupTmuxSession(identifier, { force, silent });
                break;
            
            case 'directory':
                await this.cleanupDirectory(metadata.path || identifier, { force, silent });
                break;
            
            case 'file':
                await this.cleanupFile(metadata.path || identifier, { silent });
                break;
            
            case 'git-worktree':
                await this.cleanupGitWorktree(identifier, metadata, { force, silent });
                break;
            
            case 'process':
                await this.cleanupProcess(metadata.pid || identifier, { force, silent });
                break;
            
            default:
                throw new Error(`Unknown resource type: ${type}`);
        }
    }

    /**
     * Clean up tmux session
     */
    async cleanupTmuxSession(sessionName, options = {}) {
        const { force = false, silent = false } = options;
        
        try {
            // Check if session exists
            await execAsync(`tmux has-session -t ${sessionName} 2>/dev/null`);
            
            // Kill the session
            const killCmd = force ? 
                `tmux kill-session -t ${sessionName}` : 
                `tmux kill-session -t ${sessionName} 2>/dev/null || true`;
            
            await execAsync(killCmd);
            
            if (!silent) {
                console.log(`   🧹 Cleaned up tmux session: ${sessionName}`);
            }
        } catch (error) {
            // Session doesn't exist - that's fine
            if (!error.message.includes('no session') && !error.message.includes('exited with code 1')) {
                throw error;
            }
        }
    }

    /**
     * Clean up directory
     */
    async cleanupDirectory(dirPath, options = {}) {
        const { force = false, silent = false } = options;
        
        try {
            await fs.access(dirPath);
            await fs.rm(dirPath, { recursive: true, force });
            
            if (!silent) {
                console.log(`   🧹 Cleaned up directory: ${dirPath}`);
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }

    /**
     * Clean up file
     */
    async cleanupFile(filePath, options = {}) {
        const { silent = false } = options;
        
        try {
            await fs.unlink(filePath);
            if (!silent) {
                console.log(`   🧹 Cleaned up file: ${filePath}`);
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }

    /**
     * Clean up git worktree
     */
    async cleanupGitWorktree(worktreeName, metadata = {}, options = {}) {
        const { force = false, silent = false } = options;
        const { repoPath } = metadata;
        
        try {
            const removeCmd = force ?
                `git worktree remove ${worktreeName} --force` :
                `git worktree remove ${worktreeName}`;
            
            await execAsync(removeCmd, { cwd: repoPath });
            
            if (!silent) {
                console.log(`   🧹 Cleaned up git worktree: ${worktreeName}`);
            }
        } catch (error) {
            // Worktree doesn't exist or already removed
            if (!error.message.includes('not a working tree')) {
                throw error;
            }
        }
    }

    /**
     * Clean up process
     */
    async cleanupProcess(pid, options = {}) {
        const { force = false, silent = false } = options;
        
        try {
            const signal = force ? 'SIGKILL' : 'SIGTERM';
            process.kill(pid, signal);
            
            if (!silent) {
                console.log(`   🧹 Cleaned up process: ${pid}`);
            }
        } catch (error) {
            if (error.code !== 'ESRCH') { // Process doesn't exist
                throw error;
            }
        }
    }

    /**
     * Clean up all registered resources
     */
    async cleanupAll(options = {}) {
        const results = {
            total: 0,
            cleaned: 0,
            failed: 0,
            byType: {}
        };

        console.log('🧹 Starting comprehensive cleanup...');

        for (const type of this.resources.keys()) {
            const typeResults = await this.cleanupType(type, options);
            results.byType[type] = typeResults;
            results.cleaned += typeResults.cleaned;
            results.failed += typeResults.failed;
            results.total += typeResults.cleaned + typeResults.failed;
        }

        if (results.total > 0) {
            console.log(`✅ Cleanup complete: ${results.cleaned} cleaned, ${results.failed} failed`);
        }

        return results;
    }

    /**
     * Setup exit handlers to ensure cleanup on process exit
     */
    setupExitHandlers() {
        const cleanup = async (signal) => {
            console.log(`\n⚠️  Process ${signal} - running emergency cleanup...`);
            await this.cleanupAll({ force: true, silent: true });
            process.exit(signal === 'SIGINT' ? 130 : 1);
        };

        process.on('SIGINT', () => cleanup('SIGINT'));
        process.on('SIGTERM', () => cleanup('SIGTERM'));
        process.on('uncaughtException', async (error) => {
            console.error('Uncaught exception:', error);
            await cleanup('uncaughtException');
        });
    }

    /**
     * Get cleanup statistics
     */
    getStats() {
        const stats = {};
        for (const [type, resources] of this.resources.entries()) {
            stats[type] = resources.size;
        }
        return stats;
    }

    /**
     * Clean up stale resources based on age
     */
    async cleanupStale(maxAgeMinutes = 60, options = {}) {
        const now = new Date();
        const maxAge = maxAgeMinutes * 60 * 1000;
        const results = { cleaned: 0, failed: 0 };

        for (const [type, resources] of this.resources.entries()) {
            for (const [identifier, metadata] of resources.entries()) {
                const age = now - metadata.registeredAt;
                if (age > maxAge) {
                    try {
                        await this.cleanupResource(type, identifier, metadata, options);
                        resources.delete(identifier);
                        results.cleaned++;
                    } catch (error) {
                        results.failed++;
                    }
                }
            }
        }

        return results;
    }
}

/**
 * Test-specific cleanup wrapper
 */
export class TestEnvironmentCleaner extends TestCleanupUtility {
    constructor(testPrefix = 'test_') {
        super();
        this.testPrefix = testPrefix;
        this.tempBaseDir = path.join(os.tmpdir(), 'tmux-claude-tests');
    }

    /**
     * Clean up all tmux sessions with test prefix
     */
    async cleanupAllTestSessions() {
        try {
            const { stdout } = await execAsync('tmux ls 2>/dev/null || true');
            const sessions = stdout.split('\n')
                .filter(line => line.trim())
                .map(line => line.split(':')[0])
                .filter(name => name.startsWith(this.testPrefix));

            console.log(`Found ${sessions.length} test sessions to clean up`);
            
            for (const session of sessions) {
                await this.cleanupTmuxSession(session);
            }
        } catch (error) {
            console.error('Error cleaning test sessions:', error.message);
        }
    }

    /**
     * Clean up all test directories
     */
    async cleanupAllTestDirectories() {
        try {
            await fs.access(this.tempBaseDir);
            const entries = await fs.readdir(this.tempBaseDir);
            
            for (const entry of entries) {
                const fullPath = path.join(this.tempBaseDir, entry);
                const stats = await fs.stat(fullPath);
                
                // Clean directories older than 1 hour
                const ageHours = (Date.now() - stats.mtime) / (1000 * 60 * 60);
                if (ageHours > 1) {
                    await this.cleanupDirectory(fullPath);
                }
            }
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error('Error cleaning test directories:', error.message);
            }
        }
    }

    /**
     * Full test environment cleanup
     */
    async cleanupTestEnvironment() {
        console.log('🧹 Cleaning up test environment...\n');
        
        // Clean registered resources
        await this.cleanupAll();
        
        // Clean stale sessions
        await this.cleanupAllTestSessions();
        
        // Clean old test directories  
        await this.cleanupAllTestDirectories();
        
        console.log('\n✅ Test environment cleanup complete');
    }
}

// Example usage and self-test
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🧪 Testing Cleanup Utility\n');

    const cleaner = new TestCleanupUtility();

    // Test resource registration
    cleaner.registerResource('tmux', 'test_session_1');
    cleaner.registerResource('directory', 'test_dir_1', { path: '/tmp/test_dir_1' });
    cleaner.registerResource('file', 'test_file_1', { path: '/tmp/test_file_1.txt' });

    console.log('Registered resources:', cleaner.getStats());

    // Test environment cleaner
    const envCleaner = new TestEnvironmentCleaner();
    await envCleaner.cleanupTestEnvironment();

    console.log('\n✅ Cleanup utility test complete');
}