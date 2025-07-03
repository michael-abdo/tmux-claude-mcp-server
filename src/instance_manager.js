/**
 * Instance Manager - Harvested and adapted from tmux-manager codebase
 * 
 * Combines and adapts functionality from:
 * - tmux-manager/src/claude_automation/instance.py (lifecycle management)
 * - tmux-manager/src/claude_automation/manager.py (registry operations)
 * - tmux-manager/src/session_management/session_manager.py (session operations)
 * 
 * Key adaptations for MCP architecture:
 * - External state store instead of in-memory tracking
 * - Project isolation with --project flag
 * - Role-based instance management
 * - Simplified for MCP tool interface
 */

import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { TmuxInterface } from './tmux_interface.js';
import { RedisStateStore } from './redis_state_store.js';
import { spawn } from 'child_process';
import { todoMonitor } from './todo_monitor.js';
import { mcpConfigGenerator } from './mcp_config_generator.js';
import { gitBranchManager } from './git_branch_manager.js';
import { sharedWorkspaceGitManager } from './shared_workspace_git_manager.js';
import { pathResolver } from './utils/path_resolver.js';
import { buildClaudeMd } from './claude_md_builder.js';

export class InstanceManager {
    constructor(stateDir = './state', options = {}) {
        // Use PathResolver for portable state directory when default is used
        if (stateDir === './state') {
            this.stateDir = pathResolver.state();
        } else {
            // Allow explicit override for backward compatibility or testing
            this.stateDir = stateDir;
        }
        
        this.instancesFile = path.join(this.stateDir, 'instances.json');
        this.tmux = new TmuxInterface();
        this.silent = options.silent || false;
        
        // Phase 3: Use Redis state store if enabled
        this.useRedis = options.useRedis || process.env.PHASE === '3';
        this.stateStore = null;
        
        // Ensure state directory exists
        fs.ensureDirSync(this.stateDir);
        
        // Initialize instances state
        this.instances = {};
        
        // Initialize state store asynchronously
        this.initializeStateStore();
    }

    async initializeStateStore() {
        if (this.useRedis) {
            this.stateStore = new RedisStateStore({
                fallbackDir: this.stateDir
            });
            await this.stateStore.initialize();
            this.instances = await this.stateStore.getAllInstances();
            if (!this.silent) {
                console.error(`=== Instance Manager initialized with Redis (${Object.keys(this.instances).length} instances) ===`);
            }
        } else {
            this.instances = this.loadInstances();
            if (!this.silent) {
                console.error(`=== Instance Manager initialized with JSON (${Object.keys(this.instances).length} instances) ===`);
            }
        }
        
        // CRITICAL FIX: Clean dead instances from registry on startup
        await this.reconcileInstances();
    }
    
    /**
     * CRITICAL FIX: Reconcile registry with actual tmux sessions
     * Removes dead instances to prevent accumulation of ghost entries
     */
    async reconcileInstances() {
        const sessions = await this.tmux.listSessions();
        const activeSessions = new Set(sessions.map(s => s.name));
        
        const deadInstances = [];
        for (const [instanceId, instance] of Object.entries(this.instances)) {
            if (!activeSessions.has(instance.sessionName)) {
                deadInstances.push(instanceId);
            }
        }
        
        if (deadInstances.length > 0) {
            console.error(`!!! RECONCILIATION !!! Found ${deadInstances.length} dead instances in registry`);
            for (const instanceId of deadInstances) {
                console.error(`Removing dead instance: ${instanceId}`);
                delete this.instances[instanceId];
            }
            await this.saveInstances();
            console.error(`Registry cleaned: ${deadInstances.length} dead instances removed`);
        } else {
            console.error(`Registry clean: All ${Object.keys(this.instances).length} instances are active`);
        }
    }

    /**
     * Generate hierarchical instance ID.
     * Adapted from: instance.py lines 70-71 (instance_id generation)
     */
    generateInstanceId(role, parentId = null) {
        const timestamp = Date.now().toString().slice(-6); // Last 6 digits for uniqueness
        
        if (role === 'executive') {
            return `exec_${timestamp}`;
        } else if (role === 'manager') {
            const parentNum = parentId ? parentId.split('_')[1] : '1';
            return `mgr_${parentNum}_${timestamp}`;
        } else if (role === 'specialist') {
            // Extract parent numbers for hierarchical naming
            const parentParts = parentId ? parentId.split('_') : ['', '1', '1'];
            return `spec_${parentParts[1]}_${parentParts[2]}_${timestamp}`;
        }
        
        return `${role}_${timestamp}`;
    }

