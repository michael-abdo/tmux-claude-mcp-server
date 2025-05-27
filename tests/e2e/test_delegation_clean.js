#!/usr/bin/env node
/**
 * Clean test of delegation pattern with role verification
 */

import { InstanceManager } from '../src/instance_manager.js';
import { MCPTools } from '../src/mcp_tools.js';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color codes for output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendMessageViaScript(sessionName, message) {
    /**
     * Use Python script for reliable message delivery
     */
    try {
        const result = execSync(
            `python3 enhanced_reliable_send.py ${sessionName} "${message.replace(/"/g, '\\"')}"`,
            { encoding: 'utf8', stdio: 'pipe' }
        );
        return true;
    } catch (error) {
        log(`Failed to send message: ${error.message}`, 'red');
        return false;
    }
}

async function main() {
    log('\n🧹 CLEAN DELEGATION PATTERN TEST', 'bright');
    log('================================\n', 'bright');

    // Initialize instance manager
    const instanceManager = new InstanceManager();
    const mcpTools = new MCPTools(instanceManager);
    
    // Create test directory
    const timestamp = Date.now();
    const projectDir = path.join(__dirname, `clean_delegation_test_${timestamp}`);
    await fs.mkdir(projectDir, { recursive: true });
    
    log('📋 Test Plan:', 'blue');
    log('1. Spawn executive with delegation instructions');
    log('2. Verify role understanding');
    log('3. Send Grid Trading Bot Dashboard project');
    log('4. Monitor for proper delegation\n');

    try {
        // Step 1: Spawn executive
        log('🚀 Spawning Executive Instance...', 'yellow');
        
        const executiveContext = `
🚨 MANDATORY: YOU ARE AN EXECUTIVE - DELEGATION ONLY! 🚨

Your ONLY job is to:
1. Create PROJECT_PLAN.md
2. Spawn Manager instances
3. Delegate work to them
4. Monitor their progress

You will receive a Grid Trading Bot Dashboard project.
DO NOT implement it yourself!

Remember: If you write code, you FAIL your role.
`;

        const spawnResult = await mcpTools.spawn({
            role: 'executive',
            workDir: projectDir,
            context: executiveContext,
            workspaceMode: 'isolated'
        });
        
        // Extract instance ID
        const responseText = JSON.stringify(spawnResult);
        const instanceMatch = responseText.match(/exec_\\d+/);
        if (!instanceMatch) {
            throw new Error('Failed to extract executive instance ID');
        }
        
        const executiveId = instanceMatch[0];
        const sessionName = `claude_${executiveId}`;
        
        log(`✅ Executive spawned: ${executiveId}`, 'green');
        log(`📁 Project directory: ${projectDir}\n`, 'green');
        
        // Wait for initialization
        log('⏳ Waiting for initialization...', 'yellow');
        await sleep(10000);
        
        // Step 2: Verify role understanding
        log('\n🔍 Verifying Role Understanding...', 'blue');
        
        const roleCheck = "What is your role and what will you do when given a project?";
        const sent = await sendMessageViaScript(sessionName, roleCheck);
        
        if (!sent) {
            throw new Error('Failed to send role verification message');
        }
        
        log('📨 Sent role verification question', 'green');
        log('⏳ Waiting for response...', 'yellow');
        await sleep(15000);
        
        // Step 3: Send project with delegation emphasis
        log('\n📤 Sending Grid Trading Bot Dashboard Project...', 'blue');
        
        const projectMessage = `
🚨 EXECUTIVE TASK: Orchestrate the Grid Trading Bot Dashboard 🚨

DO NOT IMPLEMENT. Your tasks:
1. Write PROJECT_PLAN.md with work breakdown
2. Spawn Frontend Manager, Backend Manager, Database Manager
3. Send each Manager their specific requirements
4. Monitor their progress

PROJECT: Grid Trading Bot Dashboard
- React 18 + TypeScript frontend
- Deno + Supabase backend
- PostgreSQL database
- Real-time trading features
- Analytics and reporting

START: Create PROJECT_PLAN.md now.`;

        const projectSent = await sendMessageViaScript(sessionName, projectMessage);
        
        if (!projectSent) {
            log('⚠️  Failed to send project, trying simple message', 'yellow');
            execSync(`tmux send-keys -t ${sessionName} "Create PROJECT_PLAN.md and spawn managers for Grid Trading Bot Dashboard" Enter`);
        }
        
        log('✅ Project sent to executive', 'green');
        
        // Step 4: Monitor for delegation
        log('\n👀 Monitoring for Proper Delegation...', 'blue');
        log('(Checking every 10 seconds for manager spawning)\n');
        
        let checkCount = 0;
        const maxChecks = 12; // 2 minutes
        let delegationSuccess = false;
        
        while (checkCount < maxChecks && !delegationSuccess) {
            checkCount++;
            
            // Check for PROJECT_PLAN.md
            const planPath = path.join(projectDir, executiveId, 'PROJECT_PLAN.md');
            try {
                await fs.access(planPath);
                log('✅ PROJECT_PLAN.md created!', 'green');
            } catch {
                // Plan not created yet
            }
            
            // Check for spawned managers
            const instances = instanceManager.getAllInstances();
            const executive = instances[executiveId];
            
            if (executive && executive.children && executive.children.length > 0) {
                log(`\n🎉 SUCCESS! Executive is delegating properly!`, 'green');
                log(`✅ Spawned ${executive.children.length} manager(s):`, 'green');
                
                for (const childId of executive.children) {
                    const child = instances[childId];
                    if (child) {
                        log(`   - ${childId} (${child.role})`, 'green');
                    }
                }
                
                delegationSuccess = true;
                break;
            }
            
            // Progress indicator
            process.stdout.write(`\rCheck ${checkCount}/${maxChecks} `);
            for (let i = 0; i < checkCount; i++) process.stdout.write('.');
            
            await sleep(10000);
        }
        
        console.log('\n'); // New line after progress dots
        
        // Final summary
        log('\n📊 Test Results:', 'bright');
        log('================', 'bright');
        
        if (delegationSuccess) {
            log('✅ Executive is following delegation pattern correctly!', 'green');
            log('✅ Managers have been spawned', 'green');
            log('✅ Hierarchical workflow is working', 'green');
            
            log('\n📌 Next Steps:', 'blue');
            log(`1. Monitor executive: tmux attach -t ${sessionName}`);
            log(`2. Check PROJECT_PLAN.md: cat ${planPath}`);
            log(`3. Monitor managers: tmux list-sessions | grep claude_mgr`);
        } else {
            log('⚠️  Executive has not spawned managers yet', 'yellow');
            log('Possible reasons:', 'yellow');
            log('- Still processing the request', 'yellow');
            log('- May need more explicit delegation reminder', 'yellow');
            log('- Could be hitting usage limits', 'yellow');
            
            log('\n📌 Debug Steps:', 'blue');
            log(`1. Check executive session: tmux attach -t ${sessionName}`);
            log(`2. Look for PROJECT_PLAN.md in: ${projectDir}/${executiveId}/`);
            log(`3. Send reminder: "Remember to spawn managers, don't implement yourself"`);
        }
        
    } catch (error) {
        log(`\n❌ Error: ${error.message}`, 'red');
        log('\n📌 Troubleshooting:', 'yellow');
        log('1. Ensure MCP server is running: npm start');
        log('2. Check tmux sessions: tmux list-sessions');
        log('3. Verify state file: cat state/instances.json');
    }
}

// Start MCP server first
log('🚀 Starting MCP server...', 'yellow');
execSync('npm start > /dev/null 2>&1 &', { shell: true });
await sleep(3000);

// Run the test
main().catch(error => {
    log(`\n💥 Fatal error: ${error.message}`, 'red');
    process.exit(1);
});