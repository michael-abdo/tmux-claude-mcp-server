#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// List of all 64 project directories
const allProjects = [
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
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021928107942718286306",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021928185397395308311",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021928195057860950077",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021928286157852360471",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021928413009314635294",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021928449273731471567",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021928482916098586685",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021928513578612504637",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021928519552218421455",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021928542183218556892",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021928573181689388574",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021928602520267470909",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021928793827655663887",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021928837019223514654",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021929216949254564554",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021929248559911198238",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021929271473165905884",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021929284541023764393",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021929772896056498383",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021930356828589524220",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021901687678622429509",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021921696407555450084",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021924826200594882788",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021925242270015212411",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021929016736789551311",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021929582538724007454",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021929617332886009968",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021929684825916104222",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021929699342414831134",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021929701611683168169",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021929721942233831631",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021929830856825822750",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021929872883136738845",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021929944919006658321",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021929947185876948092",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021930015005142799484",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021930015207657257456",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021930023336535235424",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021930142766180193404",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021930181472995890300",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021930257392096132881",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021930263463044961405",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021930287495333139580",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021930313802153006803",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021930400348168455311",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021930438694037658687",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021930531716804018443",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021930622471472523063",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021930702079462637835",
    "/Users/Mike/Desktop/programming/2_proposals/upwork/021930966620528668750"
];

// Check if project has session info
function getSessionInfo(projectDir) {
    const sessionInfoPath = path.join(projectDir, '.tmux_session_info.json');
    if (fs.existsSync(sessionInfoPath)) {
        try {
            return JSON.parse(fs.readFileSync(sessionInfoPath, 'utf8'));
        } catch (e) {
            return null;
        }
    }
    return null;
}

// Check for implementation files
function hasImplementation(projectDir) {
    const files = ['index.html', 'main.py', 'app.py', 'server.py', 'main.js', 'style.css'];
    return files.some(file => fs.existsSync(path.join(projectDir, file)));
}

// Check for requirements
function hasRequirements(projectDir) {
    return fs.existsSync(path.join(projectDir, 'requirements.md')) || 
           fs.existsSync(path.join(projectDir, 'instructions.md'));
}

console.log('📊 Project Status Analysis\n');
console.log('Checking all 64 projects...\n');

const projectsWithSessions = [];
const stuckProjects = [];
const completedProjects = [];
const noRequirementsProjects = [];

for (const projectDir of allProjects) {
    const projectId = path.basename(projectDir);
    
    if (!fs.existsSync(projectDir)) {
        continue;
    }
    
    const sessionInfo = getSessionInfo(projectDir);
    const hasImpl = hasImplementation(projectDir);
    const hasReqs = hasRequirements(projectDir);
    
    if (sessionInfo) {
        projectsWithSessions.push({
            id: projectId,
            dir: projectDir,
            sessionInfo: sessionInfo,
            hasImplementation: hasImpl,
            hasRequirements: hasReqs
        });
        
        if (hasReqs && !hasImpl) {
            stuckProjects.push({
                id: projectId,
                dir: projectDir,
                sessionId: sessionInfo.sessionId,
                startTime: sessionInfo.startTime
            });
        } else if (hasImpl) {
            completedProjects.push(projectId);
        }
    } else if (hasReqs && !hasImpl) {
        // No session but has requirements and no implementation
        stuckProjects.push({
            id: projectId,
            dir: projectDir,
            sessionId: null,
            startTime: null
        });
    } else if (!hasReqs) {
        noRequirementsProjects.push(projectId);
    }
}

console.log(`✅ Projects with implementations: ${completedProjects.length}`);
console.log(`🚨 Stuck projects (requirements but no implementation): ${stuckProjects.length}`);
console.log(`📁 Projects with active sessions: ${projectsWithSessions.length}`);
console.log(`⚪ Projects without requirements: ${noRequirementsProjects.length}\n`);

console.log('🚨 STUCK PROJECTS DETAILS:\n');
for (const stuck of stuckProjects) {
    console.log(`Project: ${stuck.id}`);
    console.log(`  Path: ${stuck.dir}`);
    if (stuck.sessionId) {
        const elapsed = stuck.startTime ? 
            Math.floor((Date.now() - new Date(stuck.startTime).getTime()) / 60000) : 0;
        console.log(`  Session: ${stuck.sessionId}`);
        console.log(`  Running for: ${elapsed} minutes`);
    } else {
        console.log(`  No active session`);
    }
    console.log('');
}

// Generate restart commands
console.log('\n📝 RESTART COMMANDS FOR STUCK PROJECTS:\n');
for (const stuck of stuckProjects.slice(0, 10)) { // First 10 to not overwhelm
    const reqFile = fs.existsSync(path.join(stuck.dir, 'requirements.md')) 
        ? 'requirements.md' : 'instructions.md';
    
    if (stuck.sessionId) {
        console.log(`# Kill and restart ${stuck.id}`);
        console.log(`tmux kill-session -t ${stuck.sessionId}`);
    } else {
        console.log(`# Restart ${stuck.id}`);
    }
    
    console.log(`node /Users/Mike/.claude/user/tmux-claude-mcp-server/scripts/api/spawn_project_executive.js --project-dir "${stuck.dir}" --project-type web-app --requirements-file ${reqFile}\n`);
}