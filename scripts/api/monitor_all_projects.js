#!/usr/bin/env node

/**
 * Multi-Project Monitoring Dashboard
 * 
 * Monitor all Claude orchestration projects in a directory tree.
 * Provides a unified view of multiple projects with progress tracking.
 * 
 * Usage:
 *   node monitor_all_projects.js --scan-dir /path/to/projects
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MultiProjectMonitor {
    constructor() {
        this.rootDir = path.join(__dirname, '..', '..');
        this.bridgePath = path.join(this.rootDir, 'scripts', 'mcp_bridge.js');
        this.shutdownPath = path.join(this.rootDir, 'scripts', 'shutdown_instances.js');
        this.progressPath = path.join(__dirname, 'get_project_progress.js');
        this.monitorPath = path.join(__dirname, 'monitor_project.js');
        
        this.projects = [];
        this.selectedProject = null;
        this.refreshInterval = 5000; // 5 seconds
        this.parseArgs();
    }

    parseArgs() {
        const args = process.argv.slice(2);
        this.options = {
            scanDir: null,
            maxDepth: 5,
            continuous: true
        };

        for (let i = 0; i < args.length; i++) {
            switch (args[i]) {
                case '--scan-dir':
                    this.options.scanDir = path.resolve(args[++i]);
                    break;
                case '--max-depth':
                    this.options.maxDepth = parseInt(args[++i]);
                    break;
                case '--once':
                    this.options.continuous = false;
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
Multi-Project Monitoring Dashboard

Usage:
  node monitor_all_projects.js --scan-dir <path> [options]

Required:
  --scan-dir <path>      Root directory to scan for projects

Options:
  --max-depth <n>        Maximum directory depth to scan (default: 5)
  --once                 Show status once and exit
  --help                 Show this help message

Interactive Commands:
  1-9    Focus on specific project
  s      Shutdown all projects
  r      Refresh immediately
  q      Quit monitor
  b      Back to overview (when focused)

Examples:
  # Monitor all projects in a directory
  node monitor_all_projects.js --scan-dir /my/projects

  # One-time status check
  node monitor_all_projects.js --scan-dir /my/projects --once
        `);
    }

    error(message) {
        console.error(`Error: ${message}`);
        process.exit(1);
    }

    clearScreen() {
        if (this.options.continuous) {
            console.clear();
        }
    }

    /**
     * Recursively find all projects with .tmux_session_info.json
     */
    findProjects(dir, currentDepth = 0) {
        if (currentDepth > this.options.maxDepth) return;

        try {
            const items = fs.readdirSync(dir);
            
            // Check if this directory has a project
            if (items.includes('.tmux_session_info.json')) {
                const sessionInfoPath = path.join(dir, '.tmux_session_info.json');
                try {
                    const sessionInfo = JSON.parse(fs.readFileSync(sessionInfoPath, 'utf8'));
                    this.projects.push({
                        path: dir,
                        name: path.basename(dir),
                        sessionInfo: sessionInfo,
                        progress: null,
                        instances: []
                    });
                } catch (e) {
                    // Ignore invalid session files
                }
            }

            // Recurse into subdirectories
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                    this.findProjects(fullPath, currentDepth + 1);
                }
            }
        } catch (error) {
            // Ignore permission errors
        }
    }

    /**
     * Get progress for a single project
     */
    async getProjectProgress(project) {
        try {
            const result = execSync(`node "${this.progressPath}" --project-dir "${project.path}" --format json`, {
                encoding: 'utf8',
                cwd: this.rootDir
            });
            
            return JSON.parse(result);
        } catch (error) {
            return {
                summary: { overallProgress: 0, status: 'error' },
                instances: { total: 0, byRole: { executive: 0, manager: 0, specialist: 0 } }
            };
        }
    }

    /**
     * Get active instances for all projects
     */
    async getAllInstances() {
        try {
            const result = execSync(`node "${this.bridgePath}" list '{}'`, {
                encoding: 'utf8',
                cwd: this.rootDir
            });
            
            const response = JSON.parse(result);
            if (response.success) {
                // Handle both response.data and response.instances formats
                return response.data || response.instances || [];
            }
            return [];
        } catch (error) {
            return [];
        }
    }

    /**
     * Update progress for all projects
     */
    async updateAllProgress() {
        const allInstances = await this.getAllInstances();
        
        for (const project of this.projects) {
            // Get progress
            project.progress = await this.getProjectProgress(project);
            
            // Match instances to this project
            project.instances = allInstances.filter(inst => {
                const execId = project.sessionInfo.execId || project.sessionInfo.sessionId.replace('claude_', '');
                return inst.instanceId.includes(execId) ||
                       (inst.workDir && inst.workDir.startsWith(project.path));
            });
        }
    }

    /**
     * Format progress bar
     */
    formatProgressBar(progress, width = 10) {
        const filled = Math.round((progress / 100) * width);
        const empty = width - filled;
        
        let bar = '[';
        bar += '='.repeat(filled);
        if (filled < width) {
            bar += '>';
            bar += ' '.repeat(empty - 1);
        }
        bar += ']';
        
        return bar;
    }

    /**
     * Format elapsed time
     */
    formatElapsedTime(startTime) {
        const elapsed = Date.now() - new Date(startTime).getTime();
        const minutes = Math.floor(elapsed / 60000);
        
        if (minutes < 60) {
            return `${minutes}m`;
        } else {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            return `${hours}h ${mins}m`;
        }
    }

    /**
     * Get status emoji
     */
    getStatusEmoji(status) {
        switch (status) {
            case 'active':
            case 'in-progress':
                return '🚀';
            case 'completed':
                return '✅';
            case 'error':
            case 'not-started':
                return '❌';
            case 'finalizing':
                return '🔄';
            default:
                return '❓';
        }
    }

    /**
     * Display overview of all projects
     */
    displayOverview() {
        let output = '';
        
        // Header
        output += '╔══════════════════════════════════════════════════════════════╗\n';
        output += '║              MULTI-PROJECT MONITOR                           ║\n';
        output += '╚══════════════════════════════════════════════════════════════╝\n\n';

        // Summary - count projects with instances as active
        const activeProjects = this.projects.filter(p => 
            p.instances.length > 0 || 
            p.progress?.summary?.status === 'active' || 
            p.progress?.summary?.status === 'in-progress'
        ).length;
        
        const totalInstances = this.projects.reduce((sum, p) => 
            sum + p.instances.length, 0
        );

        output += `📊 Overview: ${activeProjects} Active Projects, ${totalInstances} Total Instances\n\n`;

        // Project list
        if (this.projects.length === 0) {
            output += '  No projects found with .tmux_session_info.json\n';
        } else {
            this.projects.forEach((project, index) => {
                const num = index + 1;
                const progress = project.progress?.summary?.overallProgress || 0;
                const status = project.progress?.summary?.status || 'unknown';
                const emoji = this.getStatusEmoji(status);
                const elapsed = this.formatElapsedTime(project.sessionInfo.startTime);
                
                output += `[${num}] ${emoji} ${project.name.padEnd(25)} ${this.formatProgressBar(progress)} ${progress.toString().padStart(3)}%  ⏱️  ${elapsed}\n`;
                
                // Show actual instances from the instances array
                if (project.instances.length > 0) {
                    const byRole = project.instances.reduce((acc, inst) => {
                        acc[inst.role] = (acc[inst.role] || 0) + 1;
                        return acc;
                    }, { executive: 0, manager: 0, specialist: 0 });
                    
                    output += `    Executive: ${byRole.executive}  Managers: ${byRole.manager}  Specialists: ${byRole.specialist}\n`;
                } else {
                    output += `    No active instances\n`;
                }
                output += '\n';
            });
        }

        // Footer
        output += '─'.repeat(64) + '\n';
        output += `Last updated: ${new Date().toLocaleTimeString()}\n`;
        
        if (this.options.continuous) {
            output += '\n🎮 Commands: ';
            output += '[1-9] Focus project  ';
            output += '[s] Shutdown all  ';
            output += '[r] Refresh  ';
            output += '[q] Quit\n';
        }

        return output;
    }

    /**
     * Setup keyboard input
     */
    setupKeyboardInput() {
        if (!this.options.continuous) return;

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
        switch (command) {
            case 'q':
                this.cleanup();
                process.exit();
                break;

            case 's':
                await this.shutdownAll();
                break;

            case 'r':
                // Immediate refresh
                break;

            case 'b':
                // Back to overview
                this.selectedProject = null;
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
                const index = parseInt(command) - 1;
                if (index < this.projects.length) {
                    await this.focusProject(index);
                }
                break;
        }
    }

    async shutdownAll() {
        this.clearScreen();
        console.log('🛑 Shutting down all projects...\n');
        
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

    async focusProject(index) {
        const project = this.projects[index];
        if (!project) return;

        this.cleanup();
        
        console.log(`\n📎 Focusing on project: ${project.name}\n`);
        console.log('Starting detailed monitor...\n');
        
        // Launch the single project monitor
        try {
            execSync(`node "${this.monitorPath}" --project-dir "${project.path}"`, {
                stdio: 'inherit'
            });
        } catch (error) {
            // User quit the monitor
        }
        
        // Re-setup keyboard input when returning
        this.setupKeyboardInput();
    }

    async monitor() {
        // Initial scan for projects
        this.projects = [];
        this.findProjects(this.options.scanDir);
        
        if (this.projects.length === 0) {
            console.log(`No projects found in ${this.options.scanDir}`);
            console.log('Projects must contain a .tmux_session_info.json file');
            return;
        }

        // Setup keyboard input
        this.setupKeyboardInput();

        do {
            // Update progress for all projects
            await this.updateAllProgress();
            
            // Display
            this.clearScreen();
            const output = this.displayOverview();
            console.log(output);

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
    const monitor = new MultiProjectMonitor();
    monitor.monitor().catch(error => {
        console.error('Monitor error:', error.message);
        process.exit(1);
    });
}

export { MultiProjectMonitor };