/**
 * tmux-claude MCP Server
 * 
 * Main MCP server implementation that provides orchestration tools for
 * hierarchical Claude instances via tmux. This server enables Executive
 * instances to spawn Managers, and Managers to spawn Specialists.
 * 
 * Architecture: As specified in tmux-manager-MCP.md and tmux-claude-implementation.md
 * - 5 core tools: spawn, send, read, list, terminate
 * - External state store for parallel-ready design
 * - Role-based access control
 * - Project isolation with --project flag
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
    ListToolsRequestSchema,
    CallToolRequestSchema,
    ErrorCode,
    McpError
} from '@modelcontextprotocol/sdk/types.js';

import { InstanceManager } from './instance_manager.js';
import { EnhancedMCPTools } from './enhanced_mcp_tools.js';
import { v4 as uuidv4 } from 'uuid';

class TmuxClaudeMCPServer {
    constructor() {
        this.server = new Server(
            {
                name: 'tmux-claude-mcp-server',
                version: '1.0.0'
            },
            {
                capabilities: {
                    tools: {}
                }
            }
        );
        
        // Initialize instance manager and MCP tools
        this.instanceManager = new InstanceManager('./state');
        this.mcpTools = new EnhancedMCPTools(this.instanceManager);
        
        // Message queue for reliable communication
        this.messageQueue = new Map(); // instanceId -> messages[]
        this.subscriptions = new Map(); // pattern -> Set<instanceId>
        
        this.setupHandlers();
        this.setupEnhancedTools();
        console.log('=== tmux-claude MCP Server initialized with message queuing ===');
    }

    setupHandlers() {
        // Handle tool listing
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            const tools = this.mcpTools.getToolDefinitions(this);
            return { tools };
        });

        // Handle tool execution
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            
            try {
                // Extract caller role from environment or args
                // In a real implementation, this would come from authentication
                const callerRole = args?._callerRole || process.env.CLAUDE_INSTANCE_ROLE || null;
                
                // Remove internal parameters before passing to tools
                const toolParams = { ...args };
                delete toolParams._callerRole;
                
                console.log(`Tool call: ${name} from role: ${callerRole || 'unknown'}`);
                
                // Handle enhanced tools
                if (name === 'enhancedSend') {
                    const result = await this.enhancedSend(toolParams);
                    return {
                        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
                    };
                } else if (name === 'enhancedRead') {
                    const result = await this.enhancedRead(toolParams);
                    return {
                        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
                    };
                } else if (name === 'subscribe') {
                    const result = await this.subscribe(toolParams);
                    return {
                        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
                    };
                }
                
                const result = await this.mcpTools.executeTool(name, toolParams, callerRole);
                
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
                
            } catch (error) {
                console.error(`Tool execution error: ${error.message}`);
                
                // Return proper MCP error
                throw new McpError(
                    ErrorCode.InternalError,
                    `Tool execution failed: ${error.message}`
                );
            }
        });
    }

    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.log('tmux-claude MCP Server running on stdio');
    }

    setupEnhancedTools() {
        // Add enhanced tools to the available tools
        const enhancedTools = [
            {
                name: 'enhancedSend',
                description: 'Send a message with queuing and guaranteed delivery',
                inputSchema: {
                    type: 'object',
                    properties: {
                        targetInstanceId: {
                            type: 'string',
                            description: 'ID of the target instance'
                        },
                        message: {
                            type: 'string',
                            description: 'Message to send'
                        },
                        priority: {
                            type: 'string',
                            enum: ['high', 'normal', 'low'],
                            description: 'Message priority',
                            default: 'normal'
                        }
                    },
                    required: ['targetInstanceId', 'message']
                }
            },
            {
                name: 'enhancedRead',
                description: 'Read messages from queue without losing them',
                inputSchema: {
                    type: 'object',
                    properties: {
                        instanceId: {
                            type: 'string',
                            description: 'Instance ID to read messages for'
                        },
                        unreadOnly: {
                            type: 'boolean',
                            description: 'Only return unread messages',
                            default: true
                        },
                        markAsRead: {
                            type: 'boolean',
                            description: 'Mark messages as read',
                            default: true
                        }
                    },
                    required: ['instanceId']
                }
            },
            {
                name: 'subscribe',
                description: 'Subscribe to messages matching a pattern',
                inputSchema: {
                    type: 'object',
                    properties: {
                        pattern: {
                            type: 'string',
                            description: 'Regex pattern to match instance IDs'
                        },
                        instanceId: {
                            type: 'string',
                            description: 'Your instance ID to receive notifications'
                        }
                    },
                    required: ['pattern', 'instanceId']
                }
            }
        ];
        
        // Store enhanced tools for later retrieval
        this.enhancedTools = enhancedTools;
    }

    async enhancedSend(params) {
        const { targetInstanceId, message, priority = 'normal' } = params;
        
        // Initialize queue for target if needed
        if (!this.messageQueue.has(targetInstanceId)) {
            this.messageQueue.set(targetInstanceId, []);
        }
        
        const queuedMessage = {
            id: uuidv4(),
            from: params._callerInstanceId || 'unknown',
            to: targetInstanceId,
            content: message,
            timestamp: new Date().toISOString(),
            priority,
            read: false
        };
        
        // Add to queue
        this.messageQueue.get(targetInstanceId).push(queuedMessage);
        
        // Sort by priority
        this.messageQueue.get(targetInstanceId).sort((a, b) => {
            const priorityOrder = { high: 0, normal: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
        
        // Check for subscriptions
        for (const [pattern, subscribers] of this.subscriptions) {
            if (targetInstanceId.match(new RegExp(pattern))) {
                for (const sub of subscribers) {
                    if (!this.messageQueue.has(sub)) {
                        this.messageQueue.set(sub, []);
                    }
                    this.messageQueue.get(sub).push({
                        ...queuedMessage,
                        to: sub,
                        isSubscription: true,
                        originalTarget: targetInstanceId
                    });
                }
            }
        }
        
        return { 
            success: true, 
            messageId: queuedMessage.id,
            queueLength: this.messageQueue.get(targetInstanceId).length 
        };
    }

    async enhancedRead(params) {
        const { instanceId, unreadOnly = true, markAsRead = true } = params;
        
        const messages = this.messageQueue.get(instanceId) || [];
        const filtered = unreadOnly ? messages.filter(m => !m.read) : messages;
        
        if (markAsRead) {
            filtered.forEach(m => m.read = true);
        }
        
        // Clean up old read messages (keep last 100)
        if (messages.length > 100) {
            const keep = messages.slice(-100);
            this.messageQueue.set(instanceId, keep);
        }
        
        return {
            messages: filtered,
            totalUnread: messages.filter(m => !m.read).length,
            oldestUnread: messages.find(m => !m.read)?.timestamp
        };
    }

    async subscribe(params) {
        const { pattern, instanceId } = params;
        
        if (!this.subscriptions.has(pattern)) {
            this.subscriptions.set(pattern, new Set());
        }
        
        this.subscriptions.get(pattern).add(instanceId);
        
        return { 
            success: true, 
            pattern,
            activeSubscriptions: this.subscriptions.get(pattern).size 
        };
    }

    async stop() {
        // Cleanup if needed
        console.log('tmux-claude MCP Server shutting down');
        // Persist message queue if needed
        const queueData = Array.from(this.messageQueue.entries());
        console.log(`Shutting down with ${queueData.length} instance queues`);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

// Start the server
const server = new TmuxClaudeMCPServer();
server.start().catch(error => {
    console.error('Server failed to start:', error);
    process.exit(1);
});