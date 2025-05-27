/**
 * Simple MCP Server Implementation
 * 
 * A minimal MCP server implementation without external SDK dependencies.
 * Implements the JSON-RPC 2.0 protocol over stdio for MCP communication.
 * 
 * This server provides the 5 core tmux-claude orchestration tools.
 */

import { InstanceManager } from './instance_manager.js';
import { MCPTools } from './mcp_tools.js';
import { EnhancedMCPTools } from './enhanced_mcp_tools.js';
import { JobQueue } from './job_queue.js';

class SimpleMCPServer {
    constructor() {
        // Detect phase from environment
        this.phase = parseInt(process.env.PHASE) || 2;
        this.useEnhancedTools = this.phase >= 3;
        
        // Initialize instance manager with phase-appropriate options
        this.instanceManager = new InstanceManager('./state', {
            useRedis: this.phase >= 3
        });
        
        // Use enhanced tools for Phase 3
        if (this.useEnhancedTools) {
            this.mcpTools = new EnhancedMCPTools(this.instanceManager);
            this.jobQueue = new JobQueue(this.instanceManager.stateStore);
            console.error('=== Phase 3 tmux-claude MCP Server initialized (parallel execution enabled) ===');
        } else {
            this.mcpTools = new MCPTools(this.instanceManager);
            console.error('=== Phase 2 tmux-claude MCP Server initialized (sequential execution) ===');
        }
        
        this.requestId = 0;
        
        // Initialize job queue from state store if Phase 3
        if (this.phase >= 3 && this.jobQueue) {
            this.jobQueue.loadFromStateStore().catch(err => 
                console.error('Failed to load job queue:', err)
            );
        }
    }

    /**
     * Handle incoming JSON-RPC 2.0 messages
     */
    async handleMessage(message) {
        try {
            const request = JSON.parse(message);
            
            if (request.method === 'tools/list') {
                return this.handleListTools(request);
            } else if (request.method === 'tools/call') {
                return this.handleCallTool(request);
            } else if (request.method === 'initialize') {
                return this.handleInitialize(request);
            } else {
                return this.createErrorResponse(request.id, -32601, 'Method not found');
            }
        } catch (error) {
            console.error('Message handling error:', error);
            return this.createErrorResponse(null, -32700, 'Parse error');
        }
    }

    /**
     * Handle initialize request
     */
    async handleInitialize(request) {
        return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
                protocolVersion: '2024-11-05',
                capabilities: {
                    tools: {}
                },
                serverInfo: {
                    name: 'tmux-claude-mcp-server',
                    version: '1.0.0'
                }
            }
        };
    }

    /**
     * Handle tools/list request
     */
    async handleListTools(request) {
        const tools = this.mcpTools.getToolDefinitions();
        
        return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
                tools: tools
            }
        };
    }

    /**
     * Handle tools/call request
     */
    async handleCallTool(request) {
        try {
            const { name, arguments: args } = request.params;
            
            // Extract caller role from arguments or environment
            const callerRole = args?._callerRole || process.env.CLAUDE_INSTANCE_ROLE || null;
            
            // Remove internal parameters
            const toolParams = { ...args };
            delete toolParams._callerRole;
            
            console.error(`Tool call: ${name} from role: ${callerRole || 'unknown'}`);
            
            const result = await this.mcpTools.executeTool(name, toolParams, callerRole);
            
            return {
                jsonrpc: '2.0',
                id: request.id,
                result: {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                }
            };
            
        } catch (error) {
            console.error(`Tool execution error: ${error.message}`);
            return this.createErrorResponse(request.id, -32603, `Tool execution failed: ${error.message}`);
        }
    }

    /**
     * Create error response
     */
    createErrorResponse(id, code, message) {
        return {
            jsonrpc: '2.0',
            id: id,
            error: {
                code: code,
                message: message
            }
        };
    }

    /**
     * Start the server and listen on stdin/stdout
     */
    start() {
        console.error('tmux-claude MCP Server running on stdio');
        
        let buffer = '';
        
        process.stdin.on('data', async (chunk) => {
            buffer += chunk.toString();
            
            // Process complete lines
            let lines = buffer.split('\n');
            buffer = lines.pop(); // Keep incomplete line in buffer
            
            for (const line of lines) {
                if (line.trim()) {
                    const response = await this.handleMessage(line);
                    if (response) {
                        process.stdout.write(JSON.stringify(response) + '\n');
                    }
                }
            }
        });

        process.stdin.on('end', () => {
            console.error('tmux-claude MCP Server shutting down');
            process.exit(0);
        });
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.error('Received SIGINT, shutting down gracefully...');
    if (global.instanceManager) {
        await global.instanceManager.cleanup();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.error('Received SIGTERM, shutting down gracefully...');
    if (global.instanceManager) {
        await global.instanceManager.cleanup();
    }
    process.exit(0);
});

// Start the server
const server = new SimpleMCPServer();
server.start();