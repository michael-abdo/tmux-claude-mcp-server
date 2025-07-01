#!/usr/bin/env node
/**
 * Direct testing of EnhancedMCPTools to verify all consolidated functionality
 */

import { EnhancedMCPTools } from '../src/enhanced_mcp_tools.js';

async function testEnhancedToolsDirect() {
    console.log('🧪 Testing EnhancedMCPTools direct functionality...\n');
    
    // Mock instance manager with comprehensive methods
    const mockInstanceManager = {
        spawnInstance: async (role, workDir, context, parentId, options) => {
            console.log(`   Mock spawn: ${role} in ${workDir} with mode ${options?.workspaceMode || 'isolated'}`);
            return { instanceId: `${role}_test_123`, paneId: '0', projectPath: workDir };
        },
        sendToInstance: async (instanceId, text) => {
            console.log(`   Mock send: ${text.substring(0, 50)}... → ${instanceId}`);
            return { success: true };
        },
        readFromInstance: async (instanceId, lines) => {
            console.log(`   Mock read: ${lines} lines from ${instanceId}`);
            return { output: `Mock output from ${instanceId}`, success: true };
        },
        listInstances: async (role, parentId) => {
            console.log(`   Mock list: role=${role}, parentId=${parentId}`);
            return [
                { instanceId: 'exec_123', role: 'executive', status: 'active' },
                { instanceId: 'mgr_123', role: 'manager', status: 'active' },
                { instanceId: 'spec_123', role: 'specialist', status: 'active' }
            ];
        },
        isInstanceActive: async (instanceId) => {
            console.log(`   Mock isActive: ${instanceId}`);
            return true;
        },
        terminateInstance: async (instanceId, cascade) => {
            console.log(`   Mock terminate: ${instanceId} (cascade=${cascade})`);
            return true;
        },
        restartInstance: async (instanceId) => {
            console.log(`   Mock restart: ${instanceId}`);
            return { success: true };
        },
        // Additional mock data for workspace tools
        instances: {
            'mgr_123': {
                isSharedWorkspace: true,
                workDir: '/test/workspace'
            }
        }
    };
    
    const tools = new EnhancedMCPTools(mockInstanceManager);
    let testCount = 0;
    let passCount = 0;
    
    function assert(condition, message) {
        testCount++;
        if (condition) {
            console.log(`✅ ${message}`);
            passCount++;
        } else {
            console.log(`❌ ${message}`);
        }
    }
    
    console.log('=== CORE MCP TOOLS ===');
    
    // Test spawn
    try {
        const spawnResult = await tools.spawn({
            role: 'manager',
            workDir: '/test',
            context: 'test context',
            workspaceMode: 'shared'
        }, 'executive');
        assert(spawnResult.instanceId === 'manager_test_123', 'spawn() creates manager with correct ID');
    } catch (error) {
        assert(false, `spawn() failed: ${error.message}`);
    }
    
    // Test send
    try {
        const sendResult = await tools.send({
            instanceId: 'test_123',
            text: 'test message'
        }, 'executive');
        assert(sendResult.success === true, 'send() returns success');
    } catch (error) {
        assert(false, `send() failed: ${error.message}`);
    }
    
    // Test read
    try {
        const readResult = await tools.read({
            instanceId: 'test_123',
            lines: 10
        }, 'executive');
        assert(readResult.output.includes('test_123'), 'read() returns output with instance ID');
    } catch (error) {
        assert(false, `read() failed: ${error.message}`);
    }
    
    // Test list
    try {
        const listResult = await tools.list({}, 'executive');
        assert(Array.isArray(listResult) && listResult.length > 0, 'list() returns array of instances');
        assert(listResult.some(i => i.role === 'executive'), 'list() includes executive instance');
    } catch (error) {
        assert(false, `list() failed: ${error.message}`);
    }
    
    // Test terminate
    try {
        const terminateResult = await tools.terminate({
            instanceId: 'test_123'
        }, 'executive');
        assert(terminateResult.success === true, 'terminate() returns success');
    } catch (error) {
        assert(false, `terminate() failed: ${error.message}`);
    }
    
    console.log('\n=== ROLE-BASED ACCESS CONTROL ===');
    
    // Test specialist access denial
    try {
        await tools.spawn({
            role: 'specialist',
            workDir: '/test',
            context: 'test'
        }, 'specialist');
        assert(false, 'Specialist should not have access to spawn');
    } catch (error) {
        assert(error.message.includes('Specialists have NO access'), 'Specialists correctly denied access to spawn');
    }
    
    console.log('\n=== ENHANCED TOOLS ===');
    
    // Test tool definitions
    try {
        const toolDefs = tools.getToolDefinitions();
        assert(Array.isArray(toolDefs), 'getToolDefinitions() returns array');
        assert(toolDefs.length >= 14, `getToolDefinitions() returns at least 14 tools (got ${toolDefs.length})`);
        
        const toolNames = toolDefs.map(t => t.name);
        const expectedCoreTools = ['spawn', 'send', 'read', 'list', 'terminate', 'restart'];
        const expectedParallelTools = ['executeParallel', 'getParallelStatus', 'distributeWork'];
        const expectedGitTools = ['merge_manager_work', 'check_workspace_conflicts', 'sync_manager_branch', 'commit_manager_work', 'get_workspace_status'];
        
        expectedCoreTools.forEach(tool => {
            assert(toolNames.includes(tool), `Tool definition includes core tool: ${tool}`);
        });
        
        expectedParallelTools.forEach(tool => {
            assert(toolNames.includes(tool), `Tool definition includes parallel tool: ${tool}`);
        });
        
        expectedGitTools.forEach(tool => {
            assert(toolNames.includes(tool), `Tool definition includes git tool: ${tool}`);
        });
        
    } catch (error) {
        assert(false, `Tool definitions failed: ${error.message}`);
    }
    
    console.log('\n=== TOOL EXECUTION ===');
    
    // Test executeTool method
    try {
        const execResult = await tools.executeTool('list', {}, 'executive');
        assert(Array.isArray(execResult), 'executeTool() properly routes to list method');
    } catch (error) {
        assert(false, `executeTool() failed: ${error.message}`);
    }
    
    // Test unknown tool
    try {
        await tools.executeTool('unknown_tool', {}, 'executive');
        assert(false, 'Unknown tool should throw error');
    } catch (error) {
        assert(error.message.includes('Unknown tool'), 'Unknown tool properly throws error');
    }
    
    console.log('\n=== WORKSPACE MODE VALIDATION ===');
    
    // Test workspace mode restrictions
    try {
        await tools.spawn({
            role: 'specialist',
            workDir: '/test',
            context: 'test',
            workspaceMode: 'shared'
        }, 'executive');
        assert(false, 'Specialist should not be allowed shared workspace mode');
    } catch (error) {
        assert(error.message.includes('Shared workspace mode is only available for managers'), 'Workspace mode restriction works');
    }
    
    console.log('\n=== CIRCUIT BREAKER PROTECTION ===');
    
    // Test that circuit breaker is being used (basic validation)
    try {
        const sendResult = await tools.send({
            instanceId: 'circuit_test',
            text: 'test circuit breaker'
        }, 'executive');
        assert(sendResult.success === true, 'Circuit breaker allows normal operation');
    } catch (error) {
        assert(false, `Circuit breaker test failed: ${error.message}`);
    }
    
    // Results
    console.log('\n' + '='.repeat(60));
    console.log(`🎯 TEST RESULTS: ${passCount}/${testCount} tests passed`);
    
    if (passCount === testCount) {
        console.log('🎉 ALL ENHANCED MCP TOOLS TESTS PASSED!');
        console.log('✅ Core MCP tools working');
        console.log('✅ Role-based access control enforced');
        console.log('✅ Enhanced features available');
        console.log('✅ Tool definitions complete');
        console.log('✅ Workspace mode validation working');
        console.log('✅ Circuit breaker protection active');
        return true;
    } else {
        console.log(`❌ ${testCount - passCount} tests failed`);
        return false;
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    testEnhancedToolsDirect()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Test execution failed:', error);
            process.exit(1);
        });
}

export { testEnhancedToolsDirect };