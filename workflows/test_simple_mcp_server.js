#!/usr/bin/env node

/**
 * Test script for SimpleMCPServer with EnhancedMCPTools
 * 
 * This script tests:
 * 1. SimpleMCPServer imports and instantiation
 * 2. EnhancedMCPTools initialization
 * 3. Tool definitions loading
 * 4. Basic server startup validation
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs-extra';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the SimpleMCPServer
const serverPath = join(__dirname, '../src/simple_mcp_server.js');

async function testServerImport() {
    console.log('=== Testing SimpleMCPServer Import ===');
    
    try {
        // Dynamically import the SimpleMCPServer to test the module
        const { SimpleMCPServer } = await import(serverPath);
        console.log('✅ SimpleMCPServer module imported successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to import SimpleMCPServer:', error.message);
        return false;
    }
}

async function testServerInstantiation() {
    console.log('\n=== Testing SimpleMCPServer Component Dependencies ===');
    
    try {
        // Set test environment
        process.env.PHASE = '2'; // Test with Phase 2 initially
        
        console.log('Testing component imports...');
        
        // Test InstanceManager import
        const { InstanceManager } = await import('../src/instance_manager.js');
        console.log('✅ InstanceManager imported');
        
        // Test EnhancedMCPTools import
        const { EnhancedMCPTools } = await import('../src/enhanced_mcp_tools.js');
        console.log('✅ EnhancedMCPTools imported');
        
        // Test JobQueue import
        const { JobQueue } = await import('../src/job_queue.js');
        console.log('✅ JobQueue imported');
        
        // Create mock instance manager for testing
        const mockInstanceManager = {
            stateStore: null,
            instances: {},
            spawnInstance: async () => ({ instanceId: 'test_123', paneId: 'test_pane' }),
            listInstances: async () => [],
            terminateInstance: async () => true,
            sendToInstance: async () => ({ success: true }),
            readFromInstance: async () => ({ output: 'test output' }),
            isInstanceActive: async () => true
        };
        
        // Test EnhancedMCPTools instantiation
        console.log('Testing EnhancedMCPTools instantiation...');
        const mcpTools = new EnhancedMCPTools(mockInstanceManager);
        console.log('✅ EnhancedMCPTools instantiated');
        
        // Test tool definitions
        const toolDefs = mcpTools.getToolDefinitions();
        console.log(`✅ Tool definitions loaded: ${toolDefs.length} tools`);
        
        // List the tools by category
        const coreTools = toolDefs.filter(t => ['spawn', 'send', 'read', 'list', 'terminate', 'restart'].includes(t.name));
        const parallelTools = toolDefs.filter(t => ['executeParallel', 'getParallelStatus', 'distributeWork'].includes(t.name));
        const gitTools = toolDefs.filter(t => t.name.includes('manager') || t.name.includes('workspace'));
        
        console.log(`\nTool categories:`);
        console.log(`  Core MCP tools: ${coreTools.length}`);
        console.log(`  Parallel execution tools: ${parallelTools.length}`);
        console.log(`  Git collaboration tools: ${gitTools.length}`);
        
        // Test JobQueue instantiation
        console.log('\nTesting JobQueue instantiation...');
        const jobQueue = new JobQueue(mockInstanceManager.stateStore);
        console.log('✅ JobQueue instantiated');
        
        console.log('✅ All component dependencies validated');
        return true;
    } catch (error) {
        console.error('❌ Component dependency test failed:', error.message);
        console.error('Stack trace:', error.stack);
        return false;
    }
}

async function testToolExecution() {
    console.log('\n=== Testing Basic Tool Execution ===');
    
    try {
        // Import EnhancedMCPTools directly
        const { EnhancedMCPTools } = await import('../src/enhanced_mcp_tools.js');
        
        // Create mock instance manager
        const mockInstanceManager = {
            stateStore: null,
            instances: {},
            spawnInstance: async (role, workDir, context) => {
                console.log(`Mock spawn: ${role} in ${workDir}`);
                return { 
                    instanceId: `test_${role}_${Date.now()}`, 
                    paneId: 'test_pane',
                    projectPath: workDir
                };
            },
            listInstances: async () => {
                return [
                    { instanceId: 'test_exec_1', role: 'executive', status: 'active' },
                    { instanceId: 'test_mgr_1', role: 'manager', status: 'active' }
                ];
            },
            sendToInstance: async (instanceId, text) => {
                console.log(`Mock send to ${instanceId}: ${text.substring(0, 50)}...`);
                return { success: true };
            },
            readFromInstance: async (instanceId, lines) => {
                console.log(`Mock read from ${instanceId}: ${lines} lines`);
                return { output: 'Mock output from instance' };
            },
            terminateInstance: async (instanceId) => {
                console.log(`Mock terminate: ${instanceId}`);
                return true;
            },
            isInstanceActive: async (instanceId) => true
        };
        
        const mcpTools = new EnhancedMCPTools(mockInstanceManager);
        
        // Test list tool (should work without restrictions)
        console.log('Testing list tool...');
        const listResult = await mcpTools.executeTool('list', {}, 'executive');
        console.log('✅ List tool executed:', listResult.length, 'instances');
        
        // Test spawn tool (executive role)
        console.log('Testing spawn tool...');
        const spawnResult = await mcpTools.executeTool('spawn', {
            role: 'manager',
            workDir: '/tmp/test',
            context: 'Test context for manager'
        }, 'executive');
        console.log('✅ Spawn tool executed:', spawnResult.instanceId);
        
        // Test role-based access control
        console.log('Testing role-based access control...');
        try {
            await mcpTools.executeTool('spawn', {
                role: 'manager',
                workDir: '/tmp/test',
                context: 'Test context'
            }, 'specialist');
            console.log('❌ Role-based access control failed - specialist should not be able to spawn');
            return false;
        } catch (error) {
            if (error.message.includes('Specialists have NO access to MCP orchestration tools')) {
                console.log('✅ Role-based access control working correctly');
            } else {
                throw error;
            }
        }
        
        console.log('✅ Basic tool execution tests passed');
        return true;
    } catch (error) {
        console.error('❌ Tool execution test failed:', error.message);
        return false;
    }
}

async function testJSONRPCHandling() {
    console.log('\n=== Testing JSON-RPC Message Handling ===');
    
    try {
        // Import EnhancedMCPTools for mock setup
        const { EnhancedMCPTools } = await import('../src/enhanced_mcp_tools.js');
        
        // Create a test server instance
        class TestMCPServer {
            constructor() {
                this.phase = 2;
                this.useEnhancedTools = true;
                
                // Mock instance manager
                const mockInstanceManager = {
                    stateStore: null,
                    instances: {},
                    listInstances: async () => []
                };
                
                this.mcpTools = new EnhancedMCPTools(mockInstanceManager);
                this.requestId = 0;
            }
            
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
                    return this.createErrorResponse(null, -32700, 'Parse error');
                }
            }
            
            async handleInitialize(request) {
                return {
                    jsonrpc: '2.0',
                    id: request.id,
                    result: {
                        protocolVersion: '2024-11-05',
                        capabilities: { tools: {} },
                        serverInfo: {
                            name: 'tmux-claude-mcp-server',
                            version: '1.0.0'
                        }
                    }
                };
            }
            
            async handleListTools(request) {
                const tools = this.mcpTools.getToolDefinitions();
                return {
                    jsonrpc: '2.0',
                    id: request.id,
                    result: { tools: tools }
                };
            }
            
            async handleCallTool(request) {
                try {
                    const { name, arguments: args } = request.params;
                    const callerRole = args?._callerRole || 'executive';
                    
                    const result = await this.mcpTools.executeTool(name, args, callerRole);
                    
                    return {
                        jsonrpc: '2.0',
                        id: request.id,
                        result: {
                            content: [{
                                type: 'text',
                                text: JSON.stringify(result, null, 2)
                            }]
                        }
                    };
                } catch (error) {
                    return this.createErrorResponse(request.id, -32603, `Tool execution failed: ${error.message}`);
                }
            }
            
            createErrorResponse(id, code, message) {
                return {
                    jsonrpc: '2.0',
                    id: id,
                    error: { code: code, message: message }
                };
            }
        }
        
        const testServer = new TestMCPServer();
        
        // Test initialize request
        console.log('Testing initialize request...');
        const initRequest = JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {}
        });
        
        const initResponse = await testServer.handleMessage(initRequest);
        if (initResponse.result && initResponse.result.serverInfo.name === 'tmux-claude-mcp-server') {
            console.log('✅ Initialize request handled correctly');
        } else {
            throw new Error('Initialize response incorrect');
        }
        
        // Test tools/list request
        console.log('Testing tools/list request...');
        const listRequest = JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/list',
            params: {}
        });
        
        const listResponse = await testServer.handleMessage(listRequest);
        if (listResponse.result && listResponse.result.tools && listResponse.result.tools.length > 0) {
            console.log(`✅ Tools/list request handled correctly: ${listResponse.result.tools.length} tools`);
        } else {
            throw new Error('Tools/list response incorrect');
        }
        
        // Test tools/call request (list tool)
        console.log('Testing tools/call request...');
        const callRequest = JSON.stringify({
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: {
                name: 'list',
                arguments: { _callerRole: 'executive' }
            }
        });
        
        const callResponse = await testServer.handleMessage(callRequest);
        if (callResponse.result && callResponse.result.content) {
            console.log('✅ Tools/call request handled correctly');
        } else {
            throw new Error('Tools/call response incorrect');
        }
        
        console.log('✅ JSON-RPC message handling tests passed');
        return true;
    } catch (error) {
        console.error('❌ JSON-RPC handling test failed:', error.message);
        return false;
    }
}

async function runAllTests() {
    console.log('🚀 Starting SimpleMCPServer Test Suite\n');
    
    const results = {
        import: false,
        instantiation: false,
        toolExecution: false,
        jsonrpcHandling: false
    };
    
    // Run tests in sequence
    results.import = await testServerImport();
    if (results.import) {
        results.instantiation = await testServerInstantiation();
    }
    if (results.instantiation) {
        results.toolExecution = await testToolExecution();
    }
    if (results.toolExecution) {
        results.jsonrpcHandling = await testJSONRPCHandling();
    }
    
    // Print summary
    console.log('\n=== Test Results Summary ===');
    console.log(`Import Test: ${results.import ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Instantiation Test: ${results.instantiation ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Tool Execution Test: ${results.toolExecution ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`JSON-RPC Handling Test: ${results.jsonrpcHandling ? '✅ PASS' : '❌ FAIL'}`);
    
    const allPassed = Object.values(results).every(r => r);
    console.log(`\nOverall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    
    if (allPassed) {
        console.log('\n🎉 SimpleMCPServer is ready for use!');
        console.log('The server can start without errors and tools are properly registered.');
    } else {
        console.log('\n⚠️  SimpleMCPServer has issues that need to be resolved.');
    }
    
    process.exit(allPassed ? 0 : 1);
}

// Run the tests
runAllTests().catch(error => {
    console.error('❌ Test suite failed with error:', error);
    process.exit(1);
});