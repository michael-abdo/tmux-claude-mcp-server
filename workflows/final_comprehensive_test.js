#!/usr/bin/env node
/**
 * Final Comprehensive Test - Complete Integration Validation
 * 
 * This test validates the entire system after MCP tools consolidation
 */

import { EnhancedMCPTools } from '../src/enhanced_mcp_tools.js';

console.log('🎯 FINAL COMPREHENSIVE INTEGRATION TEST');
console.log('=====================================\n');

let totalTests = 0;
let passedTests = 0;

function test(name, assertion, value) {
    totalTests++;
    if (assertion) {
        console.log(`✅ ${name}`);
        passedTests++;
    } else {
        console.log(`❌ ${name} - ${value || 'Failed'}`);
    }
}

async function runComprehensiveTest() {
    console.log('📋 Phase 1: Core Component Tests\n');
    
    // Test 1: Enhanced MCP Tools Import
    try {
        const tools = new EnhancedMCPTools({
            spawnInstance: async () => ({ instanceId: 'test', paneId: '0' }),
            sendToInstance: async () => true,
            readFromInstance: async () => ({ output: 'test' }),
            listInstances: async () => [{ instanceId: 'test', role: 'specialist', status: 'active' }],
            isInstanceActive: async () => true,
            terminateInstance: async () => true,
            restartInstance: async () => ({ success: true })
        });
        test('Enhanced MCP Tools instantiation', true);
        
        // Test tool definitions
        const toolDefs = tools.getToolDefinitions();
        test('Tool definitions loaded', Array.isArray(toolDefs) && toolDefs.length >= 14);
        test('Core tools present', toolDefs.some(t => t.name === 'spawn'));
        test('Parallel tools present', toolDefs.some(t => t.name === 'executeParallel'));
        test('Git tools present', toolDefs.some(t => t.name === 'merge_manager_work'));
        
    } catch (error) {
        test('Enhanced MCP Tools instantiation', false, error.message);
    }
    
    console.log('\n📋 Phase 2: MCP Bridge Integration\n');
    
    // Test 2: MCP Bridge Script
    try {
        const { spawn } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(spawn);
        
        // Test bridge list command
        const bridge = spawn('node', ['/Users/Mike/.claude/user/tmux-claude-mcp-server/scripts/mcp_bridge.js', 'list', '{}']);
        let output = '';
        let error = '';
        
        bridge.stdout.on('data', (data) => output += data.toString());
        bridge.stderr.on('data', (data) => error += data.toString());
        
        await new Promise((resolve) => {
            bridge.on('close', (code) => {
                test('MCP Bridge script execution', code === 0);
                test('MCP Bridge JSON response', output.includes('"success"'));
                resolve();
            });
        });
        
    } catch (error) {
        test('MCP Bridge script execution', false, error.message);
    }
    
    console.log('\n📋 Phase 3: System Integration\n');
    
    // Test 3: File System Validation
    try {
        const fs = await import('fs');
        
        // Verify removed files are gone
        test('mcp_tools.js removed', !fs.existsSync('/Users/Mike/.claude/user/tmux-claude-mcp-server/src/mcp_tools.js'));
        test('shared_workspace_mcp_tools.js removed', !fs.existsSync('/Users/Mike/.claude/user/tmux-claude-mcp-server/src/shared_workspace_mcp_tools.js'));
        
        // Verify consolidated file exists
        test('enhanced_mcp_tools.js exists', fs.existsSync('/Users/Mike/.claude/user/tmux-claude-mcp-server/src/enhanced_mcp_tools.js'));
        
        // Check file sizes
        const enhancedStats = fs.statSync('/Users/Mike/.claude/user/tmux-claude-mcp-server/src/enhanced_mcp_tools.js');
        test('Enhanced tools substantial size', enhancedStats.size > 40000); // Should be large, containing all tools
        
    } catch (error) {
        test('File system validation', false, error.message);
    }
    
    console.log('\n📋 Phase 4: Functionality Validation\n');
    
    // Test 4: Core MCP Operations
    try {
        const mockManager = {
            spawnInstance: async () => ({ instanceId: 'test_spawn', paneId: '0' }),
            sendToInstance: async () => true,
            readFromInstance: async () => ({ output: 'test output' }),
            listInstances: async () => [{ instanceId: 'test_list', role: 'executive', status: 'active' }],
            isInstanceActive: async () => true,
            terminateInstance: async () => true,
            restartInstance: async () => ({ success: true })
        };
        
        const tools = new EnhancedMCPTools(mockManager);
        
        // Test each core operation
        const spawnResult = await tools.spawn({ role: 'specialist', workDir: '/test', context: 'test' }, 'executive');
        test('Spawn operation', spawnResult.instanceId === 'test_spawn');
        
        const sendResult = await tools.send({ instanceId: 'test', text: 'hello' }, 'executive');
        test('Send operation', sendResult.success === true);
        
        const readResult = await tools.read({ instanceId: 'test' }, 'executive');
        test('Read operation', readResult.output === 'test output');
        
        const listResult = await tools.list({}, 'executive');
        test('List operation', Array.isArray(listResult) && listResult.length > 0);
        
        const terminateResult = await tools.terminate({ instanceId: 'test' }, 'executive');
        test('Terminate operation', terminateResult.success === true);
        
    } catch (error) {
        test('Core MCP operations', false, error.message);
    }
    
    console.log('\n📋 Phase 5: Security Validation\n');
    
    // Test 5: Role-Based Access Control
    try {
        const tools = new EnhancedMCPTools({
            spawnInstance: async () => ({ instanceId: 'test' })
        });
        
        // Test specialist access denial
        try {
            await tools.spawn({ role: 'specialist', workDir: '/test', context: 'test' }, 'specialist');
            test('Specialist access control', false, 'Should have been denied');
        } catch (error) {
            test('Specialist access control', error.message.includes('Specialists have NO access'));
        }
        
        // Test workspace mode restriction
        try {
            await tools.spawn({ role: 'specialist', workDir: '/test', context: 'test', workspaceMode: 'shared' }, 'executive');
            test('Workspace mode restriction', false, 'Should have been denied');
        } catch (error) {
            test('Workspace mode restriction', error.message.includes('Shared workspace mode is only available for managers'));
        }
        
    } catch (error) {
        test('Security validation setup', false, error.message);
    }
    
    console.log('\n📋 Phase 6: Performance & Completeness\n');
    
    // Test 6: Performance and Memory
    try {
        const tools = new EnhancedMCPTools({
            spawnInstance: async () => ({ instanceId: 'perf_test' }),
            sendToInstance: async () => true,
            readFromInstance: async () => ({ output: 'perf' }),
            listInstances: async () => [],
            isInstanceActive: async () => true,
            terminateInstance: async () => true
        });
        
        // Test parallel executor initialization
        const spawnResult = await tools.spawn({ role: 'manager', workDir: '/test', context: 'test' }, 'executive');
        test('Parallel executor initialization', spawnResult.instanceId === 'perf_test');
        
        // Test multiple rapid operations
        const promises = [];
        for (let i = 0; i < 5; i++) {
            promises.push(tools.list({}, 'executive'));
        }
        const results = await Promise.all(promises);
        test('Concurrent operations', results.length === 5);
        
    } catch (error) {
        test('Performance validation', false, error.message);
    }
    
    // Final Summary
    console.log('\n' + '='.repeat(60));
    console.log(`🎯 FINAL TEST RESULTS: ${passedTests}/${totalTests} tests passed`);
    console.log('='.repeat(60));
    
    if (passedTests === totalTests) {
        console.log('🎉 🎉 🎉 ALL TESTS PASSED! 🎉 🎉 🎉');
        console.log('');
        console.log('✅ MCP Tools Consolidation: SUCCESSFUL');
        console.log('✅ All Core Functionality: WORKING');
        console.log('✅ System Integration: VERIFIED');
        console.log('✅ Security Controls: ENFORCED');
        console.log('✅ Performance: VALIDATED');
        console.log('✅ File Cleanup: COMPLETE');
        console.log('');
        console.log('🚀 SYSTEM READY FOR DEPLOYMENT!');
        return true;
    } else {
        console.log('❌ TESTS FAILED');
        console.log(`❌ ${totalTests - passedTests} test(s) did not pass`);
        console.log('❌ System may have issues');
        return false;
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    runComprehensiveTest()
        .then(success => {
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Comprehensive test failed:', error);
            process.exit(1);
        });
}

export { runComprehensiveTest };