#!/usr/bin/env node

/**
 * Simple script to spawn a Specialist instance
 * For use by Manager instances in Phase 1 MVP
 */

import { spawn } from 'child_process';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

async function spawnSpecialist(taskName, context) {
    const timestamp = Date.now();
    const instanceId = `spec_1_577786_${timestamp}`;
    const projectDir = path.join(process.cwd(), '..', instanceId);
    const sessionName = `claude_${instanceId}`;
    
    try {
        // Create project directory
        await fs.mkdir(projectDir, { recursive: true });
        
        // Write CLAUDE.md
        const claudeContent = `# You are a Specialist Claude Instance

## Your Primary Responsibility
You implement specific features or fixes as assigned by your Manager. You work independently in your own branch and focus solely on your assigned task.

## Critical Rules
1. **Work in your assigned branch** - Never switch branches
2. **Focus on your specific task** - Don't exceed scope
3. **Test your changes** - Ensure code works before marking complete
4. **Update your todo list** - Track progress systematically
5. **NO orchestration** - You cannot spawn other instances

## Your Context
- Instance ID: ${instanceId}
- Parent: mgr_1_577786
- Task: ${taskName}

## TASK DETAILS
${context}

## Instructions
1. Read and understand your task
2. Implement the required features
3. Test your implementation
4. Mark your todo items as complete when done
5. Report completion to your Manager`;

        await fs.writeFile(path.join(projectDir, 'CLAUDE.md'), claudeContent);
        
        // Create tmux session
        await execAsync(`tmux new-session -d -s ${sessionName} -c ${projectDir}`);
        
        // Give tmux time to create session
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Launch Claude
        await execAsync(`tmux send-keys -t ${sessionName} "claude config set hasTrustDialogAccepted true" C-m`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await execAsync(`tmux send-keys -t ${sessionName} "claude --dangerously-skip-permissions" C-m`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log(`Spawned Specialist: ${instanceId}`);
        console.log(`Session: ${sessionName}`);
        console.log(`Directory: ${projectDir}`);
        console.log(`Task: ${taskName}`);
        
        return {
            instanceId,
            sessionName,
            projectDir
        };
        
    } catch (error) {
        console.error(`Failed to spawn specialist: ${error.message}`);
        throw error;
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
    console.error('Usage: node spawn_specialist.js <task-name> <context>');
    process.exit(1);
}

const taskName = args[0];
const context = args.slice(1).join(' ');

// Spawn the specialist
spawnSpecialist(taskName, context)
    .then(result => {
        console.log('Specialist spawned successfully:', result);
        process.exit(0);
    })
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });