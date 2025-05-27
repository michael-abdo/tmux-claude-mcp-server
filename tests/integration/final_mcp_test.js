#!/usr/bin/env node

/**
 * Final MCP Test - Manual verification
 * 
 * This test creates an executive and manually inspects its state
 */

import { TmuxInterface } from '../src/tmux_interface.js';
import fs from 'fs/promises';
import path from 'path';

async function finalTest() {
    console.log('=== Final MCP Test ===\n');
    
    const tmux = new TmuxInterface();
    const testDir = `final_test_${Date.now()}`;
    const sessionName = `test_exec_${Date.now()}`;
    
    try {
        // Create directory structure
        await fs.mkdir(testDir, { recursive: true });
        const execDir = path.join(testDir, 'executive');
        await fs.mkdir(execDir, { recursive: true });
        await fs.mkdir(path.join(execDir, '.claude'), { recursive: true });
        
        // Copy settings
        await fs.copyFile(
            '/Users/Mike/.claude/settings.json',
            path.join(execDir, '.claude', 'settings.json')
        );
        
        console.log('1. Created directory:', execDir);
        console.log('2. Copied settings.json');
        
        // Create session
        await tmux.createSession(sessionName, execDir);
        const paneTarget = `${sessionName}:0.0`;
        
        console.log('3. Created tmux session:', sessionName);
        
        // Set environment and launch
        console.log('4. Setting environment and launching Claude...\n');
        
        await tmux.sendKeys(paneTarget, 'pwd', true);
        await new Promise(r => setTimeout(r, 500));
        
        await tmux.sendKeys(paneTarget, 'export CLAUDE_CODE_ENTRYPOINT=cli', true);
        await tmux.sendKeys(paneTarget, 'export CLAUDECODE=1', true);
        await tmux.sendKeys(paneTarget, 'export CLAUDE_HOME=$(pwd)', true);
        await new Promise(r => setTimeout(r, 500));
        
        await tmux.sendKeys(paneTarget, 'ls -la .claude/', true);
        await new Promise(r => setTimeout(r, 500));
        
        await tmux.sendKeys(paneTarget, 'claude --dangerously-skip-permissions', true);
        
        console.log('5. Waiting for Claude to initialize...');
        await new Promise(r => setTimeout(r, 10000));
        
        // Send test
        console.log('6. Sending MCP test command...\n');
        await tmux.sendKeys(paneTarget, 'Do you have access to MCP tools? Specifically: spawn, list, send, read, terminate? Please check thoroughly.', true);
        
        await new Promise(r => setTimeout(r, 5000));
        
        // Capture output
        const output = await tmux.capturePane(paneTarget, 100);
        
        console.log('=== OUTPUT ===');
        console.log(output);
        console.log('==============\n');
        
        console.log('7. Test complete. Session:', sessionName);
        console.log('   To inspect manually: tmux attach -t', sessionName);
        console.log('   To kill: tmux kill-session -t', sessionName);
        console.log('\n   Directory:', execDir);
        
    } catch (error) {
        console.error('Error:', error);
    }
}

finalTest().catch(console.error);