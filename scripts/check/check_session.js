const { execSync } = require('child_process');

const SESSION_NAME = 'claude_exec_1749369856326';

function runCommand(cmd) {
    try {
        const output = execSync(cmd, { encoding: 'utf8' });
        return { success: true, output };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

console.log(`Checking for session: ${SESSION_NAME}`);

// Check if session exists
const hasSession = runCommand(`tmux has-session -t ${SESSION_NAME} 2>/dev/null`);

if (hasSession.success) {
    console.log(`✓ Session ${SESSION_NAME} exists`);
    
    // Send Enter key
    console.log('Sending Enter key...');
    const sendResult = runCommand(`tmux send-keys -t ${SESSION_NAME} Enter`);
    
    if (sendResult.success) {
        console.log(`✓ Successfully sent Enter key to session ${SESSION_NAME}`);
    } else {
        console.log(`✗ Failed to send Enter key: ${sendResult.error}`);
    }
} else {
    console.log(`✗ Session ${SESSION_NAME} does not exist`);
}

// List all tmux sessions
console.log('\nAll tmux sessions:');
const listResult = runCommand('tmux list-sessions 2>/dev/null');

if (listResult.success && listResult.output) {
    console.log(listResult.output);
    
    // Look for claude_exec sessions with long timestamps
    console.log('\nClaude exec sessions with long timestamps:');
    const lines = listResult.output.split('\n');
    lines.forEach(line => {
        if (line.includes('claude_exec_')) {
            const match = line.match(/claude_exec_(\d+)/);
            if (match && match[1].length > 10) {
                console.log(`  - ${line}`);
            }
        }
    });
} else {
    console.log('No tmux sessions found');
}

// Also check for any sessions starting with 'claude_'
console.log('\nAll Claude-related sessions:');
const claudeSessions = runCommand('tmux list-sessions 2>/dev/null | grep claude_ || true');
if (claudeSessions.success && claudeSessions.output) {
    console.log(claudeSessions.output);
} else {
    console.log('No Claude sessions found');
}