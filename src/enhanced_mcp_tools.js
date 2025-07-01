/**
 * Enhanced MCP Tools for Phase 3
 * 
 * Extends the base MCP tools with parallel execution support.
 * Maintains the same interface while adding parallel capabilities
 * internally for Manager instances.
 */

// Standalone enhanced MCP tools - consolidated from multiple implementations
import { ParallelExecutor } from './parallel_executor.js';
import { CircuitBreaker } from './circuit_breaker.js';
import { tracer } from './distributed_tracer.js';
import { sharedWorkspaceGitManager } from './shared_workspace_git_manager.js';

export class EnhancedMCPTools {
    constructor(instanceManager) {
        this.instanceManager = instanceManager;
        this.parallelExecutors = new Map(); // Track executors per Manager
        this.maxManagerConcurrency = parseInt(process.env.MAX_MANAGER_CONCURRENCY) || 5;
        this.maxSpecialistsPerManager = parseInt(process.env.MAX_SPECIALISTS_PER_MANAGER) || 3;
        this.circuitBreaker = new CircuitBreaker();
        this.tracer = tracer;
        this.gitManager = sharedWorkspaceGitManager;
    }

    /**
     * Tool: spawn
     * Create a new Claude instance with role and context.
     * Enhanced with parallel execution awareness and workspace modes.
     */
    async spawn(params, callerRole = null) {
        const { role, workDir, context, parentId, workspaceMode = 'isolated' } = params;
        
        // Validate parameters
        if (!role || !workDir || !context) {
            throw new Error('Missing required parameters: role, workDir, context');
        }
        
        if (!['executive', 'manager', 'specialist'].includes(role)) {
            throw new Error('Invalid role. Must be: executive, manager, or specialist');
        }
        
        // Validate workspace mode
        if (!['isolated', 'shared'].includes(workspaceMode)) {
            throw new Error('Invalid workspaceMode. Must be: isolated or shared');
        }
        
        // Only managers can use shared mode
        if (workspaceMode === 'shared' && role !== 'manager') {
            throw new Error('Shared workspace mode is only available for managers');
        }
        
        // Role-based access control
        if (callerRole === 'specialist') {
            throw new Error('Specialists have NO access to MCP orchestration tools');
        }
        
        try {
            const result = await this.instanceManager.spawnInstance(role, workDir, context, parentId, { workspaceMode });
            
            // If spawning a Manager, set up parallel executor
            if (role === 'manager') {
                const executor = new ParallelExecutor(this, {
                    maxConcurrent: this.maxSpecialistsPerManager
                });
                this.parallelExecutors.set(result.instanceId, executor);
                console.log(`Parallel executor initialized for Manager ${result.instanceId}`);
            }
            
            return {
                instanceId: result.instanceId,
                paneId: result.paneId,
                projectPath: result.projectPath
            };
        } catch (error) {
            throw new Error(`Failed to spawn instance: ${error.message}`);
        }
    }

    /**
     * Tool: send
     * Send text/prompt to a Claude instance.
     * Enhanced with circuit breaker protection.
     */
    async send(params, callerRole = null) {
        const { instanceId, text } = params;
        
        // Validate parameters
        if (!instanceId || !text) {
            throw new Error('Missing required parameters: instanceId, text');
        }
        
        // Role-based access control
        if (callerRole === 'specialist') {
            throw new Error('Specialists have NO access to MCP orchestration tools');
        }
        
        // Use circuit breaker for protection
        return await this.circuitBreaker.execute(instanceId, async () => {
            try {
                await this.instanceManager.sendToInstance(instanceId, text);
                return { success: true };
            } catch (error) {
                throw new Error(`Failed to send to instance: ${error.message}`);
            }
        });
    }

