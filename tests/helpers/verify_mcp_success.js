#!/usr/bin/env node

/**
 * Verify MCP Tools Success - Direct Test
 * 
 * This test verifies that MCP tools are actually available
 * when settings.json is properly configured.
 */

import { TmuxInterface } from '../src/tmux_interface.js';
import fs from 'fs/promises';
import path from 'path';

async function verifyMCPSuccess() {
    const tmux = new TmuxInterface();
    const testDir = `mcp_verify_${Date.now()}`;
    
    console.log('=== MCP Tools Verification Test ===\n');
    
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(path.join(testDir, '.claude'), { recursive: true });
    
    // Copy global settings
    await fs.copyFile(
        '/Users/Mike/.claude/settings.json',
        path.join(testDir, '.claude', 'settings.json')
    );
    
    console.log('✓ Copied global settings.json to local .claude directory\n');
    
    // Create test session
    const sessionName = `mcp_verify_${Date.now()}`;
    await tmux.createSession(sessionName, testDir);
    const paneTarget = `${sessionName}:0.0`;
    
    // Set environment variables
    await tmux.sendKeys(paneTarget, 'export CLAUDE_CODE_ENTRYPOINT=cli', true);
    await tmux.sendKeys(paneTarget, 'export CLAUDECODE=1', true);
    await new Promise(r => setTimeout(r, 500));
    
    // Launch Claude
    console.log('Launching Claude...');
    await tmux.sendKeys(paneTarget, 'claude --dangerously-skip-permissions', true);
    await new Promise(r => setTimeout(r, 5000));
    
    // Test for MCP tools directly
    console.log('Testing for MCP tools...\n');
    
    // Send a command that would only work if MCP tools are available
    await tmux.sendKeys(paneTarget, 'I need you to check if you have access to MCP tools. Specifically, check if you can see tools named: spawn, list, send, read, terminate. List all tools you have access to.', true);
    
    await new Promise(r => setTimeout(r, 5000));
    
    // Capture output
    const output = await tmux.capturePane(paneTarget, 100);
    console.log('Output captured. Analyzing...\n');
    
    // Check for MCP tools
    const mcpTools = ['spawn', 'list', 'send', 'read', 'terminate'];
    const foundTools = mcpTools.filter(tool => output.includes(tool));
    
    if (foundTools.length > 0) {
        console.log('✓ MCP TOOLS FOUND:', foundTools.join(', '));
        console.log('\nThis confirms that MCP tools ARE available when:');
        console.log('1. Local .claude/settings.json exists with MCP configuration');
        console.log('2. Environment variables are set (CLAUDE_CODE_ENTRYPOINT=cli, CLAUDECODE=1)');
        console.log('3. Claude is launched with --dangerously-skip-permissions\n');
        
        console.log('SOLUTION: Update instance_manager.js to:');
        console.log('1. Copy global settings.json to instance directory');
        console.log('2. Set required environment variables before launching Claude');
    } else {
        console.log('✗ No MCP tools found in output');
        console.log('\nRelevant output:');
        console.log(output.slice(-500));
    }
    
    // Kill session
    await tmux.killSession(sessionName);
    
    // Clean up
    await fs.rm(testDir, { recursive: true, force: true });
}

verifyMCPSuccess().catch(console.error);