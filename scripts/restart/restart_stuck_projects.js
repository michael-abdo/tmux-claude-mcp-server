#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const projectDirs = [
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021918433064331880504",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021919090362430743538",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021920099030637438030",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021921346257338424716",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021921831981138262614",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021922023501463108382",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021922290495470175836",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021922559710814724022",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021923422940263632391",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021923506750086859741",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021924483133534911842",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021924802648712635360",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021924892477838555910",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021925011782716318688",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021925205606226552673",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021926034442997674004",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021926792160461773798",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021926811470757658050",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021927921636963300407",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021928107942718286306"
];

// Get all active tmux sessions
function getActiveSessions() {
    try {
        const output = execSync('tmux list-sessions', { encoding: 'utf8' });
        return output.split('\n').filter(line => line.includes('claude_'));
    } catch (error) {
        console.log('No tmux sessions found');
        return [];
    }
}

// Check if project has active session
function hasActiveSession(projectDir) {
    const sessionInfoPath = path.join(projectDir, '.tmux_session_info.json');
    if (!fs.existsSync(sessionInfoPath)) {
        return false;
    }
    
    try {
        const info = JSON.parse(fs.readFileSync(sessionInfoPath, 'utf8'));
        const sessionName = info.sessionId;
        
        // Check if session exists in tmux
        const sessions = getActiveSessions();
        return sessions.some(session => session.includes(sessionName));
    } catch (error) {
        return false;
    }
}

// Check if project appears stuck
function isProjectStuck(projectDir) {
    // Check if requirements file exists
    const hasRequirements = fs.existsSync(path.join(projectDir, 'requirements.md')) || 
                           fs.existsSync(path.join(projectDir, 'instructions.md'));
    
    // Check if any implementation files exist
    const implementationFiles = ['index.html', 'main.py', 'app.py', 'server.py', 'main.js'];
    const hasImplementation = implementationFiles.some(file => 
        fs.existsSync(path.join(projectDir, file))
    );
    
    // Project is stuck if it has requirements but no implementation
    return hasRequirements && !hasImplementation;
}

// Kill tmux session
function killSession(sessionName) {
    try {
        execSync(`tmux kill-session -t ${sessionName}`, { encoding: 'utf8' });
        console.log(`  ✓ Killed session: ${sessionName}`);
    } catch (error) {
        // Session might not exist
    }
}

// Restart project
function restartProject(projectDir) {
    const requirementsFile = fs.existsSync(path.join(projectDir, 'requirements.md')) 
        ? 'requirements.md' 
        : 'instructions.md';
    
    const spawnCmd = `node /Users/Mike/.claude/user/tmux-claude-mcp-server/scripts/api/spawn_project_executive.js --project-dir "${projectDir}" --project-type web-app --requirements-file ${requirementsFile}`;
    
    try {
        console.log(`  → Restarting with: ${requirementsFile}`);
        execSync(spawnCmd, { encoding: 'utf8', stdio: 'pipe' });
        console.log(`  ✓ Successfully restarted`);
        return true;
    } catch (error) {
        console.log(`  ✗ Failed to restart: ${error.message}`);
        return false;
    }
}

// Main process
console.log('🔍 Analyzing projects for stuck sessions...\n');

let stuckCount = 0;
let restartedCount = 0;

for (const projectDir of projectDirs) {
    const projectId = path.basename(projectDir);
    console.log(`\nChecking ${projectId}:`);
    
    if (!fs.existsSync(projectDir)) {
        console.log('  ⚠️  Directory does not exist');
        continue;
    }
    
    const hasSession = hasActiveSession(projectDir);
    const isStuck = isProjectStuck(projectDir);
    
    if (hasSession && isStuck) {
        console.log('  🚨 STUCK - Has session but no implementation');
        stuckCount++;
        
        // Get session info to kill it
        try {
            const sessionInfo = JSON.parse(
                fs.readFileSync(path.join(projectDir, '.tmux_session_info.json'), 'utf8')
            );
            
            // Kill the session
            killSession(sessionInfo.sessionId);
            
            // Restart the project
            if (restartProject(projectDir)) {
                restartedCount++;
            }
        } catch (error) {
            console.log(`  ✗ Error handling session: ${error.message}`);
        }
    } else if (!hasSession && isStuck) {
        console.log('  ❌ No session and no implementation - needs restart');
        stuckCount++;
        
        // Just restart it
        if (restartProject(projectDir)) {
            restartedCount++;
        }
    } else if (hasSession && !isStuck) {
        console.log('  ✅ Active and has implementation');
    } else {
        console.log('  ⚪ No requirements found');
    }
}

console.log(`\n📊 Summary:`);
console.log(`  - Total projects checked: ${projectDirs.length}`);
console.log(`  - Stuck projects found: ${stuckCount}`);
console.log(`  - Projects restarted: ${restartedCount}`);
console.log(`\n✅ Restart process complete!`);