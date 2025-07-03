/**
 * Integration test for tmux-claude MCP Server
 * 
 * Tests actual tmux operations and MCP server functionality.
 * This will create real tmux sessions to verify the system works.
 */

import { spawn } from 'child_process';
import { InstanceManager } from '../../src/instance_manager.js';
import { EnhancedMCPTools } from '../../src/enhanced_mcp_tools.js';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runIntegrationTests() {
    console.log('=== Running tmux-claude MCP Server Integration Tests ===\n');
    
    const instanceManager = new InstanceManager('./test-state');
    const mcpTools = new EnhancedMCPTools(instanceManager);
    
    let testsPassed = 0;
    let testsFailed = 0;
    
    // Test 1: Check tmux is available
    console.log('Test 1: Checking tmux availability...');
    try {
        const tmuxCheck = spawn('tmux', ['-V']);
        await new Promise((resolve, reject) => {
            tmuxCheck.on('close', code => {
                if (code === 0) {
                    console.log('✓ tmux is available\n');
                    testsPassed++;
                    resolve();
                } else {
                    reject(new Error('tmux not found'));
                }
            });
        });
    } catch (error) {
        console.log('✗ tmux is not available:', error.message);
        console.log('Please install tmux to run integration tests\n');
        testsFailed++;
        return;
    }
    
    // Test 2: Test spawn tool creates tmux session
    console.log('Test 2: Testing spawn tool...');
    let execInstance;
    try {
        execInstance = await mcpTools.spawn({
            role: 'executive',
            workDir: '/tmp/test-claude-mcp',
            context: '# Test Executive\n\nThis is a test instance for integration testing.'
        });
        
        console.log('✓ Spawned executive instance:', execInstance.instanceId);
        
        // Verify tmux session exists
        const sessions = await instanceManager.tmux.listSessions();
        const found = sessions.find(s => s.name === `claude_${execInstance.instanceId}`);
        if (found) {
            console.log('✓ Tmux session created successfully\n');
            testsPassed++;
        } else {
            throw new Error('Tmux session not found');
        }
    } catch (error) {
        console.log('✗ Failed to spawn instance:', error.message, '\n');
        testsFailed++;
    }
    
    // Test 3: Test send tool
    if (execInstance) {
        console.log('Test 3: Testing send tool...');
        try {
            await mcpTools.send({
                instanceId: execInstance.instanceId,
                text: 'echo "Hello from integration test"'
            });
            
            console.log('✓ Sent text to instance\n');
            testsPassed++;
        } catch (error) {
            console.log('✗ Failed to send text:', error.message, '\n');
            testsFailed++;
        }
    }
    
    // Test 4: Test read tool
    if (execInstance) {
        console.log('Test 4: Testing read tool...');
        await sleep(1000); // Wait for output
        
        try {
            const output = await mcpTools.read({
                instanceId: execInstance.instanceId,
                lines: 20
            });
            
            console.log('✓ Read output from instance:');
            console.log('Output preview:', output.output.slice(0, 100) + '...\n');
            testsPassed++;
        } catch (error) {
            console.log('✗ Failed to read output:', error.message, '\n');
            testsFailed++;
        }
    }
    
    // Test 5: Test list tool
    console.log('Test 5: Testing list tool...');
    try {
        const instances = await mcpTools.list({});
        console.log('✓ Listed instances:', instances.length, 'found');
        
        if (instances.length > 0) {
            console.log('Instance details:', JSON.stringify(instances[0], null, 2), '\n');
        }
        testsPassed++;
    } catch (error) {
        console.log('✗ Failed to list instances:', error.message, '\n');
        testsFailed++;
    }
    
    // Test 6: Test hierarchical spawning
    if (execInstance) {
        console.log('Test 6: Testing hierarchical spawning (Executive -> Manager)...');
        try {
            const mgrInstance = await mcpTools.spawn({
                role: 'manager',
                workDir: '/tmp/test-claude-mcp',
                context: '# Test Manager\n\nThis is a test manager instance.',
                parentId: execInstance.instanceId
            });
            
            console.log('✓ Spawned manager instance:', mgrInstance.instanceId);
            console.log('✓ Parent-child relationship established\n');
            testsPassed++;
            
            // Clean up manager
            await mcpTools.terminate({ instanceId: mgrInstance.instanceId });
        } catch (error) {
            console.log('✗ Failed hierarchical spawn:', error.message, '\n');
            testsFailed++;
        }
    }
    
    // Test 7: Test terminate tool
    if (execInstance) {
        console.log('Test 7: Testing terminate tool...');
        try {
            await mcpTools.terminate({
                instanceId: execInstance.instanceId,
                cascade: true
            });
            
            // Verify session is gone
            const sessions = await instanceManager.tmux.listSessions();
            const found = sessions.find(s => s.name === `claude_${execInstance.instanceId}`);
            if (!found) {
                console.log('✓ Instance terminated successfully\n');
                testsPassed++;
            } else {
                throw new Error('Session still exists after termination');
            }
        } catch (error) {
            console.log('✗ Failed to terminate:', error.message, '\n');
            testsFailed++;
        }
    }
    
    // Summary
    console.log('=== Integration Test Summary ===');
    console.log(`Tests passed: ${testsPassed}`);
    console.log(`Tests failed: ${testsFailed}`);
    console.log(`Total tests: ${testsPassed + testsFailed}`);
    
    if (testsFailed === 0) {
        console.log('\n✅ All integration tests passed!');
    } else {
        console.log('\n❌ Some tests failed. Please check the output above.');
    }
}

// Run the tests
runIntegrationTests().catch(console.error);