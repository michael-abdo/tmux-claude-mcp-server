#!/usr/bin/env node

/**
 * Project Progress Tracking Utility
 * 
 * Get detailed progress information about a project including:
 * - Todo item completion status
 * - Files created/modified
 * - Current activity
 * - Time estimates
 * 
 * Usage:
 *   node get_project_progress.js --project-dir /path/to/project
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ProjectProgressTracker {
    constructor() {
        this.rootDir = path.join(__dirname, '..', '..');
        this.bridgePath = path.join(this.rootDir, 'scripts', 'mcp_bridge.js');
        this.parseArgs();
    }

    parseArgs() {
        const args = process.argv.slice(2);
        this.options = {
            projectDir: null,
            sessionId: null,
            format: 'text', // text, json, or percentage
            verbose: false
        };

        for (let i = 0; i < args.length; i++) {
            switch (args[i]) {
                case '--project-dir':
                    this.options.projectDir = path.resolve(args[++i]);
                    break;
                case '--session-id':
                    this.options.sessionId = args[++i];
                    break;
                case '--format':
                    this.options.format = args[++i];
                    break;
                case '--verbose':
                    this.options.verbose = true;
                    break;
                case '--help':
                    this.showHelp();
                    process.exit(0);
            }
        }

        if (!this.options.projectDir && !this.options.sessionId) {
            this.error('Either --project-dir or --session-id is required');
        }
    }

    showHelp() {
        console.log(`
Project Progress Tracking Utility

Usage:
  node get_project_progress.js --project-dir /path/to/project [options]
  node get_project_progress.js --session-id claude_exec_123 [options]

Required (one of):
  --project-dir <path>   Project directory path
  --session-id <id>      Session ID to track

Options:
  --format <type>        Output format: text, json, percentage (default: text)
  --verbose              Show detailed progress information
  --help                 Show this help message

Examples:
  # Get progress summary
  node get_project_progress.js --project-dir /my/project

  # Get progress as percentage
  node get_project_progress.js --project-dir /my/project --format percentage

  # Get detailed JSON progress
  node get_project_progress.js --session-id claude_exec_123 --format json --verbose
        `);
    }

    error(message) {
        if (this.options?.format === 'json') {
            console.log(JSON.stringify({ success: false, error: message }));
        } else {
            console.error(`Error: ${message}`);
        }
        process.exit(1);
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

    async getProjectFiles() {
        if (!this.options.projectDir) return [];
        
        const files = [];
        const ignorePatterns = [
            '.git', 'node_modules', '.claude', 'logs', 'state',
            '.tmux_session_info.json', 'CLAUDE.md'
        ];

        function scanDir(dir, baseDir = '') {
            const items = fs.readdirSync(dir);
            
            items.forEach(item => {
                if (ignorePatterns.some(pattern => item.includes(pattern))) return;
                
                const fullPath = path.join(dir, item);
                const relativePath = path.join(baseDir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    scanDir(fullPath, relativePath);
                } else {
                    files.push({
                        path: relativePath,
                        size: stat.size,
                        modified: stat.mtime,
                        created: stat.birthtime
                    });
                }
            });
        }

        try {
            scanDir(this.options.projectDir);
        } catch (error) {
            // Ignore errors
        }

        return files;
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

    async getTodoProgress(instances) {
        // This would integrate with the todo monitoring system
        // For now, return mock data structure
        const todos = {
            total: 0,
            completed: 0,
            inProgress: 0,
            pending: 0,
            items: []
        };

        // TODO: Implement actual todo fetching via MCP tools
        // Would need to call getProgress tool for each instance

        return todos;
    }

    analyzeProgress(sessionInfo, instances, files, todos) {
        const startTime = sessionInfo ? new Date(sessionInfo.startTime) : new Date();
        const elapsedMinutes = Math.floor((Date.now() - startTime.getTime()) / 60000);

        const progress = {
            summary: {
                status: 'active',
                startTime: startTime.toISOString(),
                elapsedMinutes: elapsedMinutes,
                estimatedCompletion: null,
                overallProgress: 0
            },
            instances: {
                total: instances.length,
                byRole: {
                    executive: instances.filter(i => i.role === 'executive').length,
                    manager: instances.filter(i => i.role === 'manager').length,
                    specialist: instances.filter(i => i.role === 'specialist').length
                }
            },
            files: {
                total: files.length,
                created: files.filter(f => {
                    const created = new Date(f.created);
                    return created > startTime;
                }).length,
                modified: files.filter(f => {
                    const modified = new Date(f.modified);
                    return modified > startTime;
                }).length,
                byType: {}
            },
            todos: todos,
            milestones: []
        };

        // Count files by extension
        files.forEach(file => {
            const ext = path.extname(file.path) || 'no-ext';
            progress.files.byType[ext] = (progress.files.byType[ext] || 0) + 1;
        });

        // Calculate overall progress
        if (todos.total > 0) {
            progress.summary.overallProgress = Math.round((todos.completed / todos.total) * 100);
        } else if (files.length > 0) {
            // Rough estimate based on file creation
            progress.summary.overallProgress = Math.min(90, files.length * 10);
        }

        // Determine status
        if (instances.length === 0) {
            progress.summary.status = files.length > 0 ? 'completed' : 'not-started';
        } else if (progress.summary.overallProgress >= 90) {
            progress.summary.status = 'finalizing';
        } else if (progress.summary.overallProgress > 0) {
            progress.summary.status = 'in-progress';
        }

        // Check for key milestones
        const milestoneFiles = [
            { file: 'PROJECT_PLAN.md', milestone: 'Planning completed' },
            { file: 'DESIGN_SYSTEM.md', milestone: 'Design system created' },
            { file: 'API_SPEC.md', milestone: 'API specification defined' },
            { file: 'index.html', milestone: 'Frontend development started' },
            { file: 'README.md', milestone: 'Documentation created' }
        ];

        milestoneFiles.forEach(({ file, milestone }) => {
            if (files.some(f => f.path === file)) {
                progress.milestones.push({
                    name: milestone,
                    completed: true,
                    file: file
                });
            }
        });

        return progress;
    }

    formatOutput(progress) {
        switch (this.options.format) {
            case 'json':
                return JSON.stringify(progress, null, 2);
            
            case 'percentage':
                return `${progress.summary.overallProgress}%`;
            
            case 'text':
            default:
                let output = '';
                
                output += `🚀 PROJECT PROGRESS REPORT\n`;
                output += `${'═'.repeat(40)}\n\n`;
                
                output += `📊 Overall Progress: ${progress.summary.overallProgress}%\n`;
                output += `⏱️  Elapsed Time: ${progress.summary.elapsedMinutes} minutes\n`;
                output += `🔄 Status: ${progress.summary.status}\n\n`;

                output += `👥 Active Instances:\n`;
                output += `   Executives: ${progress.instances.byRole.executive}\n`;
                output += `   Managers: ${progress.instances.byRole.manager}\n`;
                output += `   Specialists: ${progress.instances.byRole.specialist}\n\n`;

                output += `📁 Files Created: ${progress.files.created}\n`;
                output += `📝 Files Modified: ${progress.files.modified}\n`;
                output += `📂 Total Files: ${progress.files.total}\n\n`;

                if (progress.todos.total > 0) {
                    output += `✅ Tasks Completed: ${progress.todos.completed}/${progress.todos.total}\n`;
                    output += `🔄 In Progress: ${progress.todos.inProgress}\n`;
                    output += `⏳ Pending: ${progress.todos.pending}\n\n`;
                }

                if (progress.milestones.length > 0) {
                    output += `🎯 Milestones:\n`;
                    progress.milestones.forEach(m => {
                        output += `   ✓ ${m.name}\n`;
                    });
                    output += '\n';
                }

                if (this.options.verbose && progress.files.byType) {
                    output += `📊 Files by Type:\n`;
                    Object.entries(progress.files.byType).forEach(([ext, count]) => {
                        output += `   ${ext}: ${count}\n`;
                    });
                }

                return output;
        }
    }

    async track() {
        // Load session info
        const sessionInfo = await this.loadSessionInfo();
        
        if (!this.options.sessionId && !sessionInfo) {
            this.error('Could not determine session information');
        }

        // Get project files
        const files = await this.getProjectFiles();

        // Get active instances
        const instances = await this.getActiveInstances();
        
        // Filter to project instances
        const projectInstances = instances.filter(inst => {
            if (sessionInfo) {
                return inst.instanceId.includes(sessionInfo.execId) ||
                       (inst.workDir && inst.workDir.startsWith(sessionInfo.projectDir));
            }
            return inst.instanceId.includes(this.options.sessionId);
        });

        // Get todo progress
        const todos = await this.getTodoProgress(projectInstances);

        // Analyze overall progress
        const progress = this.analyzeProgress(sessionInfo, projectInstances, files, todos);

        // Output results
        console.log(this.formatOutput(progress));
    }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const tracker = new ProjectProgressTracker();
    tracker.track().catch(error => {
        tracker.error(error.message);
    });
}

export { ProjectProgressTracker };