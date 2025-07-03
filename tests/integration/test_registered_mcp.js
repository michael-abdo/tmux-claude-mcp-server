#!/usr/bin/env node
/**
 * Test MCP tools with registered server
 */

import { InstanceManager } from '../src/instance_manager.js';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testRegisteredMCP() {
    console.log('🧪 Testing MCP Tools with Registered Server\n');
    
    // Verify server is registered
    try {
        const mcpList = execSync('claude mcp list', { encoding: 'utf8' });
        console.log('✅ Registered MCP servers:');
        console.log(mcpList);
    } catch (error) {
        console.error('❌ Failed to list MCP servers');
        return;
    }
    
    // Create test instance
    const instanceManager = new InstanceManager();
    const testDir = path.join(__dirname, `registered_mcp_test_${Date.now()}`);
    
    const context = `
You are a test executive to verify MCP tool access.

Your ONLY task is to test if you can use MCP tools:

1. Try: list()
2. Try: tmux-claude:list()  
3. Try: spawn({ role: 'manager', workDir: '.', context: 'Test Manager' })
4. Try: tmux-claude:spawn({ role: 'manager', workDir: '.', context: 'Test Manager' })

Report exactly what happens with each attempt.
DO NOT implement anything else.
`;

    try {
        const result = await instanceManager.spawnInstance(
            'executive',
            testDir,
            context,
            null
        );
        
        console.log(`✅ Created test executive: ${result.instanceId}`);
        console.log(`📁 Project: ${result.projectPath}`);
        console.log(`\n⏳ Waiting 30 seconds for MCP tool testing...\n`);
        
        // Wait for testing
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        // Check output
        const sessionName = `claude_${result.instanceId}`;
        const output = execSync(`tmux capture-pane -t ${sessionName} -p`, { encoding: 'utf8' });
        
        console.log('📊 Executive Output:');
        console.log('===================');
        const lines = output.split('\n').slice(-50);
        
        // Look for MCP tool usage
        let foundMCPUsage = false;
        lines.forEach(line => {
            if (line.includes('list()') || 
                line.includes('spawn') || 
                line.includes('tmux-claude:') ||
                line.includes('instances') ||
                line.includes('Manager')) {
                console.log(line);
                if (line.includes('exec_') || line.includes('mgr_')) {
                    foundMCPUsage = true;
                }
            }
        });
        
        if (foundMCPUsage) {
            console.log('\n✅ SUCCESS! Executive can access MCP tools!');
        } else {
            console.log('\n❌ Executive still cannot access MCP tools');
        }
        
        // Cleanup
        await instanceManager.terminateInstance(result.instanceId);
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

testRegisteredMCP().catch(console.error);