    /**
     * Tool: read
     * Read output from a Claude instance.
     * Enhanced with circuit breaker protection.
     */
    async read(params, callerRole = null) {
        const { instanceId, lines = 50, follow = false } = params;
        
        // Validate parameters
        if (!instanceId) {
            throw new Error('Missing required parameter: instanceId');
        }
        
        // Role-based access control
        if (callerRole === 'specialist') {
            throw new Error('Specialists have NO access to MCP orchestration tools');
        }
        
        // Use circuit breaker for protection
        return await this.circuitBreaker.execute(instanceId, async () => {
            try {
                const result = await this.instanceManager.readFromInstance(instanceId, lines);
                
                // TODO: Implement follow/streaming if needed
                if (follow) {
                    console.error('Follow mode not yet implemented, returning single read');
                }
                
                return result;
            } catch (error) {
                throw new Error(`Failed to read from instance: ${error.message}`);
            }
        });
    }

    /**
     * Tool: list
     * List all active Claude instances.
     * Enhanced with parallel execution awareness.
     */
    async list(params = {}, callerRole = null) {
        const { role, parentId } = params;
        
        // Role-based access control
        if (callerRole === 'specialist') {
            throw new Error('Specialists have NO access to MCP orchestration tools');
        }
        
        try {
            const instances = await this.instanceManager.listInstances(role, parentId);
            
            // Add status checking for each instance
            const enrichedInstances = await Promise.all(
                instances.map(async (instance) => {
                    const isActive = await this.instanceManager.isInstanceActive(instance.instanceId);
                    const baseInstance = {
                        ...instance,
                        status: isActive ? instance.status : 'inactive'
                    };
                    
                    // Add parallel execution status for Managers
                    if (instance.role === 'manager' && this.parallelExecutors.has(instance.instanceId)) {
                        const executor = this.parallelExecutors.get(instance.instanceId);
                        const parallelStatus = executor.getStatus();
                        return {
                            ...baseInstance,
                            parallelExecution: {
                                active: parallelStatus.activeSpecialists,
                                queued: parallelStatus.queuedTasks,
                                completed: parallelStatus.completedTasks,
                                failed: parallelStatus.failedTasks
                            }
                        };
                    }
                    return baseInstance;
                })
            );
            
            return enrichedInstances;
        } catch (error) {
            throw new Error(`Failed to list instances: ${error.message}`);
        }
    }

    /**
     * Tool: terminate
     * Terminate a Claude instance and optionally its children.
     * Enhanced to clean up parallel executors.
     */
    async terminate(params, callerRole = null) {
        const { instanceId, cascade = false } = params;
        
        // Validate parameters
        if (!instanceId) {
            throw new Error('Missing required parameter: instanceId');
        }
        
        // Role-based access control
        if (callerRole === 'specialist') {
            throw new Error('Specialists have NO access to MCP orchestration tools');
        }
        
        try {
            // If terminating a Manager, clean up its executor
            if (this.parallelExecutors.has(instanceId)) {
                const executor = this.parallelExecutors.get(instanceId);
                await executor.emergencyStop();
                this.parallelExecutors.delete(instanceId);
                console.log(`Cleaned up parallel executor for Manager ${instanceId}`);
            }
            
            // Reset circuit breaker for terminated instance
            this.circuitBreaker.reset(instanceId);
            
            const success = await this.instanceManager.terminateInstance(instanceId, cascade);
            return { success };
        } catch (error) {
            throw new Error(`Failed to terminate instance: ${error.message}`);
        }
    }

    /**
     * Tool: restart
     * Restart a dead instance using --continue flag.
     */
    async restart(params, callerRole = null) {
        const { instanceId } = params;
        
        // Validate parameters
        if (!instanceId) {
            throw new Error('Missing required parameter: instanceId');
        }
        
        // Role-based access control
        if (callerRole === 'specialist') {
            throw new Error('Specialists have NO access to MCP orchestration tools');
        }
        
        try {
            const result = await this.instanceManager.restartInstance(instanceId);
            return result;
        } catch (error) {
            throw new Error(`Failed to restart instance: ${error.message}`);
        }
    }

