#!/usr/bin/env node

/**
 * Simple script to send Enter key to all tmux sessions to unstick any waiting for input
 * Refactored to use canonical TmuxInterface instead of duplicating tmux operations
 */

import { TmuxInterface } from '../src/tmux_interface.js';

async function main() {
    console.log('🔍 Looking for tmux sessions...');
    
    const tmux = new TmuxInterface();
    
    try {
        const sessions = await tmux.listSessions();
        
        if (sessions.length === 0) {
            console.log('No tmux sessions found.');
            return;
        }
        
        console.log(`\nFound ${sessions.length} tmux session(s):`);
        sessions.forEach(session => {
            console.log(`  - ${session.name}`);
        });
        
        console.log('\n📤 Sending Enter key to each session...');
        
        let successCount = 0;
        const execSessions = [];
        
        for (const session of sessions) {
            try {
                // Use canonical TmuxInterface sendKeys method
                const target = tmux.getPaneTarget(session.name);
                await tmux.sendKeys(target, '', true); // Send Enter key
                console.log(`✓ Sent Enter to: ${session.name}`);
                successCount++;
                
                // Track claude_exec_* sessions
                if (session.name.startsWith('claude_exec_')) {
                    execSessions.push(session.name);
                }
            } catch (error) {
                console.log(`✗ Failed to send Enter to: ${session.name} - ${error.message}`);
            }
        }
        
        console.log(`\n📊 Summary: Successfully sent Enter to ${successCount}/${sessions.length} sessions`);
        
        if (execSessions.length > 0) {
            console.log(`\n🎯 Found ${execSessions.length} claude_exec_* session(s) that were updated:`);
            execSessions.forEach(session => {
                console.log(`  - ${session}`);
            });
        }
        
        console.log('\n✅ Done!');
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Run the script
main();