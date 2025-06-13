#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectId = '021931083951805703367';
const projectDir = `/Users/Mike/Desktop/programming/2_proposals/upwork/${projectId}`;

console.log(`🔍 Checking Project: ${projectId}`);
console.log('═'.repeat(50));

// Check if project directory exists
console.log('\n📁 Project Directory Check:');
if (fs.existsSync(projectDir)) {
    console.log(`✓ Project directory exists: ${projectDir}`);
    
    // List project files
    const files = fs.readdirSync(projectDir);
    console.log(`📄 Files found: ${files.join(', ')}`);
    
    // Check for session info
    const sessionInfoPath = path.join(projectDir, '.tmux_session_info.json');
    if (fs.existsSync(sessionInfoPath)) {
        console.log('✓ Session info file found');
        try {
            const sessionInfo = JSON.parse(fs.readFileSync(sessionInfoPath, 'utf8'));
            console.log('📋 Session Info:', JSON.stringify(sessionInfo, null, 2));
        } catch (e) {
            console.log('❌ Error reading session info:', e.message);
        }
    } else {
        console.log('❌ No .tmux_session_info.json file found');
    }
} else {
    console.log(`❌ Project directory does not exist: ${projectDir}`);
}

// Check instances.json for any reference to this project
console.log('\n🗃️  Instances Registry Check:');
const instancesPath = '/Users/Mike/.claude/user/tmux-claude-mcp-server/state/instances.json';
if (fs.existsSync(instancesPath)) {
    try {
        const instances = JSON.parse(fs.readFileSync(instancesPath, 'utf8'));
        const projectInstances = [];
        
        for (const [instanceId, instanceData] of Object.entries(instances.instances || {})) {
            if (JSON.stringify(instanceData).includes(projectId)) {
                projectInstances.push({ instanceId, ...instanceData });
            }
        }
        
        if (projectInstances.length > 0) {
            console.log(`✓ Found ${projectInstances.length} instances for project:`);
            projectInstances.forEach(inst => {
                console.log(`  - ${inst.instanceId} (${inst.role}) - Status: ${inst.status}`);
                console.log(`    Session: ${inst.sessionName}`);
                console.log(`    Created: ${inst.created}`);
            });
        } else {
            console.log('❌ No instances found for this project in instances.json');
        }
    } catch (e) {
        console.log('❌ Error reading instances.json:', e.message);
    }
} else {
    console.log('❌ instances.json not found');
}

// Try to check tmux sessions directly
console.log('\n🖥️  Tmux Sessions Check:');
try {
    // Try multiple tmux locations
    const tmuxPaths = ['/usr/local/bin/tmux', '/opt/homebrew/bin/tmux', 'tmux'];
    let tmuxOutput = null;
    
    for (const tmuxPath of tmuxPaths) {
        try {
            tmuxOutput = execSync(`${tmuxPath} list-sessions 2>/dev/null`, { 
                encoding: 'utf8', 
                timeout: 5000 
            });
            console.log(`✓ Found tmux at: ${tmuxPath}`);
            break;
        } catch (e) {
            // Try next path
        }
    }
    
    if (tmuxOutput) {
        console.log('📋 Tmux Sessions:');
        const lines = tmuxOutput.trim().split('\n');
        
        // Look for project-related sessions
        const projectSessions = lines.filter(line => 
            line.includes(projectId) || 
            line.includes('claude_exec_') || 
            line.includes('claude_mgr_')
        );
        
        if (projectSessions.length > 0) {
            console.log('🎯 Project/Claude-related sessions:');
            projectSessions.forEach(session => console.log(`  ${session}`));
        } else {
            console.log('❌ No project-related sessions found');
        }
        
        console.log(`\nℹ️  Total sessions: ${lines.length}`);
    } else {
        console.log('❌ Could not access tmux');
    }
} catch (e) {
    console.log('❌ Error checking tmux:', e.message);
}

// Check for any log files that might contain project info
console.log('\n📜 Log Files Check:');
const logDirs = [
    '/Users/Mike/.claude/user/tmux-claude-mcp-server/logs',
    path.join(projectDir, 'logs')
];

logDirs.forEach(logDir => {
    if (fs.existsSync(logDir)) {
        try {
            const logFiles = fs.readdirSync(logDir);
            if (logFiles.length > 0) {
                console.log(`📁 Found ${logFiles.length} files in ${logDir}:`);
                logFiles.slice(0, 5).forEach(file => console.log(`  - ${file}`));
                if (logFiles.length > 5) {
                    console.log(`  ... and ${logFiles.length - 5} more`);
                }
            }
        } catch (e) {
            console.log(`❌ Error reading ${logDir}:`, e.message);
        }
    }
});

console.log('\n🔍 Analysis Complete');