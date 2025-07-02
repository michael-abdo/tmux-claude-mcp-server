#!/usr/bin/env node
/**
 * Safety test for MCP Tools consolidation
 * Verifies core functionality works before and after duplicate removal
 */

import assert from 'assert';
import { EnhancedMCPTools } from './src/enhanced_mcp_tools.js';

async function testMCPToolsCore() {
    console.log('🧪 Testing MCP Tools core functionality...');
    
    // Mock instance manager for testing
    const mockInstanceManager = {
        spawnInstance: async () => ({ instanceId: 'test_123', paneId: '0', projectPath: '/test' }),
        sendToInstance: async () => ({ success: true }),
        readFromInstance: async () => ({ output: 'test output', success: true }),
        listInstances: async () => [{ instanceId: 'test_123', role: 'specialist', status: 'active' }],
        isInstanceActive: async () => true,
        terminateInstance: async () => true,
        restartInstance: async () => ({ success: true })
    };
    
    const tools = new EnhancedMCPTools(mockInstanceManager);
    
    // Test spawn
    const spawnResult = await tools.spawn({
        role: 'specialist',
        workDir: '/test',
        context: 'test context'
    });
    assert.strictEqual(spawnResult.instanceId, 'test_123');
    console.log('✅ spawn() works');
    
    // Test send
    const sendResult = await tools.send({
        instanceId: 'test_123',
        text: 'test message'
    });
    assert.strictEqual(sendResult.success, true);
    console.log('✅ send() works');
    
    // Test read
    const readResult = await tools.read({
        instanceId: 'test_123'
    });
    assert.strictEqual(readResult.success, true);
    console.log('✅ read() works');
    
    // Test list
    const listResult = await tools.list({});
    assert(Array.isArray(listResult));
    console.log('✅ list() works');
    
    // Test terminate
    const terminateResult = await tools.terminate({
        instanceId: 'test_123'
    });
    assert.strictEqual(terminateResult.success, true);
    console.log('✅ terminate() works');
    
    console.log('🎉 All MCP Tools core functionality verified!');
}

// Run test if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
    testMCPToolsCore().catch(error => {
        console.error('❌ Safety test failed:', error);
        process.exit(1);
    });
}

export { testMCPToolsCore };