    /**
     * New tool: Execute parallel tasks (for Manager instances)
     * This enables Managers to run multiple Specialists concurrently
     */
    async executeParallel(params, callerRole = null) {
        const { managerId, tasks, workDir } = params;
        
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
        
        if (callerRole === 'specialist') {
            throw new Error('Specialists have NO access to MCP orchestration tools');
        }
        
        const executor = this.parallelExecutors.get(managerId);
        if (!executor) {
            return { status: 'no_executor', managerId };
        }
        
        return executor.getStatus();
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
    getToolDefinitions(server = null) {
        this.server = server; // Store server reference for enhanced tools
        
        // Core MCP tools (consolidated from base implementation)
        const baseTools = [
            {
                name: 'spawn',
                description: 'Spawn a new Claude instance with role and context',
                inputSchema: {
                    type: 'object',
                    properties: {
                        role: {
                            type: 'string',
                            enum: ['executive', 'manager', 'specialist'],
                            description: 'Role of the instance to create'
                        },
                        workDir: {
                            type: 'string',
                            description: 'Working directory for the instance'
                        },
                        context: {
                            type: 'string',
                            description: 'CLAUDE.md content for the instance'
                        },
                        parentId: {
                            type: 'string',
                            description: 'ID of parent instance for hierarchy tracking'
                        },
                        workspaceMode: {
                            type: 'string',
                            enum: ['isolated', 'shared'],
                            description: 'Workspace mode (isolated or shared for managers)'
                        }
                    },
                    required: ['role', 'workDir', 'context']
                }
            },
            {
                name: 'send',
                description: 'Send text/prompt to a Claude instance',
                inputSchema: {
                    type: 'object',
                    properties: {
                        instanceId: {
                            type: 'string',
                            description: 'ID of the target instance'
                        },
                        text: {
                            type: 'string',
                            description: 'Text to send to the instance'
                        }
                    },
                    required: ['instanceId', 'text']
                }
            },
            {
                name: 'read',
                description: 'Read output from a Claude instance',
                inputSchema: {
                    type: 'object',
                    properties: {
                        instanceId: {
                            type: 'string',
                            description: 'ID of the target instance'
                        },
                        lines: {
                            type: 'number',
                            description: 'Number of lines to read (default: 50)'
                        },
                        follow: {
                            type: 'boolean',
                            description: 'Stream output (default: false)'
                        }
                    },
                    required: ['instanceId']
                }
            },
            {
                name: 'list',
                description: 'List all active Claude instances',
                inputSchema: {
                    type: 'object',
                    properties: {
                        role: {
                            type: 'string',
                            enum: ['executive', 'manager', 'specialist'],
                            description: 'Filter by role'
                        },
                        parentId: {
                            type: 'string',
                            description: 'Filter by parent instance ID'
                        }
                    }
                }
            },
            {
                name: 'terminate',
                description: 'Terminate a Claude instance and optionally its children',
                inputSchema: {
                    type: 'object',
                    properties: {
                        instanceId: {
                            type: 'string',
                            description: 'ID of the instance to terminate'
                        },
                        cascade: {
                            type: 'boolean',
                            description: 'Also terminate child instances (default: false)'
                        }
                    },
                    required: ['instanceId']
                }
            },
            {
                name: 'restart',
                description: 'Restart a dead instance using --continue flag',
                inputSchema: {
                    type: 'object',
                    properties: {
                        instanceId: {
                            type: 'string',
                            description: 'ID of the instance to restart'
                        }
                    },
                    required: ['instanceId']
                }
            }
        ];
        
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

        // Add git collaboration tools (merged from SharedWorkspaceMCPTools)
        const gitCollaborationTools = [
            {
                name: 'merge_manager_work',
                description: 'Coordinate merge of manager work back to main branch (Executive only)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        managerId: {
                            type: 'string',
                            description: 'ID of the manager whose work to merge'
                        },
                        targetBranch: {
                            type: 'string',
                            description: 'Target branch for merge (default: main)'
                        },
                        strategy: {
                            type: 'string',
                            enum: ['auto', 'manual', 'force'],
                            description: 'Merge strategy to use'
                        },
                        deleteBranch: {
                            type: 'boolean',
                            description: 'Delete manager branch after merge'
                        }
                    },
                    required: ['managerId']
                }
            },
            {
                name: 'check_workspace_conflicts',
                description: 'Analyze potential conflicts in shared workspace',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspaceDir: {
                            type: 'string',
                            description: 'Path to the shared workspace directory'
                        },
                        managerIds: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Manager instance IDs to analyze'
                        }
                    },
                    required: ['workspaceDir']
                }
            },
            {
                name: 'sync_manager_branch',
                description: 'Sync manager branch with latest main branch changes (Manager only)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        instanceId: {
                            type: 'string',
                            description: 'Manager instance ID'
                        },
                        baseBranch: {
                            type: 'string',
                            description: 'Base branch to sync with (default: main)'
                        }
                    },
                    required: ['instanceId']
                }
            },
            {
                name: 'commit_manager_work',
                description: 'Commit current work with proper git practices (Manager only)',
                inputSchema: {
                    type: 'object',
                    properties: {
                        instanceId: {
                            type: 'string',
                            description: 'Manager instance ID'
                        },
                        message: {
                            type: 'string',
                            description: 'Commit message'
                        },
                        files: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Specific files to commit (default: all changes)'
                        }
                    },
                    required: ['instanceId', 'message']
                }
            },
            {
                name: 'get_workspace_status',
                description: 'Get comprehensive status of shared workspace',
                inputSchema: {
                    type: 'object',
                    properties: {
                        workspaceDir: {
                            type: 'string',
                            description: 'Path to the shared workspace directory'
                        }
                    },
                    required: ['workspaceDir']
                }
            }
        ];
        
        return [...baseTools, ...phase3Tools, ...gitCollaborationTools];
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
            // Git collaboration tools (merged from SharedWorkspaceMCPTools)
            case 'merge_manager_work':
                return await this.mergeManagerWork(params, callerRole);
            case 'check_workspace_conflicts':
                return await this.checkWorkspaceConflicts(params, callerRole);
            case 'sync_manager_branch':
                return await this.syncManagerBranch(params, callerRole);
            case 'commit_manager_work':
                return await this.commitManagerWork(params, callerRole);
            case 'get_workspace_status':
                return await this.getWorkspaceStatus(params, callerRole);
            // Core MCP tools (consolidated from base implementation)
            case 'spawn':
                return await this.spawn(params, callerRole);
            case 'send':
                return await this.send(params, callerRole);
            case 'read':
                return await this.read(params, callerRole);
            case 'list':
                return await this.list(params, callerRole);
            case 'terminate':
                return await this.terminate(params, callerRole);
            case 'restart':
                return await this.restart(params, callerRole);
            default:
                throw new Error(`Unknown tool: ${toolName}`);
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
        
        if (!instanceId) {
            throw new Error('Missing required parameter: instanceId');
        }
        
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
        
        if (!instanceId) {
            throw new Error('Missing required parameter: instanceId');
        }
        
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

    // ============ GIT COLLABORATION TOOLS ============
    // Merged from SharedWorkspaceMCPTools

    /**
     * Tool: merge_manager_work
     * Coordinate merge of manager work back to main branch
     */
    async mergeManagerWork(params, callerRole = null) {
        const { 
            managerId, 
            targetBranch = null, 
            strategy = 'auto',
            deleteBranch = false 
        } = params;
        
        if (!managerId) {
            throw new Error('Missing required parameter: managerId');
        }
        
        // Role-based access control - only executives can coordinate merges
        if (callerRole !== 'executive') {
            throw new Error('Only executives can coordinate manager merges');
        }
        
        try {
            // Get manager instance info
            const managerInstance = this.instanceManager.instances[managerId];
            if (!managerInstance) {
                throw new Error(`Manager instance ${managerId} not found`);
            }
            
            if (!managerInstance.isSharedWorkspace) {
                throw new Error(`Manager ${managerId} is not in a shared workspace`);
            }
            
            // Get the manager's branch name
            const managerBranch = `manager-${managerId}`;
            const workspaceDir = managerInstance.workDir;
            
            // Get the default branch if not specified
            const actualTargetBranch = targetBranch || await this.gitManager.getDefaultBranch(workspaceDir);
            
            // Perform coordinated merge
            const mergeResult = await this.gitManager.coordinatedMerge({
                managerBranch,
                targetBranch: actualTargetBranch,
                workspaceDir,
                strategy,
                deleteBranch
            });
            
            return {
                success: mergeResult.success,
                status: mergeResult.status,
                managerBranch,
                targetBranch,
                conflicts: mergeResult.conflicts || [],
                message: mergeResult.message || 'Merge completed successfully'
            };
        } catch (error) {
            throw new Error(`Failed to merge manager work: ${error.message}`);
        }
    }

    /**
     * Tool: check_workspace_conflicts
     * Analyze potential conflicts in shared workspace
     */
    async checkWorkspaceConflicts(params, callerRole = null) {
        const { workspaceDir, managerIds = [] } = params;
        
        if (!workspaceDir) {
            throw new Error('Missing required parameter: workspaceDir');
        }
        
        // Available to executives and managers
        if (!['executive', 'manager'].includes(callerRole)) {
            throw new Error('Only executives and managers can check workspace conflicts');
        }
        
        try {
            const conflictAnalysis = {
                workspace: workspaceDir,
                managers: [],
                conflicts: [],
                recommendations: []
            };
            
            // Analyze each manager's branch for conflicts
            for (const managerId of managerIds) {
                const managerBranch = `manager-${managerId}`;
                
                // Check if branch exists
                if (await this.gitManager.branchExists(managerBranch, workspaceDir)) {
                    // Get the default branch for conflict analysis
                    const defaultBranch = await this.gitManager.getDefaultBranch(workspaceDir);
                    const analysis = await this.gitManager.analyzeConflicts(
                        managerBranch, 
                        defaultBranch, 
                        workspaceDir
                    );
                    
                    conflictAnalysis.managers.push({
                        managerId,
                        branch: managerBranch,
                        hasConflicts: analysis.hasConflicts,
                        conflictingFiles: analysis.conflicts || [],
                        changedFiles: analysis.sourceChanges || []
                    });
                    
                    if (analysis.hasConflicts) {
                        conflictAnalysis.conflicts.push(...analysis.conflicts);
                    }
                }
            }
            
            // Generate recommendations
            if (conflictAnalysis.conflicts.length > 0) {
                conflictAnalysis.recommendations.push(
                    'Coordinate with managers to resolve conflicts before merging',
                    'Consider sequential merging instead of parallel development',
                    'Use MCP messages to communicate about file changes'
                );
            } else {
                conflictAnalysis.recommendations.push(
                    'No conflicts detected - ready for merging',
                    'Consider merging in order of completion'
                );
            }
            
            return conflictAnalysis;
        } catch (error) {
            throw new Error(`Failed to check workspace conflicts: ${error.message}`);
        }
    }

    /**
     * Tool: sync_manager_branch
     * Sync manager branch with latest main branch changes
     */
    async syncManagerBranch(params, callerRole = null) {
        const { instanceId, baseBranch = null } = params;
        
        if (!instanceId) {
            throw new Error('Missing required parameter: instanceId');
        }
        
        // Only managers can sync their own branches
        if (callerRole !== 'manager') {
            throw new Error('Only managers can sync their branches');
        }
        
        try {
            // Get manager instance
            const managerInstance = this.instanceManager.instances[instanceId];
            if (!managerInstance) {
                throw new Error(`Manager instance ${instanceId} not found`);
            }
            
            const workspaceDir = managerInstance.workDir;
            const managerBranch = `manager-${instanceId}`;
            
            // Get the default branch if not specified
            const actualBaseBranch = baseBranch || await this.gitManager.getDefaultBranch(workspaceDir);
            
            // Ensure we're on the manager branch
            await this.gitManager.gitCommand(`checkout ${managerBranch}`, workspaceDir);
            
            // Pull latest changes from base branch
            await this.gitManager.gitCommand(`checkout ${actualBaseBranch}`, workspaceDir);
            await this.gitManager.pullLatestChanges(actualBaseBranch, workspaceDir);
            
            // Merge base branch into manager branch
            await this.gitManager.gitCommand(`checkout ${managerBranch}`, workspaceDir);
            
            const mergeResult = await this.gitManager.gitCommand(
                `merge ${actualBaseBranch} -m "Sync with latest ${actualBaseBranch}"`, 
                workspaceDir
            );
            
            return {
                success: true,
                managerBranch,
                baseBranch,
                message: `Successfully synced ${managerBranch} with ${baseBranch}`
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: `Failed to sync branch: ${error.message}`
            };
        }
    }

    /**
     * Tool: commit_manager_work  
     * Commit current work with proper git practices
     */
    async commitManagerWork(params, callerRole = null) {
        const { instanceId, message, files = [] } = params;
        
        if (!instanceId || !message) {
            throw new Error('Missing required parameters: instanceId, message');
        }
        
        // Only managers can commit their work
        if (callerRole !== 'manager') {
            throw new Error('Only managers can commit work');
        }
        
        try {
            // Get manager instance
            const managerInstance = this.instanceManager.instances[instanceId];
            if (!managerInstance) {
                throw new Error(`Manager instance ${instanceId} not found`);
            }
            
            const workspaceDir = managerInstance.workDir;
            const managerBranch = `manager-${instanceId}`;
            
            // Ensure we're on the correct branch
            await this.gitManager.gitCommand(`checkout ${managerBranch}`, workspaceDir);
            
            // Add files (all if none specified)
            if (files.length > 0) {
                for (const file of files) {
                    await this.gitManager.gitCommand(`add "${file}"`, workspaceDir);
                }
            } else {
                await this.gitManager.gitCommand('add .', workspaceDir);
            }
            
            // Create commit with enhanced message
            const enhancedMessage = `${message}

Manager: ${instanceId}
Branch: ${managerBranch}
Workspace: Shared collaboration
`;
            
            await this.gitManager.gitCommand(
                `commit -m "${enhancedMessage}"`, 
                workspaceDir
            );
            
            // Try to push to remote
            try {
                await this.gitManager.gitCommand(`push origin ${managerBranch}`, workspaceDir);
            } catch {
                // Ignore push errors (no remote)
            }
            
            return {
                success: true,
                instanceId,
                managerBranch,
                message: `Committed work: ${message}`,
                filesCommitted: files.length || 'all changes'
            };
        } catch (error) {
            throw new Error(`Failed to commit manager work: ${error.message}`);
        }
    }

    /**
     * Tool: get_workspace_status
     * Get comprehensive status of shared workspace
     */
    async getWorkspaceStatus(params, callerRole = null) {
        const { workspaceDir } = params;
        
        if (!workspaceDir) {
            throw new Error('Missing required parameter: workspaceDir');
        }
        
        // Available to executives and managers
        if (!['executive', 'manager'].includes(callerRole)) {
            throw new Error('Only executives and managers can get workspace status');
        }
        
        try {
            const status = {
                workspace: workspaceDir,
                currentBranch: null,
                managers: [],
                branches: [],
                status: 'unknown',
                lastSync: null,
                conflicts: []
            };
            
            // Get current branch
            try {
                status.currentBranch = await this.gitManager.getCurrentBranch(workspaceDir);
            } catch {
                status.status = 'not_git_repo';
                return status;
            }
            
            // Get all branches
            const branchResult = await this.gitManager.gitCommand('branch -a', workspaceDir);
            status.branches = branchResult.stdout
                .split('\n')
                .map(b => b.trim().replace(/^\*?\s*/, ''))
                .filter(b => b);
            
            // Find manager branches and instances
            for (const [instanceId, instance] of Object.entries(this.instanceManager.instances)) {
                if (instance.isSharedWorkspace && instance.workDir === workspaceDir) {
                    const managerBranch = `manager-${instanceId}`;
                    const branchExists = status.branches.some(b => b.includes(managerBranch));
                    
                    status.managers.push({
                        instanceId,
                        branch: managerBranch,
                        branchExists,
                        status: instance.status
                    });
                }
            }
            
            status.status = 'active';
            return status;
        } catch (error) {
            throw new Error(`Failed to get workspace status: ${error.message}`);
        }
    }
}