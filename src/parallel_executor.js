/**
 * Parallel Executor for Phase 3
 * 
 * Enables full parallelism for Manager instances to run multiple
 * Specialists concurrently. This module provides the core parallel
 * execution capabilities while maintaining the same MCP interface.
 * 
 * Key features:
 * - Concurrent specialist execution with configurable limits
 * - Task queue management for job distribution
 * - Load balancing across available specialists
 * - Health monitoring and auto-recovery
 */

export class ParallelExecutor {
    constructor(mcpTools, options = {}) {
        this.mcpTools = mcpTools;
        this.maxConcurrent = options.maxConcurrent || 5;
        this.activeSpecialists = new Map();
        this.taskQueue = [];
        this.completedTasks = [];
        this.failedTasks = [];
        
        console.log(`=== Parallel Executor initialized (max concurrent: ${this.maxConcurrent}) ===`);
    }

    /**
     * Execute multiple tasks in parallel using specialist instances.
     * This is the Phase 3 enhancement for Manager instances.
     * 
     * @param {Array} tasks - Array of task objects with context and instructions
     * @param {string} managerId - ID of the Manager coordinating these tasks
     * @param {string} workDir - Working directory for specialists
     * @returns {Promise<Object>} Results of all task executions
     */
    async executeParallel(tasks, managerId, workDir) {
        console.log(`Starting parallel execution of ${tasks.length} tasks for Manager ${managerId}`);
        
        // Queue all tasks
        this.taskQueue = [...tasks];
        const results = [];
        
        // Process tasks in batches based on maxConcurrent limit
        while (this.taskQueue.length > 0 || this.activeSpecialists.size > 0) {
            // Spawn new specialists up to the limit
            while (this.activeSpecialists.size < this.maxConcurrent && this.taskQueue.length > 0) {
                const task = this.taskQueue.shift();
                const promise = this.executeTask(task, managerId, workDir);
                results.push(promise);
            }
            
            // Wait for at least one to complete before continuing
            if (this.activeSpecialists.size > 0) {
                await this.waitForAnyCompletion();
            }
        }
        
        // Wait for all remaining tasks to complete
        const allResults = await Promise.allSettled(results);
        
        return {
            total: tasks.length,
            completed: this.completedTasks.length,
            failed: this.failedTasks.length,
            results: allResults,
            completedTasks: this.completedTasks,
            failedTasks: this.failedTasks
        };
    }

