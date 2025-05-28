#!/usr/bin/env node

/**
 * Project Monitoring Utility
 * 
 * Monitor the progress and status of a project being orchestrated.
 * Provides real-time visibility into executive, manager, and specialist activities.
 * 
 * Usage:
 *   node monitor_project.js --session-id claude_exec_123
 *   node monitor_project.js --project-dir /path/to/project
 * 
 * Interactive Commands:
 *   s - Shutdown all instances
 *   1-9 - Attach to numbered instance
 *   r - Restart project
 *   q - Quit monitor
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ProjectMonitor {
    constructor() {
        this.rootDir = path.join(__dirname, '..', '..');
        this.bridgePath = path.join(this.rootDir, 'scripts', 'mcp_bridge.js');
        this.shutdownPath = path.join(this.rootDir, 'scripts', 'shutdown_instances.js');
        this.spawnPath = path.join(__dirname, 'spawn_project_executive.js');
        this.parseArgs();
        this.refreshInterval = 5000; // 5 seconds
        this.instanceList = [];
        this.sessionInfo = null;
    }

    parseArgs() {
        const args = process.argv.slice(2);
        this.options = {
            sessionId: null,
            projectDir: null,
            continuous: true,
            outputFormat: 'text', // text or json
            showDetails: true
        };

        for (let i = 0; i < args.length; i++) {
            switch (args[i]) {
                case '--session-id':
                    this.options.sessionId = args[++i];
                    break;
                case '--project-dir':
                    this.options.projectDir = path.resolve(args[++i]);
                    break;
                case '--once':
                    this.options.continuous = false;
                    break;
                case '--json':
                    this.options.outputFormat = 'json';
                    break;
                case '--summary':
                    this.options.showDetails = false;
                    break;
                case '--help':
                    this.showHelp();
                    process.exit(0);
            }
        }

        // Must have either session-id or project-dir
        if (!this.options.sessionId && !this.options.projectDir) {
            this.error('Either --session-id or --project-dir is required');
        }
    }

    showHelp() {
        console.log(`
Project Monitoring Utility

Usage:
  node monitor_project.js --session-id <id> [options]
  node monitor_project.js --project-dir <path> [options]

Required (one of):
  --session-id <id>      Monitor specific tmux session
  --project-dir <path>   Monitor project by directory (reads .tmux_session_info.json)

Options:
  --once                 Show status once and exit (default: continuous)
  --json                 Output in JSON format
  --summary              Show summary only (no details)
  --help                 Show this help message

Examples:
  # Monitor by session ID
  node monitor_project.js --session-id claude_exec_123

  # Monitor by project directory
  node monitor_project.js --project-dir /my/project

  # Get one-time JSON status
  node monitor_project.js --project-dir /my/project --once --json
        `);
    }

    error(message) {
        console.error(`Error: ${message}`);
        process.exit(1);
    }

    clearScreen() {
        if (this.options.outputFormat !== 'json' && this.options.continuous) {
            console.clear();
        }
    }

    async loadSessionInfo() {
        if (this.options.projectDir) {
            const sessionInfoPath = path.join(this.options.projectDir, '.tmux_session_info.json');
            if (fs.existsSync(sessionInfoPath)) {
                const info = JSON.parse(fs.readFileSync(sessionInfoPath, 'utf8'));
                this.options.sessionId = info.sessionId;
                return info;
            }
        }
        return null;
    }

    async getActiveInstances() {
        try {
            const result = execSync(`node "${this.bridgePath}" list '{}'`, { 
                encoding: 'utf8',
                cwd: this.rootDir
            });
            
            const response = JSON.parse(result);
            if (response.success && response.data) {
                return response.data;
            }
            return [];
        } catch (error) {
            return [];
        }
    }

    async getInstanceOutput(instanceId, lines = 50) {
        try {
            const result = execSync(`node "${this.bridgePath}" read '{"instanceId":"${instanceId}","lines":${lines}}'`, { 
                encoding: 'utf8',
                cwd: this.rootDir
            });
            
            const response = JSON.parse(result);
            if (response.success && response.data) {
                return response.data.messages || [];
            }
            return [];
        } catch (error) {
            return [];
        }
    }

    async checkTmuxSession(sessionName) {
        try {
            execSync(`tmux has-session -t ${sessionName} 2>/dev/null`);
            return true;
        } catch {
            return false;
        }
    }

    analyzeProgress(instances) {
        const analysis = {
            totalInstances: instances.length,
            byRole: {
                executive: 0,
                manager: 0,
                specialist: 0
            },
            activeWork: [],
            completedTasks: [],
            filesCreated: [],
            lastActivity: null
        };

        instances.forEach(inst => {
            analysis.byRole[inst.role]++;
        });

        // TODO: Integrate with todo monitoring to get actual task progress
        // For now, we'll analyze based on instance activity

        return analysis;
    }

    formatOutput(sessionInfo, instances, sessionActive, analysis) {
        if (this.options.outputFormat === 'json') {
            return JSON.stringify({
                sessionInfo,
                instances,
                sessionActive,
                analysis,
                timestamp: new Date().toISOString()
            }, null, 2);
        }

        // Store session info for commands
        this.sessionInfo = sessionInfo;
        this.instanceList = instances;

        // Text format
        let output = '';
        
        // Header
        output += '╔════════════════════════════════════════════════════════════════╗\n';
        output += '║                     PROJECT MONITOR                             ║\n';
        output += '╚════════════════════════════════════════════════════════════════╝\n\n';

        // Session Info
        if (sessionInfo) {
            output += `📁 Project: ${sessionInfo.projectDir}\n`;
            output += `📋 Type: ${sessionInfo.projectType}\n`;
            output += `🆔 Session: ${sessionInfo.sessionId}\n`;
            output += `⏰ Started: ${new Date(sessionInfo.startTime).toLocaleString()}\n`;
            output += `🔄 Status: ${sessionActive ? '✅ Active' : '❌ Inactive'}\n`;
        }

        output += '\n';

        // Instance Summary
        output += '📊 Instance Summary:\n';
        output += `   Executive: ${analysis.byRole.executive}\n`;
        output += `   Managers: ${analysis.byRole.manager}\n`;
        output += `   Specialists: ${analysis.byRole.specialist}\n`;
        output += `   Total: ${analysis.totalInstances}\n\n`;

        // Active Instances with numbering for attach command
        if (this.options.showDetails && instances.length > 0) {
            output += '🔧 Active Instances:\n';
            output += '─'.repeat(60) + '\n';

            // Group by hierarchy
            const executives = instances.filter(i => i.role === 'executive');
            const managers = instances.filter(i => i.role === 'manager');
            const specialists = instances.filter(i => i.role === 'specialist');

            let instanceNumber = 1;

            executives.forEach(exec => {
                output += `\n[${instanceNumber++}] 🎯 EXECUTIVE: ${exec.instanceId}\n`;
                output += `    📂 ${exec.workDir || 'No workDir'}\n`;
                
                // Show managers under this executive
                const execManagers = managers.filter(m => m.parentId === exec.instanceId);
                execManagers.forEach(mgr => {
                    output += `\n[${instanceNumber++}]  📋 MANAGER: ${mgr.instanceId}\n`;
                    output += `       📂 ${mgr.workDir || 'No workDir'}\n`;
                    
                    // Show specialists under this manager
                    const mgrSpecialists = specialists.filter(s => s.parentId === mgr.instanceId);
                    mgrSpecialists.forEach(spec => {
                        output += `\n[${instanceNumber++}]     🔨 SPECIALIST: ${spec.instanceId}\n`;
                        output += `          📂 ${spec.workDir || 'No workDir'}\n`;
                    });
                });
            });

            // Show orphaned instances
            const orphanedManagers = managers.filter(m => !executives.some(e => e.instanceId === m.parentId));
            const orphanedSpecialists = specialists.filter(s => !managers.some(m => m.instanceId === s.parentId));

            if (orphanedManagers.length > 0 || orphanedSpecialists.length > 0) {
                output += '\n\n⚠️  Orphaned Instances:\n';
                orphanedManagers.forEach(mgr => {
                    output += `[${instanceNumber++}]  📋 MANAGER: ${mgr.instanceId} (no parent)\n`;
                });
                orphanedSpecialists.forEach(spec => {
                    output += `[${instanceNumber++}]  🔨 SPECIALIST: ${spec.instanceId} (no parent)\n`;
                });
            }
        }

        // Recent Activity (if we implement todo monitoring)
        if (analysis.lastActivity) {
            output += '\n\n📝 Recent Activity:\n';
            output += `   ${analysis.lastActivity}\n`;
        }

        // Footer
        output += '\n' + '─'.repeat(60) + '\n';
        output += `Last updated: ${new Date().toLocaleTimeString()}\n`;
        
        if (this.options.continuous) {
            output += '\n🎮 Commands: ';
            output += '[s] Shutdown all  ';
            output += '[1-9] Attach to instance  ';
            output += '[r] Restart  ';
            output += '[q] Quit\n';
        }

        return output;
    }

    setupKeyboardInput() {
        if (!this.options.continuous || this.options.outputFormat === 'json') {
            return;
        }

        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }

        process.stdin.on('keypress', async (str, key) => {
            if (key && key.ctrl && key.name === 'c') {
                this.cleanup();
                process.exit();
            }

            if (str) {
                await this.handleCommand(str);
            }
        });
    }

    cleanup() {
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }
        process.stdin.pause();
    }

    async handleCommand(command) {
        this.clearScreen();
        console.log(`\n🔄 Processing command: ${command}\n`);

        switch (command) {
            case 'q':
                this.cleanup();
                process.exit();
                break;

            case 's':
                await this.shutdownAll();
                break;

            case 'r':
                await this.restartProject();
                break;

            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
            case '8':
            case '9':
                await this.attachToInstance(parseInt(command));
                break;

            default:
                console.log(`Unknown command: ${command}`);
                await new Promise(resolve => setTimeout(resolve, 1500));
        }
    }

    async shutdownAll() {
        console.log('🛑 Shutting down all instances...\n');
        
        try {
            execSync(`node "${this.shutdownPath}" all`, { 
                encoding: 'utf8',
                cwd: this.rootDir,
                stdio: 'inherit'
            });
            
            console.log('\n✅ All instances shut down');
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            console.error('❌ Shutdown failed:', error.message);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    async attachToInstance(number) {
        const instance = this.instanceList[number - 1];
        
        if (!instance) {
            console.log(`❌ No instance at position ${number}`);
            await new Promise(resolve => setTimeout(resolve, 1500));
            return;
        }

        const sessionName = `claude_${instance.instanceId}`;
        console.log(`📎 Attaching to ${instance.role}: ${sessionName}\n`);
        console.log('Press Ctrl+B then D to detach and return to monitor\n');
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        this.cleanup();
        
        try {
            execSync(`tmux attach -t ${sessionName}`, { 
                stdio: 'inherit' 
            });
        } catch (error) {
            console.error(`\n❌ Could not attach: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Re-setup keyboard input when returning
        this.setupKeyboardInput();
    }

    async restartProject() {
        if (!this.sessionInfo) {
            console.log('❌ No project info available for restart');
            await new Promise(resolve => setTimeout(resolve, 1500));
            return;
        }

        console.log('🔄 Restarting project...\n');
        
        // First shutdown all
        await this.shutdownAll();
        
        // Then spawn new executive
        console.log('🚀 Spawning new executive...\n');
        
        try {
            const args = [
                '--project-dir', this.sessionInfo.projectDir,
                '--requirements-file', this.sessionInfo.requirementsFile || 'requirements.md',
                '--project-type', this.sessionInfo.projectType || 'generic',
                '--json'
            ];

            const result = execSync(`node "${this.spawnPath}" ${args.join(' ')}`, { 
                encoding: 'utf8',
                cwd: this.rootDir
            });
            
            const response = JSON.parse(result);
            if (response.success) {
                console.log('✅ Project restarted successfully');
                console.log(`New session: ${response.sessionInfo.sessionId}`);
                
                // Update our session ID
                this.options.sessionId = response.sessionInfo.sessionId;
                this.sessionInfo = response.sessionInfo;
            } else {
                console.log('❌ Restart failed:', response.error);
            }
        } catch (error) {
            console.error('❌ Restart error:', error.message);
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    async monitor() {
        // Load session info if monitoring by project dir
        const sessionInfo = await this.loadSessionInfo();
        
        if (!this.options.sessionId) {
            this.error('Could not determine session ID');
        }

        // Setup keyboard input for interactive commands
        this.setupKeyboardInput();

        do {
            this.clearScreen();
            
            // Check if tmux session is active
            const sessionActive = await this.checkTmuxSession(this.options.sessionId);
            
            // Get all active instances
            const instances = await this.getActiveInstances();
            
            // Filter instances related to this project
            const projectInstances = instances.filter(inst => {
                // Match by session ID pattern or work directory
                return inst.instanceId.includes(this.options.sessionId.replace('claude_', '')) ||
                       (sessionInfo && inst.workDir && inst.workDir.startsWith(sessionInfo.projectDir));
            });

            // Analyze progress
            const analysis = this.analyzeProgress(projectInstances);

            // Format and display output
            const output = this.formatOutput(sessionInfo, projectInstances, sessionActive, analysis);
            console.log(output);

            // Exit if session is no longer active and no instances running
            if (!sessionActive && projectInstances.length === 0) {
                if (this.options.outputFormat !== 'json') {
                    console.log('\n⚠️  Project session has ended.\n');
                }
                break;
            }

            // Wait before next update
            if (this.options.continuous) {
                await new Promise(resolve => setTimeout(resolve, this.refreshInterval));
            }

        } while (this.options.continuous);

        this.cleanup();
    }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const monitor = new ProjectMonitor();
    monitor.monitor().catch(error => {
        console.error('Monitor error:', error.message);
        process.exit(1);
    });
}

export { ProjectMonitor };