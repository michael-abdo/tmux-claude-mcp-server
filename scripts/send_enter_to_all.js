#!/usr/bin/env node

/**
 * Simple script to send Enter key to all tmux sessions to unstick any waiting for input
 */

import { execSync } from 'child_process';

function getTmuxSessions() {
    try {
        const output = execSync('tmux list-sessions', { encoding: 'utf8' });
        const sessions = [];
        const lines = output.trim().split('\n');
        
        for (const line of lines) {
            if (line) {
                const sessionName = line.split(':')[0];
                sessions.push(sessionName);
            }
        }
        
        return sessions;
    } catch (error) {
        if (error.message.includes('no server running')) {
            console.log('No tmux server is running or no sessions found.');
        } else {
            console.error('Error getting sessions:', error.message);
        }
        return [];
    }
}

function sendEnterToSession(sessionName) {
    try {
        execSync(`tmux send-keys -t ${sessionName} Enter`);
        return true;
    } catch (error) {
        console.error(`Failed to send Enter to ${sessionName}:`, error.message);
        return false;
    }
}

function main() {
    console.log('🔍 Looking for tmux sessions...');
    
    const sessions = getTmuxSessions();
    
    if (sessions.length === 0) {
        console.log('No tmux sessions found.');
        return;
    }
    
    console.log(`\nFound ${sessions.length} tmux session(s):`);
    sessions.forEach(session => {
        console.log(`  - ${session}`);
    });
    
    console.log('\n📤 Sending Enter key to each session...');
    
    let successCount = 0;
    const execSessions = [];
    
    for (const session of sessions) {
        if (sendEnterToSession(session)) {
            console.log(`✓ Sent Enter to: ${session}`);
            successCount++;
            
            // Track claude_exec_* sessions
            if (session.startsWith('claude_exec_')) {
                execSessions.push(session);
            }
        } else {
            console.log(`✗ Failed to send Enter to: ${session}`);
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
}

// Run the script
main();