    /**
     * Execute a single task with a specialist instance.
     * Includes automatic retry on failure.
     */
    async executeTask(task, managerId, workDir) {
        let specialist = null;
        let retries = 0;
        const maxRetries = 2;
        
        while (retries <= maxRetries) {
            try {
                // Spawn specialist for this task
                specialist = await this.mcpTools.spawn({
                    role: 'specialist',
                    workDir: workDir,
                    context: task.context,
                    parentId: managerId
                });
                
                // Track active specialist
                this.activeSpecialists.set(specialist.instanceId, {
                    task: task,
                    startTime: Date.now(),
                    specialist: specialist
                });
                
                console.log(`Specialist ${specialist.instanceId} started task: ${task.name}`);
                
                // Send git branch setup for specialist
                await this.mcpTools.send({
                    instanceId: specialist.instanceId,
                    text: `git checkout -b specialist-${specialist.instanceId}-${task.id}`
                });
                
                // Send task instructions
                await this.mcpTools.send({
                    instanceId: specialist.instanceId,
                    text: task.instruction
                });
                
                // Monitor task progress
                const result = await this.monitorTaskCompletion(specialist.instanceId, task);
                
                // Task completed successfully
                this.completedTasks.push({
                    task: task,
                    specialist: specialist.instanceId,
                    result: result,
                    duration: Date.now() - this.activeSpecialists.get(specialist.instanceId).startTime
                });
                
                // Clean up specialist
                this.activeSpecialists.delete(specialist.instanceId);
                await this.mcpTools.terminate({ instanceId: specialist.instanceId });
                
                return result;
                
            } catch (error) {
                console.error(`Task ${task.name} failed on attempt ${retries + 1}: ${error.message}`);
                
                // Clean up failed specialist if it exists
                if (specialist && this.activeSpecialists.has(specialist.instanceId)) {
                    this.activeSpecialists.delete(specialist.instanceId);
                    try {
                        await this.mcpTools.terminate({ instanceId: specialist.instanceId });
                    } catch (e) {
                        // Ignore termination errors
                    }
                }
                
                retries++;
                if (retries > maxRetries) {
                    this.failedTasks.push({
                        task: task,
                        error: error.message,
                        attempts: retries
                    });
                    throw error;
                }
                
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    /**
     * Monitor task completion by checking output patterns.
     * Returns when task is detected as complete or timeout occurs.
     */
    async monitorTaskCompletion(specialistId, task, timeoutMs = 300000) { // 5 min timeout
        const startTime = Date.now();
        const checkInterval = 5000; // Check every 5 seconds
        
        while (Date.now() - startTime < timeoutMs) {
            try {
                // Read specialist output
                const output = await this.mcpTools.read({
                    instanceId: specialistId,
                    lines: 100
                });
                
                // Check for task completion patterns
                if (this.isTaskComplete(output.output, task)) {
                    return {
                        status: 'completed',
                        output: output.output
                    };
                }
                
                // Check for error patterns
                if (this.hasTaskFailed(output.output)) {
                    throw new Error('Task failed - error detected in output');
                }
                
            } catch (error) {
                // Instance might be dead
                const instances = await this.mcpTools.list({ role: 'specialist' });
                const stillActive = instances.find(i => i.instanceId === specialistId);
                
                if (!stillActive) {
                    throw new Error('Specialist instance died unexpectedly');
                }
            }
            
            // Wait before next check
            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
        
        throw new Error(`Task timeout after ${timeoutMs}ms`);
    }

    /**
     * Check if task output indicates completion.
     * Can be customized based on task type.
     */
    isTaskComplete(output, task) {
        // Default completion patterns
        const completionPatterns = [
            /task complete/i,
            /implementation complete/i,
            /all tests pass/i,
            /successfully committed/i,
            /pushed branch/i
        ];
        
        // Task-specific patterns
        if (task.completionPattern) {
            completionPatterns.push(new RegExp(task.completionPattern, 'i'));
        }
        
        return completionPatterns.some(pattern => pattern.test(output));
    }

    /**
     * Check if task output indicates failure.
     */
    hasTaskFailed(output) {
        const failurePatterns = [
            /fatal error/i,
            /unhandled exception/i,
            /task failed/i,
            /cannot continue/i
        ];
        
        return failurePatterns.some(pattern => pattern.test(output));
    }

    /**
     * Wait for any active specialist to complete.
     * Used for managing concurrency limits.
     */
    async waitForAnyCompletion() {
        if (this.activeSpecialists.size === 0) return;
        
        // Check all active specialists every second
        while (this.activeSpecialists.size > 0) {
            for (const [specialistId, info] of this.activeSpecialists) {
                try {
                    // Quick check if specialist is still active
                    const instances = await this.mcpTools.list({ role: 'specialist' });
                    const stillActive = instances.find(i => i.instanceId === specialistId);
                    
                    if (!stillActive) {
                        // Specialist died or completed
                        console.log(`Specialist ${specialistId} is no longer active`);
                        this.activeSpecialists.delete(specialistId);
                        return;
                    }
                    
                    // Check if task completed
                    const output = await this.mcpTools.read({
                        instanceId: specialistId,
                        lines: 50
                    });
                    
                    if (this.isTaskComplete(output.output, info.task)) {
                        console.log(`Specialist ${specialistId} completed task`);
                        return;
                    }
                    
                } catch (error) {
                    // Specialist might be gone
                    this.activeSpecialists.delete(specialistId);
                    return;
                }
            }
            
            // Wait before next check round
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    /**
     * Get current execution status.
     */
    getStatus() {
        return {
            activeSpecialists: this.activeSpecialists.size,
            queuedTasks: this.taskQueue.length,
            completedTasks: this.completedTasks.length,
            failedTasks: this.failedTasks.length,
            maxConcurrent: this.maxConcurrent
        };
    }

    /**
     * Emergency stop - terminate all active specialists.
     */
    async emergencyStop() {
        console.log('Emergency stop initiated - terminating all active specialists');
        
        const terminationPromises = [];
        for (const [specialistId] of this.activeSpecialists) {
            terminationPromises.push(
                this.mcpTools.terminate({ instanceId: specialistId, cascade: false })
                    .catch(e => console.error(`Failed to terminate ${specialistId}: ${e.message}`))
            );
        }
        
        await Promise.allSettled(terminationPromises);
        this.activeSpecialists.clear();
        this.taskQueue = [];
    }
}