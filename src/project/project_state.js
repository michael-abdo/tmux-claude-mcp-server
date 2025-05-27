/**
 * Project state management for shared knowledge and file coordination
 * Prevents conflicts and enables knowledge sharing between instances
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

class ProjectState {
    constructor(projectPath) {
        this.projectPath = projectPath;
        this.statePath = path.join(projectPath, '.claude-state.json');
        this.lockPath = path.join(projectPath, '.claude-state.lock');
        this.lockTimeout = 5000; // 5 seconds
    }

    /**
     * Acquire a lock for state modifications
     */
    async acquireLock() {
        const lockId = crypto.randomBytes(16).toString('hex');
        const maxAttempts = 10;
        
        for (let i = 0; i < maxAttempts; i++) {
            try {
                // Try to create lock file
                await fs.writeFile(this.lockPath, JSON.stringify({
                    id: lockId,
                    timestamp: Date.now(),
                    pid: process.pid
                }), { flag: 'wx' }); // wx = exclusive write
                
                return lockId;
            } catch (error) {
                if (error.code === 'EEXIST') {
                    // Lock exists, check if it's stale
                    try {
                        const lockData = JSON.parse(await fs.readFile(this.lockPath, 'utf8'));
                        if (Date.now() - lockData.timestamp > this.lockTimeout) {
                            // Stale lock, remove it
                            await fs.unlink(this.lockPath);
                            continue;
                        }
                    } catch (e) {
                        // Lock file corrupted, remove it
                        await fs.unlink(this.lockPath).catch(() => {});
                        continue;
                    }
                    
                    // Lock is held by another process, wait
                    await new Promise(resolve => setTimeout(resolve, 100));
                } else {
                    throw error;
                }
            }
        }
        
        throw new Error('Failed to acquire lock after ' + maxAttempts + ' attempts');
    }

    /**
     * Release a lock
     */
    async releaseLock(lockId) {
        try {
            const lockData = JSON.parse(await fs.readFile(this.lockPath, 'utf8'));
            if (lockData.id === lockId) {
                await fs.unlink(this.lockPath);
            }
        } catch (error) {
            // Lock already released or doesn't exist
        }
    }

    /**
     * Load state with locking
     */
    async load() {
        try {
            const data = await fs.readFile(this.statePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                // State file doesn't exist yet
                return {
                    version: '1.0',
                    created: new Date().toISOString(),
                    knowledge: {},
                    fileOperations: {},
                    completed: [],
                    dependencies: {},
                    conflicts: []
                };
            }
            throw error;
        }
    }

    /**
     * Save state with locking
     */
    async save(state) {
        const lockId = await this.acquireLock();
        try {
            state.lastModified = new Date().toISOString();
            await fs.writeFile(this.statePath, JSON.stringify(state, null, 2));
        } finally {
            await this.releaseLock(lockId);
        }
    }

    /**
     * Record a completed task
     */
    async recordCompletion(task, details) {
        const lockId = await this.acquireLock();
        try {
            const state = await this.load();
            state.completed = state.completed || [];
            state.completed.push({
                task,
                details,
                timestamp: new Date().toISOString(),
                instanceId: process.env.CLAUDE_INSTANCE_ID || 'unknown'
            });
            await fs.writeFile(this.statePath, JSON.stringify(state, null, 2));
        } finally {
            await this.releaseLock(lockId);
        }
    }

    /**
     * Record a file modification intent
     */
    async recordFileModification(filePath, operation) {
        const lockId = await this.acquireLock();
        try {
            const state = await this.load();
            state.fileOperations = state.fileOperations || {};
            state.fileOperations[filePath] = state.fileOperations[filePath] || [];
            
            const record = {
                operation,
                timestamp: new Date().toISOString(),
                instanceId: process.env.CLAUDE_INSTANCE_ID || 'unknown'
            };
            
            state.fileOperations[filePath].push(record);
            
            // Keep only recent operations (last hour)
            const oneHourAgo = Date.now() - 3600000;
            state.fileOperations[filePath] = state.fileOperations[filePath].filter(op =>
                new Date(op.timestamp).getTime() > oneHourAgo
            );
            
            await fs.writeFile(this.statePath, JSON.stringify(state, null, 2));
            return true;
        } finally {
            await this.releaseLock(lockId);
        }
    }

    /**
     * Check if a file is available for modification
     */
    async checkFileAvailability(filePath) {
        const state = await this.load();
        const ops = state.fileOperations?.[filePath] || [];
        
        // Check for active operations (last 5 minutes)
        const fiveMinutesAgo = Date.now() - 300000;
        const activeOps = ops.filter(op => {
            const opTime = new Date(op.timestamp).getTime();
            return opTime > fiveMinutesAgo && op.operation === 'claimed';
        });
        
        // Check for recent releases
        const recentReleases = ops.filter(op => {
            const opTime = new Date(op.timestamp).getTime();
            return opTime > fiveMinutesAgo && op.operation === 'released';
        });
        
        // File is available if no active claims or if released after last claim
        if (activeOps.length === 0) return true;
        if (recentReleases.length === 0) return false;
        
        const lastClaim = activeOps[activeOps.length - 1];
        const lastRelease = recentReleases[recentReleases.length - 1];
        
        return new Date(lastRelease.timestamp) > new Date(lastClaim.timestamp);
    }

    /**
     * Record discovered knowledge
     */
    async recordKnowledge(key, value) {
        const lockId = await this.acquireLock();
        try {
            const state = await this.load();
            state.knowledge = state.knowledge || {};
            
            state.knowledge[key] = {
                value,
                discoveredBy: process.env.CLAUDE_INSTANCE_ID || 'unknown',
                timestamp: new Date().toISOString()
            };
            
            await fs.writeFile(this.statePath, JSON.stringify(state, null, 2));
        } finally {
            await this.releaseLock(lockId);
        }
    }

    /**
     * Get all knowledge matching a pattern
     */
    async getKnowledge(pattern = null) {
        const state = await this.load();
        const knowledge = state.knowledge || {};
        
        if (!pattern) return knowledge;
        
        // Filter by pattern (simple string matching)
        const filtered = {};
        for (const [key, value] of Object.entries(knowledge)) {
            if (key.includes(pattern)) {
                filtered[key] = value;
            }
        }
        
        return filtered;
    }

    /**
     * Record a task dependency
     */
    async recordDependency(task, dependsOn) {
        const lockId = await this.acquireLock();
        try {
            const state = await this.load();
            state.dependencies = state.dependencies || {};
            
            if (!state.dependencies[task]) {
                state.dependencies[task] = [];
            }
            
            if (!state.dependencies[task].includes(dependsOn)) {
                state.dependencies[task].push(dependsOn);
            }
            
            await fs.writeFile(this.statePath, JSON.stringify(state, null, 2));
        } finally {
            await this.releaseLock(lockId);
        }
    }

    /**
     * Check if a task's dependencies are met
     */
    async checkDependencies(task) {
        const state = await this.load();
        const deps = state.dependencies?.[task] || [];
        const completed = state.completed || [];
        
        const completedTasks = new Set(completed.map(c => c.task));
        const unmetDeps = deps.filter(dep => !completedTasks.has(dep));
        
        return {
            met: unmetDeps.length === 0,
            unmet: unmetDeps,
            total: deps.length
        };
    }

    /**
     * Record a conflict for later resolution
     */
    async recordConflict(description, files, instances) {
        const lockId = await this.acquireLock();
        try {
            const state = await this.load();
            state.conflicts = state.conflicts || [];
            
            state.conflicts.push({
                description,
                files,
                instances,
                timestamp: new Date().toISOString(),
                resolved: false
            });
            
            await fs.writeFile(this.statePath, JSON.stringify(state, null, 2));
        } finally {
            await this.releaseLock(lockId);
        }
    }

    /**
     * Get a summary of project state
     */
    async getSummary() {
        const state = await this.load();
        
        return {
            created: state.created,
            lastModified: state.lastModified,
            completedTasks: state.completed?.length || 0,
            activeFiles: Object.keys(state.fileOperations || {}).length,
            knowledgeItems: Object.keys(state.knowledge || {}).length,
            unresolvedConflicts: (state.conflicts || []).filter(c => !c.resolved).length,
            dependencies: Object.keys(state.dependencies || {}).length
        };
    }
}

export { ProjectState };