/**
 * Enhanced MCP Tools for Phase 3
 * 
 * Extends the base MCP tools with parallel execution support.
 * Maintains the same interface while adding parallel capabilities
 * internally for Manager instances.
 */

import { MCPTools } from './mcp_tools.js';
import { ParallelExecutor } from './parallel_executor.js';
import { CircuitBreaker } from './circuit_breaker.js';
import { tracer } from './distributed_tracer.js';
import { Validator } from './utils/validation.js';

export class EnhancedMCPTools extends MCPTools {
    constructor(instanceManager) {
        super(instanceManager);
        this.parallelExecutors = new Map(); // Track executors per Manager
        this.maxManagerConcurrency = parseInt(process.env.MAX_MANAGER_CONCURRENCY) || 5;
        this.maxSpecialistsPerManager = parseInt(process.env.MAX_SPECIALISTS_PER_MANAGER) || 3;
        this.circuitBreaker = new CircuitBreaker();
        this.tracer = tracer;
    }

    /**
     * Enhanced spawn tool with parallel execution awareness
     */
    async spawn(params, callerRole = null) {
        const result = await super.spawn(params, callerRole);
        
        // If spawning a Manager, set up parallel executor
        if (params.role === 'manager') {
            const executor = new ParallelExecutor(this, {
                maxConcurrent: this.maxSpecialistsPerManager
            });
            this.parallelExecutors.set(result.instanceId, executor);
            console.log(`Parallel executor initialized for Manager ${result.instanceId}`);
        }
        
        return result;
    }

    /**
     * Enhanced send with circuit breaker protection
     */
    async send(params, callerRole = null) {
        const { instanceId } = params;
        
        // Use circuit breaker for protection
        return await this.circuitBreaker.execute(instanceId, async () => {
            return await super.send(params, callerRole);
        });
    }

    /**
     * Enhanced read with circuit breaker protection
     */
    async read(params, callerRole = null) {
        const { instanceId } = params;
        
        // Use circuit breaker for protection
        return await this.circuitBreaker.execute(instanceId, async () => {
            return await super.read(params, callerRole);
        });
    }

    /**
     * Enhanced terminate tool that cleans up parallel executors
     */
    async terminate(params, callerRole = null) {
        const { instanceId } = params;
        
        // If terminating a Manager, clean up its executor
        if (this.parallelExecutors.has(instanceId)) {
            const executor = this.parallelExecutors.get(instanceId);
            await executor.emergencyStop();
            this.parallelExecutors.delete(instanceId);
            console.log(`Cleaned up parallel executor for Manager ${instanceId}`);
        }
        
        // Reset circuit breaker for terminated instance
        this.circuitBreaker.reset(instanceId);
        
        return await super.terminate(params, callerRole);
    }

    /**
     * New tool: Execute parallel tasks (for Manager instances)
     * This enables Managers to run multiple Specialists concurrently
     */
    async executeParallel(params, callerRole = null) {
        const { managerId, tasks, workDir } = params;
        
        // Validate parameters using shared validation
        Validator.validateRequired({ managerId, tasks, workDir }, ['managerId', 'tasks', 'workDir']);
        
        // Only Managers can execute parallel tasks
        if (callerRole !== 'manager') {
            throw new Error('Only Manager instances can execute parallel tasks');
        }
        
        // Get the executor for this Manager
        const executor = this.parallelExecutors.get(managerId);
        if (!executor) {
            throw new Error(`No parallel executor found for Manager ${managerId}`);
        }
        
        // Start trace for parallel execution
        const trace = this.tracer.startTrace('parallel_execution', {
            managerId,
            taskCount: tasks.length,
            workDir
        });
        
        try {
            const execSpan = trace ? trace.startSpan('execute_tasks') : null;
            if (execSpan) {
                execSpan.setTag('manager_id', managerId);
                execSpan.setTag('task_count', tasks.length);
            }
            
            const results = await executor.executeParallel(tasks, managerId, workDir);
            
            if (execSpan) {
                execSpan.setTag('completed', results.completed);
                execSpan.setTag('failed', results.failed);
                execSpan.endSpan('success');
            }
            
            // Record metrics
            if (this.instanceManager.stateStore) {
                const metricsSpan = trace ? trace.startSpan('record_metrics') : null;
                
                await this.instanceManager.stateStore.recordMetric('parallel_execution', {
                    managerId,
                    totalTasks: results.total,
                    completed: results.completed,
                    failed: results.failed,
                    duration: results.duration
                });
                
                if (metricsSpan) {
                    metricsSpan.endSpan('success');
                }
            }
            
            if (trace) {
                trace.endTrace('success');
            }
            
            return results;
        } catch (error) {
            if (trace) {
                trace.endTrace('error', error);
            }
            throw new Error(`Parallel execution failed: ${error.message}`);
        }
    }

