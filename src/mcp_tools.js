/**
 * MCP Tools Implementation
 * 
 * Implements the 5 core MCP tools as specified in tmux-manager-MCP.md:
 * 1. spawn - Create new Claude instances
 * 2. send - Send text to instances  
 * 3. read - Read output from instances
 * 4. list - List active instances
 * 5. terminate - Stop instances
 * 
 * Plus shared workspace collaboration tools:
 * 6. merge_manager_work - Coordinate manager merges
 * 7. check_workspace_conflicts - Analyze collaboration conflicts
 * 8. sync_manager_branch - Keep manager branches updated
 * 9. commit_manager_work - Commit with proper git practices
 * 10. get_workspace_status - Get workspace collaboration status
 * 
 * Each tool includes role-based access control and proper error handling.
 */

import { SharedWorkspaceMCPTools } from './shared_workspace_mcp_tools.js';

export class MCPTools {
    constructor(instanceManager) {
        this.instanceManager = instanceManager;
        this.sharedWorkspaceTools = new SharedWorkspaceMCPTools(instanceManager);
    }

    /**
     * Tool: spawn
     * Create a new Claude instance with role and context.
     * 
     * From docs: tmux-manager-MCP.md lines 42-59
     * Enhanced with workspace modes for manager collaboration
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
            const result = await this.instanceManager.spawnInstance(role, workDir, context, parentId, workspaceMode);
            
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
     * 
     * From docs: tmux-manager-MCP.md lines 61-70
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
        
        try {
            await this.instanceManager.sendToInstance(instanceId, text);
            return { success: true };
        } catch (error) {
            throw new Error(`Failed to send to instance: ${error.message}`);
        }
    }

    /**
     * Tool: read
     * Read output from a Claude instance.
     * 
     * From docs: tmux-manager-MCP.md lines 72-87
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
        
        try {
            const result = await this.instanceManager.readFromInstance(instanceId, lines);
            
            // TODO: Implement follow/streaming if needed
            if (follow) {
                console.log('Follow mode not yet implemented, returning single read');
            }
            
            return result;
        } catch (error) {
            throw new Error(`Failed to read from instance: ${error.message}`);
        }
    }

    /**
     * Tool: list
     * List all active Claude instances.
     * 
     * From docs: tmux-manager-MCP.md lines 89-107
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
                    return {
                        ...instance,
                        status: isActive ? instance.status : 'inactive'
                    };
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
     * 
     * From docs: tmux-manager-MCP.md lines 109-119
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
            const success = await this.instanceManager.terminateInstance(instanceId, cascade);
            return { success };
        } catch (error) {
            throw new Error(`Failed to terminate instance: ${error.message}`);
        }
    }

    /**
     * Additional tool: restart
     * Restart a dead instance using --continue flag.
     * Implementation of nearly-free recovery from architecture docs.
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
     * Get tool definitions for MCP server registration.
     * These definitions follow the MCP protocol format.
     */
    getToolDefinitions(server = null) {
        this.server = server; // Store server reference for enhanced tools
        // Get enhanced tools if server has them
        const enhancedTools = this.server?.enhancedTools || [];
        
        return [
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
        ].concat(enhancedTools);
    }

    /**
     * Execute a tool with role-based access control.
     * This is the main entry point for MCP tool execution.
     */
    async executeTool(toolName, params, callerRole = null) {
        console.log(`Executing tool: ${toolName} with role: ${callerRole}`);
        
        switch (toolName) {
            // Core orchestration tools
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
                
            // Shared workspace collaboration tools
            case 'merge_manager_work':
                return await this.sharedWorkspaceTools.mergeManagerWork(params, callerRole);
            case 'check_workspace_conflicts':
                return await this.sharedWorkspaceTools.checkWorkspaceConflicts(params, callerRole);
            case 'sync_manager_branch':
                return await this.sharedWorkspaceTools.syncManagerBranch(params, callerRole);
            case 'commit_manager_work':
                return await this.sharedWorkspaceTools.commitManagerWork(params, callerRole);
            case 'get_workspace_status':
                return await this.sharedWorkspaceTools.getWorkspaceStatus(params, callerRole);
                
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }
}