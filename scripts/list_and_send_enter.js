#!/usr/bin/env node

/**
 * Script to list all tmux sessions and send Enter to sessions with old naming format
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function listAllTmuxSessions() {
    try {
        const { stdout } = await execAsync('tmux list-sessions -F "#{session_name}"');
        const sessions = stdout.trim().split('\n').filter(s => s);
        console.log(`Found ${sessions.length} tmux sessions:`);
        sessions.forEach(session => console.log(`  - ${session}`));
        return sessions;
    } catch (error) {
        if (error.message.includes('no server running')) {
            console.log('No tmux server running');
            return [];
        }
        console.error(`Error listing sessions: ${error.message}`);
        return [];
    }
}

async function sendEnterToSession(sessionName) {
    try {
        // Send Enter key (C-m in tmux)
        await execAsync(`tmux send-keys -t "${sessionName}" "C-m"`);
        console.log(`✓ Sent Enter to session: ${sessionName}`);
        return true;
    } catch (error) {
        console.error(`✗ Failed to send Enter to ${sessionName}: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('Listing all tmux sessions...\n');
    
    const sessions = await listAllTmuxSessions();
    
    if (sessions.length === 0) {
        console.log('No tmux sessions found.');
        return;
    }
    
    // Find sessions with old naming format (e.g., claude_exec_1749369856326)
    const oldFormatSessions = sessions.filter(session => 
        session.match(/^claude_(exec|mgr|spec)_\d{13}$/)
    );
    
    if (oldFormatSessions.length === 0) {
        console.log('\nNo sessions with old naming format found.');
        return;
    }
    
    console.log(`\nFound ${oldFormatSessions.length} session(s) with old naming format:`);
    oldFormatSessions.forEach(session => console.log(`  - ${session}`));
    
    console.log('\nSending Enter to each old format session...\n');
    
    for (const session of oldFormatSessions) {
        await sendEnterToSession(session);
        // Small delay between sends
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\nDone!');
}

main().catch(console.error);