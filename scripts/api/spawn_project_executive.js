#!/usr/bin/env node

/**
 * Universal Project Executive Launcher
 * 
 * Programmatically spawn an executive to manage any project.
 * Designed for integration with external wrapper applications.
 * 
 * Usage:
 *   node spawn_project_executive.js --project-dir /path/to/project --requirements-file requirements.md
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ProjectExecutiveLauncher {
    constructor() {
        this.rootDir = path.join(__dirname, '..', '..');
        this.parseArgs();
    }

    parseArgs() {
        const args = process.argv.slice(2);
        this.options = {
            projectDir: null,
            requirementsFile: 'requirements.md',
            projectType: 'generic',
            executiveTemplate: null,
            noSession: false,
            returnJson: false
        };

        for (let i = 0; i < args.length; i++) {
            switch (args[i]) {
                case '--project-dir':
                    this.options.projectDir = path.resolve(args[++i]);
                    break;
                case '--requirements-file':
                    this.options.requirementsFile = args[++i];
                    break;
                case '--project-type':
                    this.options.projectType = args[++i];
                    break;
                case '--executive-template':
                    this.options.executiveTemplate = args[++i];
                    break;
                case '--no-session':
                    this.options.noSession = true;
                    break;
                case '--json':
                    this.options.returnJson = true;
                    break;
                case '--help':
                    this.showHelp();
                    process.exit(0);
            }
        }

        if (!this.options.projectDir) {
            this.error('--project-dir is required');
        }
    }

    showHelp() {
        console.log(`
Universal Project Executive Launcher

Usage:
  node spawn_project_executive.js --project-dir /path/to/project [options]

Required:
  --project-dir <path>         Path to project directory

Options:
  --requirements-file <file>   Requirements filename (default: requirements.md)
  --project-type <type>        Project type: web-app, api, cli, library (default: generic)
  --executive-template <file>  Custom executive template file
  --no-session                 Don't start tmux session (dry run)
  --json                       Return JSON output for programmatic use
  --help                       Show this help message

Examples:
  # Basic usage
  node spawn_project_executive.js --project-dir /my/project

  # With custom requirements file
  node spawn_project_executive.js --project-dir /my/project --requirements-file project_spec.md

  # For web application with JSON output
  node spawn_project_executive.js --project-dir /my/app --project-type web-app --json
        `);
    }

    error(message) {
        if (this.options?.returnJson) {
            console.log(JSON.stringify({ success: false, error: message }));
        } else {
            console.error(`Error: ${message}`);
        }
        process.exit(1);
    }

    log(message) {
        if (!this.options.returnJson) {
            console.log(message);
        }
    }

    validateProject() {
        // Check project directory exists
        if (!fs.existsSync(this.options.projectDir)) {
            this.error(`Project directory does not exist: ${this.options.projectDir}`);
        }

        // Check requirements file exists
        const requirementsPath = path.join(this.options.projectDir, this.options.requirementsFile);
        if (!fs.existsSync(requirementsPath)) {
            this.error(`Requirements file not found: ${requirementsPath}`);
        }

        return requirementsPath;
    }

    generateExecutiveContext(requirementsPath) {
        const projectName = path.basename(this.options.projectDir);
        const requirementsContent = fs.readFileSync(requirementsPath, 'utf8');
        
        // Extract project type specific guidance
        const projectGuidance = this.getProjectTypeGuidance();

        const context = `# Executive Instructions

You are an Executive orchestrating the development of: ${projectName}

## Project Location
Your working directory: ${this.options.projectDir}
Requirements file: ${this.options.requirementsFile}

## Your Responsibilities
1. Read and analyze the requirements in ${this.options.requirementsFile}
2. Create a comprehensive PROJECT_PLAN.md breaking down the work
3. Create any necessary design documents (DESIGN_SYSTEM.md, API_SPEC.md, etc.)
4. Spawn Manager instances to implement different parts of the project
5. Monitor progress and ensure quality completion

## Project Type: ${this.options.projectType}
${projectGuidance}

## MCP Bridge Usage
Remember to use the MCP bridge for all orchestration:
- Spawn managers: node ${path.join(this.rootDir, 'scripts', 'mcp_bridge.js')} spawn ...
- Send messages: node ${path.join(this.rootDir, 'scripts', 'mcp_bridge.js')} send ...
- Read output: node ${path.join(this.rootDir, 'scripts', 'mcp_bridge.js')} read ...
- List instances: node ${path.join(this.rootDir, 'scripts', 'mcp_bridge.js')} list ...

## Workflow
1. First analyze requirements and create PROJECT_PLAN.md
2. Create any necessary design/specification documents
3. Spawn managers with clear scope boundaries
4. Distribute design docs to ALL managers
5. Monitor progress and coordinate integration
6. Test the complete solution before declaring done

## Important
- NEVER implement code yourself - always delegate to managers
- Ensure all managers confirm understanding before starting work
- Use scope contracts to prevent managers from overstepping boundaries
- Test functional requirements, not just file existence
`;

        // Use custom template if provided
        if (this.options.executiveTemplate && fs.existsSync(this.options.executiveTemplate)) {
            const customTemplate = fs.readFileSync(this.options.executiveTemplate, 'utf8');
            return customTemplate.replace('{{PROJECT_CONTEXT}}', context);
        }

        return context;
    }

    getProjectTypeGuidance() {
        const guidance = {
            'web-app': `
For this web application:
- Ensure consistent UI/UX across all pages
- Create a DESIGN_SYSTEM.md with styling standards
- Test cross-browser compatibility
- Verify responsive design on mobile/desktop`,
            
            'api': `
For this API project:
- Create an API_SPEC.md with endpoint documentation
- Ensure consistent error handling
- Include authentication/authorization patterns
- Test all endpoints with example requests`,
            
            'cli': `
For this CLI tool:
- Define clear command structure
- Include comprehensive help documentation
- Ensure consistent error messages
- Test all commands and edge cases`,
            
            'library': `
For this library:
- Create clear API documentation
- Include usage examples
- Ensure backward compatibility considerations
- Test all public interfaces`,
            
            'generic': `
Analyze the requirements to determine appropriate architecture and design patterns.
Create necessary documentation based on project needs.`
        };

        return guidance[this.options.projectType] || guidance.generic;
    }

    createSessionInfo(sessionName, execId) {
        const sessionInfo = {
            sessionId: sessionName,
            execId: execId,
            projectDir: this.options.projectDir,
            requirementsFile: this.options.requirementsFile,
            projectType: this.options.projectType,
            startTime: new Date().toISOString(),
            status: 'running',
            pid: process.pid,
            monitorCommand: `node ${path.join(__dirname, 'monitor_project.js')} --session-id ${sessionName}`,
            attachCommand: `tmux attach -t ${sessionName}`
        };

        // Save session info
        const sessionInfoPath = path.join(this.options.projectDir, '.tmux_session_info.json');
        fs.writeFileSync(sessionInfoPath, JSON.stringify(sessionInfo, null, 2));

        return sessionInfo;
    }

    async launch() {
        try {
            // Validate project
            const requirementsPath = this.validateProject();
            
            // Generate unique IDs
            const timestamp = Date.now();
            const execId = `exec_${timestamp}`;
            const sessionName = `claude_${execId}`;

            // Generate executive context
            const executiveContext = this.generateExecutiveContext(requirementsPath);
            
            // Write CLAUDE.md to project directory
            const claudeMdPath = path.join(this.options.projectDir, 'CLAUDE.md');
            fs.writeFileSync(claudeMdPath, executiveContext);
            this.log(`Created CLAUDE.md with executive instructions`);

            // Create .claude directory and settings if needed
            const claudeDir = path.join(this.options.projectDir, '.claude');
            if (!fs.existsSync(claudeDir)) {
                fs.mkdirSync(claudeDir, { recursive: true });
                
                // Copy MCP settings
                const settingsSource = path.join(this.rootDir, 'exec_497307', '.claude', 'settings.json');
                const settingsDest = path.join(claudeDir, 'settings.json');
                
                if (fs.existsSync(settingsSource)) {
                    fs.copyFileSync(settingsSource, settingsDest);
                } else {
                    // Create default settings
                    const defaultSettings = {
                        mcpServers: {
                            "tmux-claude": {
                                command: "node",
                                args: [path.join(this.rootDir, "src", "simple_mcp_server.js")],
                                env: {
                                    NODE_ENV: "production",
                                    PHASE: "3",
                                    ALLOWED_TOOLS: '["spawn","send","read","list","terminate"]'
                                }
                            }
                        }
                    };
                    fs.writeFileSync(settingsDest, JSON.stringify(defaultSettings, null, 2));
                }
            }

            // Create session info
            const sessionInfo = this.createSessionInfo(sessionName, execId);

            // Start tmux session if not in dry run
            if (!this.options.noSession) {
                this.log(`Creating tmux session: ${sessionName}`);
                
                // Create tmux session
                execSync(`tmux new-session -d -s ${sessionName} -c "${this.options.projectDir}"`);
                
                // Prepare initial message
                const initialMessage = `Read the CLAUDE.md file in this directory and begin orchestrating the project according to the requirements in ${this.options.requirementsFile}`;
                
                // Start Claude Code with permissions bypass and initial message
                execSync(`tmux send-keys -t ${sessionName}:0.0 'claude --dangerously-skip-permissions "${initialMessage}"' Enter`);
                
                this.log(`✅ Executive spawned successfully!`);
                this.log(`Session: ${sessionName}`);
                this.log(`Working Directory: ${this.options.projectDir}`);
                this.log(`\nTo monitor: ${sessionInfo.monitorCommand}`);
                this.log(`To attach: ${sessionInfo.attachCommand}`);
            }

            // Return appropriate output
            if (this.options.returnJson) {
                console.log(JSON.stringify({
                    success: true,
                    sessionInfo: sessionInfo
                }));
            }

            return sessionInfo;

        } catch (error) {
            this.error(`Failed to launch executive: ${error.message}`);
        }
    }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const launcher = new ProjectExecutiveLauncher();
    launcher.launch();
}

export { ProjectExecutiveLauncher };