#!/usr/bin/env node

/**
 * Debug MCP Issue
 * 
 * Figure out why executives report no MCP tools despite our fix
 */

import { InstanceManager } from '../src/instance_manager.js';
import fs from 'fs/promises';
import { execSync } from 'child_process';

async function debugMCP() {
    console.log('=== Debugging MCP Tool Access ===\n');
    
    const manager = new InstanceManager('./state');
    const testDir = `debug_mcp_${Date.now()}`;
    
    try {
        // Create test directory
        await fs.mkdir(testDir, { recursive: true });
        
        // Spawn executive
        console.log('1. Spawning executive...');
        const { instanceId: execId } = await manager.spawnInstance(
            'executive',
            testDir,
            'Debug executive - checking MCP tool access'
        );
        console.log(`   ✓ Executive created: ${execId}`);
        
        // Check what files were created
        console.log('\n2. Checking created files...');
        const instanceDir = `${testDir}/${execId}`;
        try {
            const files = await fs.readdir(`${instanceDir}/.claude`);
            console.log(`   Files in ${instanceDir}/.claude:`, files);
            
            // Check settings.json content
            const settings = await fs.readFile(`${instanceDir}/.claude/settings.json`, 'utf-8');
            const settingsObj = JSON.parse(settings);
            console.log('   MCP servers configured:', Object.keys(settingsObj.mcpServers || {}));
        } catch (e) {
            console.log('   Error reading .claude directory:', e.message);
        }
        
        // Wait for initialization
        console.log('\n3. Waiting for Claude to initialize...');
        await new Promise(r => setTimeout(r, 10000));
        
        // Send debug command
        console.log('\n4. Sending debug commands...');
        
        // Check environment
        await manager.sendToInstance(execId, 'Run: echo "CLAUDE_CODE_ENTRYPOINT=$CLAUDE_CODE_ENTRYPOINT CLAUDECODE=$CLAUDECODE"');
        await new Promise(r => setTimeout(r, 2000));
        
        // Check settings location
        await manager.sendToInstance(execId, 'Run: ls -la .claude/');
        await new Promise(r => setTimeout(r, 2000));
        
        // Check MCP tools explicitly
        await manager.sendToInstance(execId, 'List ALL your available tools/functions. Include any with "tmux" or "mcp" in the name.');
        await new Promise(r => setTimeout(r, 3000));
        
        // Read all output
        console.log('\n5. Reading output...');
        const { output } = await manager.readFromInstance(execId, 100);
        
        console.log('\n=== FULL OUTPUT ===');
        console.log(output);
        console.log('===================\n');
        
        // Analysis
        console.log('6. Analysis:');
        console.log('   - Contains "spawn"?', output.includes('spawn'));
        console.log('   - Contains "tmux-claude"?', output.includes('tmux-claude'));
        console.log('   - Contains "CLAUDE_CODE_ENTRYPOINT=cli"?', output.includes('CLAUDE_CODE_ENTRYPOINT=cli'));
        console.log('   - Contains "settings.json"?', output.includes('settings.json'));
        
        console.log('\n7. Keeping test directory for inspection:', testDir);
        console.log('   To inspect: cd', testDir);
        
        // Don't cleanup - keep for debugging
        
    } catch (error) {
        console.error('\nError:', error);
    }
}

debugMCP().catch(console.error);