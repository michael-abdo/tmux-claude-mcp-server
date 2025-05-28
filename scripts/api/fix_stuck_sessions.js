#!/usr/bin/env node

/**
 * Stuck Session Diagnostic and Fix Utility
 * 
 * Automatically detect and fix Claude sessions that are stuck in orchestration loops.
 * Provides intervention strategies based on session state analysis.
 * 
 * Usage:
 *   node fix_stuck_sessions.js --scan-dir /path/to/projects
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class StuckSessionFixer {
    constructor() {
        this.rootDir = path.join(__dirname, '..', '..');
        this.parseArgs();
    }

    parseArgs() {
        const args = process.argv.slice(2);
        this.options = {
            scanDir: null,
            autoFix: false,
            dryRun: false
        };

        for (let i = 0; i < args.length; i++) {
            switch (args[i]) {
                case '--scan-dir':
                    this.options.scanDir = path.resolve(args[++i]);
                    break;
                case '--auto-fix':
                    this.options.autoFix = true;
                    break;
                case '--dry-run':
                    this.options.dryRun = true;
                    break;
                case '--help':
                    this.showHelp();
                    process.exit(0);
            }
        }

        if (!this.options.scanDir) {
            this.error('--scan-dir is required');
        }
    }

    showHelp() {
        console.log(`
Stuck Session Diagnostic and Fix Utility

Usage:
  node fix_stuck_sessions.js --scan-dir <path> [options]

Required:
  --scan-dir <path>      Root directory to scan for projects

Options:
  --auto-fix            Automatically send fix commands to stuck sessions
  --dry-run             Show what would be done without taking action
  --help                Show this help message

Examples:
  # Diagnose stuck sessions
  node fix_stuck_sessions.js --scan-dir /my/projects

  # Auto-fix stuck sessions
  node fix_stuck_sessions.js --scan-dir /my/projects --auto-fix

  # Preview fixes without executing
  node fix_stuck_sessions.js --scan-dir /my/projects --auto-fix --dry-run
        `);
    }

    error(message) {
        console.error(`Error: ${message}`);
        process.exit(1);
    }

    /**
     * Get all Claude tmux sessions
     */
    getAllSessions() {
        try {
            const result = execSync('tmux list-sessions', { encoding: 'utf8' });
            const sessions = [];
            const lines = result.split('\n').filter(line => line.trim());
            
            for (const line of lines) {
                const match = line.match(/^claude_(\w+)_(.+?):/);
                if (match) {
                    const [, role, id] = match;
                    sessions.push({
                        sessionName: `claude_${role}_${id}`,
                        role: role === 'exec' ? 'executive' : role,
                        id: id
                    });
                }
            }
            
            return sessions;
        } catch (error) {
            return [];
        }
    }

    /**
     * Analyze session output to detect stuck patterns
     */
    analyzeSession(sessionName) {
        try {
            // Get recent output from tmux session
            const output = execSync(`tmux capture-pane -t ${sessionName} -p -S -100`, {
                encoding: 'utf8'
            });

            const analysis = {
                sessionName: sessionName,
                isStuck: false,
                stuckType: null,
                lastActivity: null,
                indicators: [],
                recommendedFix: null
            };

            // Check for stuck indicators
            const lines = output.split('\n');
            const recentLines = lines.slice(-20); // Last 20 lines

            // Pattern 1: Trying to spawn managers repeatedly
            if (output.includes('spawn') && output.includes('manager') && output.includes('Error')) {
                analysis.isStuck = true;
                analysis.stuckType = 'orchestration_loop';
                analysis.indicators.push('Repeated manager spawn attempts with errors');
                analysis.recommendedFix = 'interrupt_and_direct_implementation';
            }

            // Pattern 2: Waiting for MCP bridge indefinitely
            if (output.includes('MCP') && output.includes('bridge') && 
                (output.includes('waiting') || output.includes('timeout'))) {
                analysis.isStuck = true;
                analysis.stuckType = 'mcp_bridge_failure';
                analysis.indicators.push('MCP bridge connectivity issues');
                analysis.recommendedFix = 'bypass_orchestration';
            }

            // Pattern 3: Infinite planning loop
            if (output.includes('PROJECT_PLAN') && output.includes('managers') && 
                !output.includes('index.html') && !output.includes('main.py')) {
                analysis.isStuck = true;
                analysis.stuckType = 'planning_loop';
                analysis.indicators.push('Stuck in planning phase, no implementation files');
                analysis.recommendedFix = 'direct_file_creation';
            }

            // Pattern 4: "Bypassing Permissions" with no progress
            const bypassingCount = (output.match(/Bypassing Permissions/g) || []).length;
            if (bypassingCount > 3 && !this.hasImplementationFiles(sessionName)) {
                analysis.isStuck = true;
                analysis.stuckType = 'permission_loop';
                analysis.indicators.push(`"Bypassing Permissions" appeared ${bypassingCount} times`);
                analysis.recommendedFix = 'interrupt_and_redirect';
            }

            return analysis;
        } catch (error) {
            return {
                sessionName: sessionName,
                isStuck: false,
                error: error.message
            };
        }
    }

    /**
     * Check if session has created implementation files
     */
    hasImplementationFiles(sessionName) {
        try {
            // Get working directory from tmux
            const workDir = execSync(`tmux display-message -p -t ${sessionName} '#{pane_current_path}'`, {
                encoding: 'utf8'
            }).trim();

            // Check for common implementation files
            const implementationFiles = [
                'index.html', 'main.py', 'app.py', 'server.py', 
                'main.js', 'app.js', 'style.css', 'script.js'
            ];

            return implementationFiles.some(file => 
                fs.existsSync(path.join(workDir, file))
            );
        } catch (error) {
            return false;
        }
    }

    /**
     * Generate fix command based on stuck type
     */
    generateFixCommand(analysis) {
        const commands = {
            'orchestration_loop': `Stop trying to spawn managers. The MCP bridge has issues. Implement the demo directly by creating the main files (index.html, CSS, JS) yourself in this directory.`,
            
            'mcp_bridge_failure': `The MCP bridge is not working. Skip orchestration and implement the project directly. Create all necessary files yourself.`,
            
            'planning_loop': `Stop planning and start implementing. Create the main demo files (index.html, main.py, etc.) directly in this directory with working functionality.`,
            
            'permission_loop': `Interrupt current process and implement directly. Create ${this.getProjectFileType(analysis.sessionName)} with complete demo functionality.`,
            
            'default': `Skip orchestration due to infrastructure issues. Implement the demo directly by creating working files in this directory.`
        };

        return commands[analysis.stuckType] || commands.default;
    }

    /**
     * Determine what type of files to create based on project context
     */
    getProjectFileType(sessionName) {
        try {
            const workDir = execSync(`tmux display-message -p -t ${sessionName} '#{pane_current_path}'`, {
                encoding: 'utf8'
            }).trim();

            // Check requirements for project type hints
            if (fs.existsSync(path.join(workDir, 'requirements.md'))) {
                const content = fs.readFileSync(path.join(workDir, 'requirements.md'), 'utf8').toLowerCase();
                
                if (content.includes('python')) return 'main.py and supporting Python files';
                if (content.includes('react') || content.includes('vue')) return 'index.html with React/Vue components';
                if (content.includes('api') || content.includes('rest')) return 'server.py or app.js with API endpoints';
                return 'index.html with CSS and JavaScript';
            }
            
            return 'index.html with supporting files';
        } catch (error) {
            return 'appropriate demo files';
        }
    }

    /**
     * Apply fix to stuck session
     */
    applyFix(analysis) {
        if (this.options.dryRun) {
            console.log(`[DRY RUN] Would send to ${analysis.sessionName}:`);
            console.log(`"${this.generateFixCommand(analysis)}"`);
            return;
        }

        try {
            const fixCommand = this.generateFixCommand(analysis);
            
            // Interrupt current process
            execSync(`tmux send-keys -t ${analysis.sessionName} C-c`);
            
            // Wait a moment
            setTimeout(() => {
                // Send fix command
                execSync(`tmux send-keys -t ${analysis.sessionName} "${fixCommand}" Enter`);
                console.log(`✅ Applied fix to ${analysis.sessionName}`);
            }, 1000);
            
        } catch (error) {
            console.error(`❌ Failed to apply fix to ${analysis.sessionName}: ${error.message}`);
        }
    }

    /**
     * Main diagnostic and fix process
     */
    async diagnose() {
        console.log('🔍 Scanning for stuck Claude sessions...\n');
        
        const sessions = this.getAllSessions();
        if (sessions.length === 0) {
            console.log('No Claude sessions found.');
            return;
        }

        const stuckSessions = [];
        
        for (const session of sessions) {
            const analysis = this.analyzeSession(session.sessionName);
            
            if (analysis.isStuck) {
                stuckSessions.push(analysis);
                console.log(`🚨 STUCK SESSION: ${session.sessionName}`);
                console.log(`   Type: ${analysis.stuckType}`);
                console.log(`   Indicators: ${analysis.indicators.join(', ')}`);
                console.log(`   Recommended Fix: ${analysis.recommendedFix}\n`);
            } else {
                console.log(`✅ HEALTHY: ${session.sessionName}`);
            }
        }

        if (stuckSessions.length === 0) {
            console.log('\n🎉 All sessions appear to be working normally!');
            return;
        }

        console.log(`\n📊 Summary: ${stuckSessions.length} stuck sessions found`);

        if (this.options.autoFix) {
            console.log('\n🛠️  Applying fixes...\n');
            
            for (const analysis of stuckSessions) {
                this.applyFix(analysis);
            }
            
            console.log(`\n✅ Fix attempts completed for ${stuckSessions.length} sessions`);
        } else {
            console.log('\n💡 Run with --auto-fix to automatically apply fixes');
            console.log('   Or run with --auto-fix --dry-run to preview fixes');
        }
    }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const fixer = new StuckSessionFixer();
    fixer.diagnose().catch(error => {
        console.error('Error:', error.message);
        process.exit(1);
    });
}

export { StuckSessionFixer };