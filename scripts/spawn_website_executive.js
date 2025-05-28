#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Create executive working directory
const timestamp = Date.now();
const execId = `exec_${timestamp}`;
const workDir = path.join(process.cwd(), execId);

console.log(`Creating executive workspace at ${workDir}...`);
fs.mkdirSync(workDir, { recursive: true });

// Copy the requirements file
const requirementsPath = path.join(process.cwd(), 'tests/e2e/website_e2e.md');
const destPath = path.join(workDir, 'website_requirements.md');
fs.copyFileSync(requirementsPath, destPath);

// Create CLAUDE.md with instructions
const claudeMd = `# Executive Instructions

You are an Executive orchestrating the development of an e-commerce website frontend. 

Your project requirements are in website_requirements.md in this directory.

Follow the EXECUTIVE WORKFLOW exactly as specified:

1. First create DESIGN_SYSTEM.md with comprehensive navigation, styling, and component standards
2. Use the MCP bridge to spawn managers (cd .. && node scripts/mcp_bridge.js spawn ...)
3. Distribute the design system with MANDATORY technology requirements to each manager
4. Ensure each manager confirms understanding before starting
5. Delegate page implementation to specific managers
6. Monitor progress and perform integration testing

CRITICAL: This must be vanilla HTML/CSS/JS only - NO frameworks, NO npm, NO build tools.

Use the TodoWrite tool to track your progress through each step.
`;

fs.writeFileSync(path.join(workDir, 'CLAUDE.md'), claudeMd);

// Create the tmux session and start Claude
console.log(`Creating tmux session for ${execId}...`);

const sessionName = `claude_${execId}`;

try {
    // Create tmux session
    execSync(`tmux new-session -d -s ${sessionName} -c "${workDir}"`);
    
    // Start Claude Code
    execSync(`tmux send-keys -t ${sessionName}:0.0 'claude' Enter`);
    
    console.log(`
✅ Executive spawned successfully!

Session: ${sessionName}
Working Directory: ${workDir}

To monitor the executive:
- tmux attach -t ${sessionName}
- node scripts/monitor_executive.js (once authentication is complete)

The executive will read the requirements and begin creating the design system.
`);

} catch (error) {
    console.error('Error spawning executive:', error.message);
    process.exit(1);
}