    /**
     * New tool: Get parallel execution status
     */
    async getParallelStatus(params, callerRole = null) {
        const { managerId } = params;
        
        // Validate parameters using shared validation
        Validator.checkSpecialistAccess(callerRole);
        Validator.validateManagerId(managerId);
        
        const executor = this.parallelExecutors.get(managerId);
        if (!executor) {
            return { status: 'no_executor', managerId };
        }
        
        return executor.getStatus();
    }

    /**
     * Enhanced list tool with parallel execution awareness
     */
    async list(params = {}, callerRole = null) {
        const instances = await super.list(params, callerRole);
        
        // Add parallel execution status for Managers
        const enrichedInstances = instances.map(instance => {
            if (instance.role === 'manager' && this.parallelExecutors.has(instance.instanceId)) {
                const executor = this.parallelExecutors.get(instance.instanceId);
                const parallelStatus = executor.getStatus();
                return {
                    ...instance,
                    parallelExecution: {
                        active: parallelStatus.activeSpecialists,
                        queued: parallelStatus.queuedTasks,
                        completed: parallelStatus.completedTasks,
                        failed: parallelStatus.failedTasks
                    }
                };
            }
            return instance;
        });
        
        return enrichedInstances;
    }

    /**
     * New tool: Distribute work across multiple Managers
     * This enables the Executive to balance load across Managers
     */
    async distributeWork(params, callerRole = null) {
        const { tasks, strategy = 'round-robin' } = params;
        
        // Only Executive can distribute work
        if (callerRole !== 'executive') {
            throw new Error('Only Executive instances can distribute work across Managers');
        }
        
        // Get all active Managers
        const managers = await this.list({ role: 'manager' }, 'executive');
        const activeManagers = managers.filter(m => m.status === 'active');
        
        if (activeManagers.length === 0) {
            throw new Error('No active Managers available for work distribution');
        }
        
        // Distribute tasks based on strategy
        const distribution = this.distributeTasks(tasks, activeManagers, strategy);
        
        // Send tasks to each Manager
        const results = [];
        for (const { managerId, assignedTasks } of distribution) {
            try {
                await this.send({
                    instanceId: managerId,
                    text: `PARALLEL_EXECUTE: ${JSON.stringify(assignedTasks)}`
                }, 'executive');
                
                results.push({
                    managerId,
                    tasksAssigned: assignedTasks.length,
                    status: 'assigned'
                });
            } catch (error) {
                results.push({
                    managerId,
                    tasksAssigned: 0,
                    status: 'failed',
                    error: error.message
                });
            }
        }
        
        return {
            strategy,
            managers: activeManagers.length,
            totalTasks: tasks.length,
            distribution: results
        };
    }

    /**
     * Distribute tasks across Managers based on strategy
     */
    distributeTasks(tasks, managers, strategy) {
        const distribution = managers.map(m => ({
            managerId: m.instanceId,
            assignedTasks: [],
            currentLoad: m.parallelExecution?.active || 0
        }));
        
        if (strategy === 'round-robin') {
            // Simple round-robin distribution
            tasks.forEach((task, index) => {
                const managerIndex = index % managers.length;
                distribution[managerIndex].assignedTasks.push(task);
            });
        } else if (strategy === 'least-loaded') {
            // Assign to least loaded Manager
            tasks.forEach(task => {
                // Sort by current load
                distribution.sort((a, b) => a.currentLoad - b.currentLoad);
                distribution[0].assignedTasks.push(task);
                distribution[0].currentLoad++;
            });
        } else if (strategy === 'capacity-aware') {
            // Consider Manager capacity
            tasks.forEach(task => {
                // Find Manager with most available capacity
                const available = distribution.map(d => ({
                    ...d,
                    capacity: this.maxSpecialistsPerManager - d.currentLoad
                })).filter(d => d.capacity > 0);
                
                if (available.length > 0) {
                    // Sort by available capacity
                    available.sort((a, b) => b.capacity - a.capacity);
                    available[0].assignedTasks.push(task);
                    available[0].currentLoad++;
                }
            });
        }
        
        return distribution;
    }

