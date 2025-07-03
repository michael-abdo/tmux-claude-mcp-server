import { TmuxInterface } from '../../src/tmux_interface.js';

const SESSION_NAME = 'claude_exec_1749369856326';

async function main() {
    const tmux = new TmuxInterface();
    
    console.log(`Checking for session: ${SESSION_NAME}`);

    try {
        // Check if session exists using canonical TmuxInterface
        const sessionExists = await tmux.sessionExists(SESSION_NAME);

        if (sessionExists) {
            console.log(`✓ Session ${SESSION_NAME} exists`);
            
            // Send Enter key using canonical method
            console.log('Sending Enter key...');
            try {
                const target = tmux.getPaneTarget(SESSION_NAME);
                await tmux.sendKeys(target, '', true); // Send Enter
                console.log(`✓ Successfully sent Enter key to session ${SESSION_NAME}`);
            } catch (error) {
                console.log(`✗ Failed to send Enter key: ${error.message}`);
            }
        } else {
            console.log(`✗ Session ${SESSION_NAME} does not exist`);
        }

        // List all tmux sessions using canonical method
        console.log('\nAll tmux sessions:');
        const sessions = await tmux.listSessions();
        
        if (sessions.length > 0) {
            sessions.forEach(session => {
                console.log(`${session.name}: ${session.windows} windows (${session.attached ? 'attached' : 'detached'})`);
            });
            
            // Look for claude_exec sessions with long timestamps
            console.log('\nClaude exec sessions with long timestamps:');
            sessions.forEach(session => {
                if (session.name.includes('claude_exec_')) {
                    const match = session.name.match(/claude_exec_(\d+)/);
                    if (match && match[1].length > 10) {
                        console.log(`  - ${session.name}: ${session.windows} windows (${session.attached ? 'attached' : 'detached'})`);
                    }
                }
            });
        } else {
            console.log('No tmux sessions found');
        }

        // Also check for any sessions starting with 'claude_'
        console.log('\nAll Claude-related sessions:');
        const claudeSessions = sessions.filter(session => session.name.startsWith('claude_'));
        if (claudeSessions.length > 0) {
            claudeSessions.forEach(session => {
                console.log(`${session.name}: ${session.windows} windows (${session.attached ? 'attached' : 'detached'})`);
            });
        } else {
            console.log('No Claude sessions found');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Run the script
main();