    /**
     * Create and register a new Claude instance.
     * Adapted from: manager.py lines 67-139 (create_instance)
     * Enhanced with project isolation and MCP requirements
     * Added workspace modes: isolated (default) and shared (managers only)
     */
    async spawnInstance(role, workDir, context, parentId = null, options = {}) {
        try {
            // Validate role
            const validRoles = ['executive', 'manager', 'specialist'];
            if (!validRoles.includes(role)) {
                throw new Error(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
            }
            
            // Handle both string workspaceMode and options object
            const workspaceMode = typeof options === 'string' ? options : (options.workspaceMode || 'isolated');
            
            const instanceId = this.generateInstanceId(role, parentId);
            const sessionName = `claude_${instanceId}`;
            
            // Determine project directory based on workspace mode
            let projectDir;
            let isSharedWorkspace = false;
            
            if (workspaceMode === 'shared' && role === 'manager') {
                // Shared mode: managers work in the same directory
                projectDir = workDir;
                isSharedWorkspace = true;
                console.log(`Manager ${instanceId} will use shared workspace: ${workDir}`);
            } else {
                // Isolated mode: each instance gets its own subdirectory (default)
                projectDir = path.join(workDir, instanceId);
            }
            
            // Build CLAUDE.md content using canonical builder
            const claudeContent = buildClaudeMd(role, instanceId, workDir, parentId, context);
            
            // For non-specialists, create project directory and write files
            if (role !== 'specialist') {
                await fs.ensureDir(projectDir);
                
                if (isSharedWorkspace) {
                    // Shared workspace: create markers and manager-specific directories
                    await this.setupSharedWorkspace(projectDir, instanceId, context, { role, parentId });
                    
                    // Place manager-specific CLAUDE.md in .managers subdirectory
                    const managersDir = path.join(projectDir, '.managers', instanceId);
                    await fs.ensureDir(managersDir);
                    await fs.writeFile(path.join(managersDir, 'CLAUDE.md'), claudeContent);
                    
                    // Note: MCP config generation happens during git integration phase
                } else {
                    // Isolated workspace: place CLAUDE.md in instance directory
                    await fs.writeFile(path.join(projectDir, 'CLAUDE.md'), claudeContent);
                    
                    // Generate MCP configuration for isolated workspace (no git integration)
                    await mcpConfigGenerator.generateConfig({
                        instanceId,
                        role,
                        workDir: projectDir,
                        parentId
                    });
                }
            }
            
            // Create Git worktree for specialists
            let branchName = null;
            let actualProjectDir = projectDir; // May be overridden for specialists
            
            if (role === 'specialist') {
                // Extract task ID and feature from context if possible
                const taskId = this.extractTaskId(context) || 'task-' + Date.now();
                const feature = this.extractFeature(context) || 'implementation';
                
                // Ensure we're in a git repo first
                try {
                    await gitBranchManager.ensureGitRepo(workDir);
                } catch {
                    // Initialize git if not a repo
                    await gitBranchManager.gitCommand('init', workDir);
                }
                
                // Create worktree for specialist isolation
                const worktreeInfo = await gitBranchManager.createSpecialistWorktree({
                    instanceId,
                    taskId,
                    feature,
                    workDir: workDir  // Use parent workDir as base
                });
                
                branchName = worktreeInfo.branchName;
                actualProjectDir = worktreeInfo.worktreePath; // Specialist works in worktree
                
                // Write CLAUDE.md to the worktree instead
                await fs.ensureDir(actualProjectDir);
                await fs.writeFile(path.join(actualProjectDir, 'CLAUDE.md'), claudeContent);
                
                // Generate MCP configuration in the worktree
                await mcpConfigGenerator.generateConfig({
                    instanceId,
                    role,
                    workDir: actualProjectDir,
                    parentId
                });
            }
            
            // Create tmux session (using actualProjectDir for specialists)
            const success = await this.tmux.createSession(sessionName, actualProjectDir);
            if (!success) {
                throw new Error('Failed to create tmux session');
            }
            
            // Launch Claude with project isolation
            const paneTarget = this.tmux.getPaneTarget(sessionName);
            await this.launchClaude(paneTarget, actualProjectDir);
            
            // Start todo monitoring for progress tracking
            todoMonitor.startMonitoring(instanceId, actualProjectDir);
            
            // Register instance in state store
            const instance = {
                instanceId,
                role,
                parentId,
                sessionName,
                projectDir: actualProjectDir,  // Use worktree path for specialists
                paneTarget,
                workDir,
                branchName,
                isWorktree: role === 'specialist',  // Track if using worktree
                isSharedWorkspace,  // Track if using shared workspace mode
                gitEnabled: false,  // Will be updated if git integration succeeds
                gitBranch: null,    // Will be updated with manager branch name
                status: 'initializing',
                created: new Date().toISOString(),
                children: [],
                todoMonitoring: true,
                mcpConfigPath: mcpConfigGenerator.getConfigPath(actualProjectDir)
            };
            
            this.instances[instanceId] = instance;
            
            // Update parent's children list
            if (parentId && this.instances[parentId]) {
                this.instances[parentId].children.push(instanceId);
            }
            
            await this.saveInstances();
            
            // Send identity message
            await this.sendToInstance(instanceId, `You are ${role} with ID ${instanceId}`);
            
            // Update status
            this.instances[instanceId].status = 'active';
            await this.saveInstances();
            
            console.log(`Created Claude instance: ${role} (${instanceId})`);
            return {
                instanceId,
                paneId: paneTarget,
                projectPath: actualProjectDir
            };
            
        } catch (error) {
            console.error(`!!! ERROR !!! Failed to spawn instance: ${error.message}`);
            throw error;
        }
    }


    /**
     * Launch Claude with project isolation.
     * Adapted from: instance.py lines 331-375 (_initialize_claude)
     */
    async launchClaude(paneTarget, projectDir) {
        try {
            // Change to project directory
            await this.tmux.sendKeys(paneTarget, `cd "${projectDir}"`, true);
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // CRITICAL: Set environment variables for MCP tool availability
            await this.tmux.sendKeys(paneTarget, `export CLAUDE_CODE_ENTRYPOINT=cli`, true);
            await this.tmux.sendKeys(paneTarget, `export CLAUDECODE=1`, true);
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Copy global settings.json to ensure MCP tools are available
            // This is required because Claude reads .claude/settings.json from the working directory
            await this.tmux.sendKeys(paneTarget, `mkdir -p .claude`, true);
            await this.tmux.sendKeys(paneTarget, `cp ~/.claude/settings.json .claude/`, true);
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Set Claude configuration to skip trust dialog
            await this.tmux.sendKeys(paneTarget, `claude config set hasTrustDialogAccepted true`, true);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Launch Claude with correct flags
            await this.tmux.sendKeys(paneTarget, `claude --dangerously-skip-permissions`, true);
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Handle permission dialog automatically
            console.log(`Handling permission dialog for ${paneTarget}`);
            await this.tmux.sendKeys(paneTarget, 'Down', false); // Select "Yes, I accept"
            await new Promise(resolve => setTimeout(resolve, 500));
            await this.tmux.sendKeys(paneTarget, '', true); // Press Enter
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for Claude to load
            
            console.log(`Claude initialized with MCP in ${paneTarget}`);
            return true;
        } catch (error) {
            console.error(`!!! ERROR !!! Failed to initialize Claude: ${error.message}`);
            return false;
        }
    }

    /**
     * Send text to a Claude instance.
     * Adapted from: tmux_interface.py lines 343-372 (send_keys)
     */
    async sendToInstance(instanceId, text) {
        const instance = this.instances[instanceId];
        if (!instance) {
            throw new Error(`Instance not found: ${instanceId}`);
        }
        
        // Send text with Enter
        await this.tmux.sendKeys(instance.paneTarget, text, true);
        
        // Send another Enter after delay as safety measure
        // Claude sometimes needs multiple Enter presses when in "Bypassing Permissions" mode
        await new Promise(resolve => setTimeout(resolve, 1500));
        await this.tmux.sendKeys(instance.paneTarget, '', true);
        console.log(`Sent additional Enter to ${instanceId} for safety`);
        
        return true;
    }

    /**
     * Read output from a Claude instance.
     * Adapted from: instance.py lines 377-397 (capture_content)
     */
    async readFromInstance(instanceId, lines = 50) {
        const instance = this.instances[instanceId];
        if (!instance) {
            throw new Error(`Instance not found: ${instanceId}`);
        }
        
        const output = await this.tmux.capturePane(instance.paneTarget, lines);
        return {
            output,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * List instances with optional filtering.
     * Adapted from: manager.py lines 153-160 (get_instances)
     */
    async listInstances(role = null, parentId = null) {
        const instances = Object.values(this.instances);
        
        return instances
            .filter(instance => !role || instance.role === role)
            .filter(instance => !parentId || instance.parentId === parentId)
            .map(instance => ({
                instanceId: instance.instanceId,
                role: instance.role,
                parentId: instance.parentId,
                workDir: instance.workDir,
                status: instance.status,
                created: instance.created
            }));
    }

    /**
     * Terminate a Claude instance and optionally its children.
     * Adapted from: manager.py lines 177-200 (remove_instance)
     */
    async terminateInstance(instanceId, cascade = false) {
        const instance = this.instances[instanceId];
        if (!instance) {
            throw new Error(`Instance not found: ${instanceId}`);
        }
        
        try {
            // Terminate children if cascade is enabled
            if (cascade && instance.children.length > 0) {
                for (const childId of instance.children) {
                    await this.terminateInstance(childId, true);
                }
            }
            
            // Try graceful shutdown first
            if (instance.status === 'active') {
                await this.gracefulShutdown(instanceId);
            }
            
            // Stop todo monitoring
            todoMonitor.stopMonitoring(instanceId);
            
            // Kill tmux session
            await this.tmux.killSession(instance.sessionName);
            
            // Clean up worktree for specialists
            if (instance.isWorktree && instance.branchName) {
                try {
                    // Get the base workDir (parent directory)
                    const baseWorkDir = path.dirname(path.dirname(instance.projectDir));
                    
                    await gitBranchManager.removeSpecialistWorktree({
                        worktreePath: instance.projectDir,
                        branchName: instance.branchName,
                        workDir: baseWorkDir,
                        force: true  // Force removal even if there are uncommitted changes
                    });
                    
                    console.log(`Cleaned up worktree for specialist ${instanceId}`);
                } catch (error) {
                    console.error(`Warning: Failed to clean up worktree: ${error.message}`);
                    // Continue with termination even if worktree cleanup fails
                }
            }
            
            // Remove from parent's children list
            if (instance.parentId && this.instances[instance.parentId]) {
                const parent = this.instances[instance.parentId];
                parent.children = parent.children.filter(id => id !== instanceId);
            }
            
            // Remove from instances
            delete this.instances[instanceId];
            await this.saveInstances();
            
            console.log(`Terminated instance: ${instanceId}`);
            return true;
        } catch (error) {
            console.error(`!!! ERROR !!! Failed to terminate instance: ${error.message}`);
            return false;
        }
    }

    /**
     * Check if instance is alive and responsive.
     * New method for health monitoring.
     */
    async isInstanceActive(instanceId) {
        const instance = this.instances[instanceId];
        if (!instance) return false;
        
        return await this.tmux.isPaneActive(instance.paneTarget);
    }

    /**
     * Load instances from external state store.
     * Adapted from: manager.py lines 283-302 (_load_instances)
     */
    loadInstances() {
        if (this.useRedis && this.stateStore) {
            // Redis handles loading in initializeStateStore
            return {};
        }
        try {
            if (!fs.existsSync(this.instancesFile)) {
                console.log(`No instances file found at ${this.instancesFile}`);
                return {};
            }
            
            const data = fs.readJsonSync(this.instancesFile);
            if (!this.silent) {
                console.error(`Loaded ${Object.keys(data.instances || {}).length} instances from ${this.instancesFile}`);
            }
            return data.instances || {};
        } catch (error) {
            console.error(`!!! ERROR !!! Failed to load instances: ${error.message}`);
            return {};
        }
    }

    /**
     * Save instances to external state store.
     * Adapted from: manager.py lines 304-316 (_save_instances)
     */
    async saveInstances() {
        if (this.useRedis && this.stateStore) {
            // Save each instance to Redis
            for (const [id, instance] of Object.entries(this.instances)) {
                await this.stateStore.saveInstance(id, instance);
            }
            console.log(`Saved ${Object.keys(this.instances).length} instances to Redis`);
            return;
        }
        try {
            const data = { instances: this.instances };
            fs.writeJsonSync(this.instancesFile, data, { spaces: 2 });
            console.log(`Saved ${Object.keys(this.instances).length} instances to ${this.instancesFile}`);
        } catch (error) {
            console.error(`!!! ERROR !!! Failed to save instances: ${error.message}`);
        }
    }

    /**
     * Restart a dead instance using --continue flag.
     * Implementation of nearly-free recovery from architecture docs.
     */
    async restartInstance(instanceId) {
        const instance = this.instances[instanceId];
        if (!instance) {
            throw new Error(`Instance not found: ${instanceId}`);
        }
        
        try {
            // Check if actually dead
            if (await this.isInstanceActive(instanceId)) {
                return { status: 'already_running', instanceId };
            }
            
            // Restart Claude instance
            const paneTarget = this.tmux.getPaneTarget(instance.sessionName);
            await this.tmux.createSession(instance.sessionName, instance.projectDir);
            await this.launchClaude(paneTarget, instance.projectDir);
            
            // Update instance state
            instance.status = 'active';
            instance.restarted = new Date().toISOString();
            await this.saveInstances();
            
            // Send identity reminder
            await this.sendToInstance(instanceId, `You are ${instance.role} with ID ${instanceId}`);
            
            return { status: 'restarted', instanceId };
        } catch (error) {
            console.error(`!!! ERROR !!! Failed to restart instance: ${error.message}`);
            throw error;
        }
    }

    /**
     * Gracefully shutdown a Claude instance.
     * Sends exit command and waits for clean exit before forcing.
     */
    async gracefulShutdown(instanceId) {
        try {
            const instance = this.instances[instanceId];
            if (!instance) return;
            
            console.log(`Starting graceful shutdown of ${instanceId}...`);
            
            // Send exit command to Claude
            await this.tmux.sendKeys(instance.paneTarget, 'exit', true);
            
            // Wait for graceful exit (max 5 seconds)
            let gracefulExit = false;
            const maxWait = 5000;
            const checkInterval = 500;
            let waited = 0;
            
            while (waited < maxWait) {
                await new Promise(resolve => setTimeout(resolve, checkInterval));
                const sessions = await this.tmux.listSessions();
                if (!sessions.some(s => s.name === instance.sessionName)) {
                    gracefulExit = true;
                    break;
                }
                waited += checkInterval;
            }
            
            if (gracefulExit) {
                console.log(`Instance ${instanceId} shut down gracefully`);
            } else {
                console.log(`Instance ${instanceId} did not exit gracefully, will force terminate`);
            }
        } catch (error) {
            console.error(`Error during graceful shutdown of ${instanceId}:`, error);
        }
    }

    /**
     * Cleanup all instances with graceful shutdown.
     * Used for clean system shutdown.
     */
    async cleanup() {
        console.log('Starting graceful cleanup of all instances...');
        
        // Get all active instances
        const instances = await this.listInstances();
        const activeInstances = instances.filter(i => i.status === 'active');
        
        // Gracefully shutdown all active instances in parallel
        if (activeInstances.length > 0) {
            console.log(`Shutting down ${activeInstances.length} active instances...`);
            await Promise.all(
                activeInstances.map(instance => 
                    this.gracefulShutdown(instance.instanceId).catch(err => 
                        console.error(`Failed to gracefully shutdown ${instance.instanceId}:`, err)
                    )
                )
            );
        }
        
        // Clean up any remaining sessions
        const sessions = await this.tmux.listSessions();
        for (const session of sessions) {
            if (session.name.startsWith('claude_')) {
                await this.tmux.killSession(session.name);
            }
        }
        
        if (this.useRedis && this.stateStore && this.stateStore.cleanup) {
            await this.stateStore.cleanup();
        }
        
        // Stop todo monitoring for all instances
        for (const instanceId of Object.keys(this.instances)) {
            todoMonitor.stopMonitoring(instanceId);
        }
        
        console.log('Cleanup completed');
    }
    
    /**
     * Extract task ID from context
     * @param {string} context - Instance context
     * @returns {string|null} Task ID or null
     */
    extractTaskId(context) {
        // Look for patterns like "Task ID: xyz", "task-123", "#task-456"
        const patterns = [
            /Task ID:\s*([a-zA-Z0-9-_]+)/i,
            /task[-_]([a-zA-Z0-9]+)/i,
            /#task[-_]([a-zA-Z0-9]+)/i
        ];
        
        for (const pattern of patterns) {
            const match = context.match(pattern);
            if (match) return match[1];
        }
        
        return null;
    }
    
    /**
     * Extract feature name from context
     * @param {string} context - Instance context
     * @returns {string|null} Feature name or null
     */
    extractFeature(context) {
        // Look for patterns like "Feature: xyz", "implement xyz", "build xyz"
        const patterns = [
            /Feature:\s*([a-zA-Z0-9-_\s]+)/i,
            /implement\s+([a-zA-Z0-9-_]+)/i,
            /build\s+([a-zA-Z0-9-_]+)/i,
            /create\s+([a-zA-Z0-9-_]+)/i
        ];
        
        for (const pattern of patterns) {
            const match = context.match(pattern);
            if (match) {
                return match[1].trim().toLowerCase().replace(/\s+/g, '-');
            }
        }
        
        return null;
    }
    
    /**
     * Get progress for an instance from todo monitoring
     * @param {string} instanceId - Instance ID
     * @returns {Object} Progress information
     */
    getInstanceProgress(instanceId) {
        return todoMonitor.getProgress(instanceId);
    }
    
    /**
     * Setup shared workspace markers and structure with git integration
     * @param {string} workspaceDir - Shared workspace directory
     * @param {string} instanceId - Manager instance ID being added
     * @param {string} context - Manager context for git branch
     */
    async setupSharedWorkspace(workspaceDir, instanceId, context = 'Manager collaboration task', options = {}) {
        // Phase 1: Core workspace setup (always succeeds)
        const workspace = await this.createCoreWorkspace(workspaceDir, instanceId, context);
        
        // Phase 2: Git integration (optional enhancement)
        try {
            workspace.git = await this.addGitIntegration(workspaceDir, instanceId, context, options);
            console.log(`✓ Git integration enabled for workspace: ${workspaceDir}`);
        } catch (error) {
            console.warn(`⚠️ Git integration failed: ${error.message}`);
            workspace.git = { enabled: false, error: error.message };
        }
        
        return workspace;
    }

    /**
     * Create core workspace structure and files (no git operations)
     * @param {string} workspaceDir - Workspace directory
     * @param {string} instanceId - Manager instance ID
     * @param {string} context - Manager context
     * @returns {Promise<Object>} Core workspace setup result
     */
    async createCoreWorkspace(workspaceDir, instanceId, context) {
        const markerFile = path.join(workspaceDir, 'SHARED_WORKSPACE.md');
        
        // Check if this is the first manager
        let isFirstManager = false;
        let content = '';
        try {
            content = await fs.readFile(markerFile, 'utf-8');
        } catch {
            isFirstManager = true;
            // Create new marker file
            content = `# Shared Manager Workspace

This is a shared workspace where all managers collaborate.

## Active Managers

## Git Branches
Each manager works on their own branch and merges back to main when ready.

## Guidelines
- All managers can see and modify all files
- Use git branches for isolation: manager-{instanceId}
- Communicate major changes via MCP messages
- Check .managers/{instanceId}/CLAUDE.md for each manager's context
- Test changes before merging
- Use descriptive commit messages
`;
        }
        
        // Add this manager to the active list if not already present
        if (!content.includes(`- ${instanceId}`)) {
            content = content.replace(
                '## Active Managers\n',
                `## Active Managers\n- ${instanceId} (branch: pending)\n`
            );
        }
        
        // Write workspace marker file
        await fs.writeFile(markerFile, content);
        
        // Ensure .managers directory exists
        await fs.ensureDir(path.join(workspaceDir, '.managers'));
        
        console.log(`✓ Core workspace setup complete: ${workspaceDir}`);
        
        return {
            workspaceDir,
            instanceId,
            isFirstManager,
            markerFile,
            content,
            coreSetup: true
        };
    }

    /**
     * Add git integration to existing workspace
     * @param {string} workspaceDir - Workspace directory
     * @param {string} instanceId - Manager instance ID 
     * @param {string} context - Manager context
     * @param {Object} options - Additional options like role for MCP config
     * @returns {Promise<Object>} Git integration result
     */
    async addGitIntegration(workspaceDir, instanceId, context, options = {}) {
        const markerFile = path.join(workspaceDir, 'SHARED_WORKSPACE.md');
        
        // Initialize git workspace if needed
        try {
            await sharedWorkspaceGitManager.initializeSharedWorkspace(workspaceDir);
            console.log(`Initialized git for shared workspace: ${workspaceDir}`);
        } catch (error) {
            throw new Error(`Git initialization failed: ${error.message}`);
        }
        
        // Phase 1: Create ALL files first (before any git commits)
        let managerBranch = `manager-${instanceId}`;
        
        // Generate MCP configuration BEFORE git operations
        if (options.role) {
            try {
                const mcpConfigModule = await import('./mcp_config_generator.js');
                await mcpConfigModule.mcpConfigGenerator.generateConfig({
                    instanceId,
                    role: options.role,
                    workDir: workspaceDir,
                    parentId: options.parentId
                });
                console.log(`Generated MCP config for ${instanceId}`);
            } catch (error) {
                console.warn(`Could not generate MCP config: ${error.message}`);
            }
        }
        
        // Update marker file with git branch info BEFORE git operations
        try {
            let content = await fs.readFile(markerFile, 'utf-8');
            
            // Update git branch section
            const gitBranchSection = `\n## Git Branches\nEach manager works on their own branch and merges back to main when ready.\n\n### Active Branches\n- ${managerBranch} (${instanceId})\n`;
            
            if (!content.includes('### Active Branches')) {
                content = content.replace(
                    '\n## Git Branches\nEach manager works on their own branch and merges back to main when ready.\n',
                    gitBranchSection
                );
            } else if (!content.includes(`- ${managerBranch}`)) {
                content = content.replace(
                    '### Active Branches\n',
                    `### Active Branches\n- ${managerBranch} (${instanceId})\n`
                );
            }
            
            // Update manager status with branch info
            content = content.replace(
                `- ${instanceId} (branch: pending)`,
                `- ${instanceId} (branch: ${managerBranch})`
            );
            
            await fs.writeFile(markerFile, content);
        } catch (error) {
            console.warn(`Could not update marker file with git info: ${error.message}`);
        }
        
        // Phase 2: Commit all workspace files atomically
        try {
            // Check what files need to be committed
            const status = await sharedWorkspaceGitManager.gitCommand('status --porcelain', workspaceDir);
            const files = sharedWorkspaceGitManager.parseGitStatus(status.stdout);
            
            const workspaceFiles = files.filter(f => sharedWorkspaceGitManager.isWorkspaceGeneratedFile(f.filename));
            
            if (workspaceFiles.length > 0) {
                await sharedWorkspaceGitManager.commitWorkspaceFiles(workspaceDir, workspaceFiles);
                console.log(`Committed ${workspaceFiles.length} workspace files before branch creation`);
            }
        } catch (error) {
            console.warn(`Could not commit workspace files: ${error.message}`);
        }
        
        // Phase 3: Create manager git branch (working tree should now be clean)
        try {
            const branchResult = await sharedWorkspaceGitManager.createManagerBranch({
                instanceId,
                workspaceDir,
                taskDescription: context
            });
            managerBranch = branchResult.branchName;
            console.log(`Created/checked out manager branch: ${managerBranch}`);
        } catch (error) {
            throw new Error(`Manager branch creation failed: ${error.message}`);
        }
        
        return {
            enabled: true,
            managerBranch,
            workspaceDir,
            instanceId
        };
    }

    // Legacy method end
    async setupSharedWorkspaceLegacy(workspaceDir, instanceId, context = 'Manager collaboration task') {
        // ... existing implementation moved here for reference ...
        return {
            workspaceDir,
            managerBranch: null,
            isFirstManager
        };
    }
}