    /**
     * Get enhanced tool definitions including Phase 3 tools
     */
    getToolDefinitions() {
        const baseTools = super.getToolDefinitions();
        
        // Add Phase 3 specific tools
        const phase3Tools = [
            {
                name: 'executeParallel',
                description: 'Execute multiple tasks in parallel using Specialist instances (Manager only)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        managerId: {
                            type: 'string',
                            description: 'ID of the Manager coordinating the parallel execution'
                        },
                        tasks: {
                            type: 'array',
                            description: 'Array of task objects to execute in parallel',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    name: { type: 'string' },
                                    context: { type: 'string' },
                                    instruction: { type: 'string' },
                                    completionPattern: { type: 'string' }
                                },
                                required: ['id', 'name', 'context', 'instruction']
                            }
                        },
                        workDir: {
                            type: 'string',
                            description: 'Working directory for the Specialist instances'
                        }
                    },
                    required: ['managerId', 'tasks', 'workDir']
                }
            },
            {
                name: 'getParallelStatus',
                description: 'Get parallel execution status for a Manager',
                inputSchema: {
                    type: 'object',
                    properties: {
                        managerId: {
                            type: 'string',
                            description: 'ID of the Manager to check'
                        }
                    },
                    required: ['managerId']
                }
            },
            {
                name: 'distributeWork',
                description: 'Distribute tasks across multiple Managers (Executive only)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        tasks: {
                            type: 'array',
                            description: 'Tasks to distribute across Managers'
                        },
                        strategy: {
                            type: 'string',
                            enum: ['round-robin', 'least-loaded', 'capacity-aware'],
                            description: 'Distribution strategy to use'
                        }
                    },
                    required: ['tasks']
                }
            }
        ];
        
        return [...baseTools, ...phase3Tools];
    }

    /**
     * Execute a tool with enhanced capabilities
     */
    async executeTool(toolName, params, callerRole = null) {
        // Handle Phase 3 specific tools
        switch (toolName) {
            case 'executeParallel':
                return await this.executeParallel(params, callerRole);
            case 'getParallelStatus':
                return await this.getParallelStatus(params, callerRole);
            case 'distributeWork':
                return await this.distributeWork(params, callerRole);
            case 'getProgress':
                return await this.getProgress(params, callerRole);
            case 'getGitBranch':
                return await this.getGitBranch(params, callerRole);
            case 'mergeBranch':
                return await this.mergeBranch(params, callerRole);
            default:
                // Fall back to base implementation
                return await super.executeTool(toolName, params, callerRole);
        }
    }
    
    /**
     * Tool: getProgress
     * Get todo-based progress for an instance
     * 
     * @param {Object} params - Tool parameters
     * @param {string} params.instanceId - Instance to check
     * @param {string} callerRole - Role of the caller
     */
    async getProgress(params, callerRole) {
        const { instanceId } = params;
        
        // Validate parameters using shared validation
        Validator.validateInstanceId(instanceId);
        
        // Allow all roles to check progress
        const progress = this.instanceManager.getInstanceProgress(instanceId);
        
        return {
            instanceId,
            progress,
            message: `Progress for ${instanceId}: ${progress.completed}/${progress.total} tasks completed (${progress.completionRate}%)`
        };
    }
    
    /**
     * Tool: getGitBranch
     * Get the git branch for a specialist instance
     * 
     * @param {Object} params - Tool parameters
     * @param {string} params.instanceId - Instance ID
     * @param {string} callerRole - Role of the caller
     */
    async getGitBranch(params, callerRole) {
        const { instanceId } = params;
        
        // Validate parameters using shared validation
        Validator.validateInstanceId(instanceId);
        
        const instances = await this.instanceManager.listInstances();
        const instance = instances.find(i => i.instanceId === instanceId);
        
        if (!instance) {
            throw new Error(`Instance not found: ${instanceId}`);
        }
        
        return {
            instanceId,
            branchName: instance.branchName || 'main',
            role: instance.role
        };
    }
    
    /**
     * Tool: mergeBranch
     * Merge a specialist's branch back to parent
     * 
     * @param {Object} params - Tool parameters
     * @param {string} params.instanceId - Specialist instance ID
     * @param {string} params.targetBranch - Target branch (default: main)
     * @param {boolean} params.deleteBranch - Delete branch after merge
     * @param {string} callerRole - Role of the caller
     */
    async mergeBranch(params, callerRole) {
        const { instanceId, targetBranch = 'main', deleteBranch = false } = params;
        
        if (callerRole === 'specialist') {
            throw new Error('Specialists cannot merge branches directly');
        }
        
        const instances = await this.instanceManager.listInstances();
        const instance = instances.find(i => i.instanceId === instanceId);
        
        if (!instance) {
            throw new Error(`Instance not found: ${instanceId}`);
        }
        
        if (!instance.branchName) {
            throw new Error(`No branch found for instance: ${instanceId}`);
        }
        
        const { gitBranchManager } = await import('./git_branch_manager.js');
        
        const success = await gitBranchManager.mergeSpecialistWork({
            branchName: instance.branchName,
            targetBranch,
            workDir: instance.projectDir,
            deleteBranch
        });
        
        return {
            success,
            message: success 
                ? `Merged ${instance.branchName} into ${targetBranch}`
                : `Failed to merge ${instance.branchName}`
        };
    }
}