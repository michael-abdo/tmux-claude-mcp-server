#!/usr/bin/env node

/**
 * Claude Todo Monitor
 * 
 * Implements read-only monitoring of Claude's todo files for progress tracking.
 * This provides "free" progress monitoring without additional API calls.
 * 
 * From architecture docs: "Free Progress Tracking via Todo Monitoring"
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { EventEmitter } from 'events';

export class TodoMonitor extends EventEmitter {
    constructor() {
        super();
        this.todoDir = path.join(os.homedir(), '.claude', 'todos');
        this.pollInterval = 5000; // 5 seconds
        this.monitoring = false;
        this.instanceTodos = new Map(); // instanceId -> todos
        this.watchers = new Map(); // instanceId -> watcher interval
    }

    /**
     * Start monitoring todos for a specific instance
     * @param {string} instanceId - The instance to monitor
     * @param {string} projectPath - The project path for the instance
     */
    async startMonitoring(instanceId, projectPath) {
        if (this.watchers.has(instanceId)) {
            console.log(`Already monitoring todos for ${instanceId}`);
            return;
        }

        console.log(`Starting todo monitoring for ${instanceId}`);
        
        // Initial read
        await this.readInstanceTodos(instanceId, projectPath);
        
        // Set up polling
        const interval = setInterval(async () => {
            try {
                const previousTodos = this.instanceTodos.get(instanceId) || [];
                await this.readInstanceTodos(instanceId, projectPath);
                const currentTodos = this.instanceTodos.get(instanceId) || [];
                
                // Detect changes
                if (JSON.stringify(previousTodos) !== JSON.stringify(currentTodos)) {
                    this.emit('todosChanged', {
                        instanceId,
                        todos: currentTodos,
                        previousCount: previousTodos.length,
                        currentCount: currentTodos.length
                    });
                }
            } catch (error) {
                console.error(`Error monitoring todos for ${instanceId}:`, error);
            }
        }, this.pollInterval);
        
        this.watchers.set(instanceId, interval);
    }

    /**
     * Stop monitoring todos for a specific instance
     * @param {string} instanceId - The instance to stop monitoring
     */
    stopMonitoring(instanceId) {
        const interval = this.watchers.get(instanceId);
        if (interval) {
            clearInterval(interval);
            this.watchers.delete(instanceId);
            this.instanceTodos.delete(instanceId);
            console.log(`Stopped todo monitoring for ${instanceId}`);
        }
    }

    /**
     * Read todos for a specific instance
     * @param {string} instanceId - The instance ID
     * @param {string} projectPath - The project path
     * @returns {Promise<Array>} Array of todo items
     */
    async readInstanceTodos(instanceId, projectPath) {
        try {
            // Claude stores todos in project-specific JSON files
            const projectName = path.basename(projectPath);
            const todoFile = path.join(this.todoDir, `${projectName}.json`);
            
            // Check if file exists
            try {
                await fs.access(todoFile);
            } catch {
                // No todo file yet
                this.instanceTodos.set(instanceId, []);
                return [];
            }
            
            // Read and parse todos
            const content = await fs.readFile(todoFile, 'utf-8');
            const todoData = JSON.parse(content);
            
            // Extract relevant todos (filter by timestamp if needed)
            const todos = todoData.todos || [];
            
            this.instanceTodos.set(instanceId, todos);
            return todos;
        } catch (error) {
            console.error(`Error reading todos for ${instanceId}:`, error);
            return [];
        }
    }

    /**
     * Get current todos for an instance
     * @param {string} instanceId - The instance ID
     * @returns {Array} Current todos
     */
    getTodos(instanceId) {
        return this.instanceTodos.get(instanceId) || [];
    }

    /**
     * Get progress summary for an instance
     * @param {string} instanceId - The instance ID
     * @returns {Object} Progress summary
     */
    getProgress(instanceId) {
        const todos = this.getTodos(instanceId);
        const total = todos.length;
        const completed = todos.filter(t => t.status === 'completed').length;
        const inProgress = todos.filter(t => t.status === 'in_progress').length;
        const pending = todos.filter(t => t.status === 'pending').length;
        
        return {
            total,
            completed,
            inProgress,
            pending,
            completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
        };
    }

    /**
     * Get all monitored instances and their progress
     * @returns {Object} Map of instanceId to progress
     */
    getAllProgress() {
        const progress = {};
        for (const instanceId of this.watchers.keys()) {
            progress[instanceId] = this.getProgress(instanceId);
        }
        return progress;
    }

    /**
     * Clean up all monitoring
     */
    cleanup() {
        for (const [instanceId, interval] of this.watchers) {
            clearInterval(interval);
        }
        this.watchers.clear();
        this.instanceTodos.clear();
        console.log('Todo monitoring cleaned up');
    }
}

// Export singleton instance
export const todoMonitor = new TodoMonitor();

// Handle cleanup on exit
process.on('SIGINT', () => todoMonitor.cleanup());
process.on('SIGTERM', () => todoMonitor.cleanup());