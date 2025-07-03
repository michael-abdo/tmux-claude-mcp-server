#!/usr/bin/env node

/**
 * Phase 1 Simple Mode
 * 
 * Implements the MVP approach from the architecture docs:
 * - Maximum 3 instances (1 Executive, 1 Manager, 1 Specialist)
 * - Sequential execution only
 * - Simple subprocess control without MCP
 * - Branch-per-specialist Git pattern
 * 
 * From docs: "Phase 1 doesn't need MCP at all"
 */

import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { TmuxInterface } from './tmux_interface.js';
import { buildClaudeMd } from './claude_md_builder.js';
import { gitBranchManager } from './git_branch_manager.js';
import { todoMonitor } from './todo_monitor.js';

const execAsync = promisify(exec);

export class Phase1SimpleMode {
    constructor() {
        this.tmux = new TmuxInterface();
        this.instances = new Map();
        this.maxInstances = 3;
        this.roles = ['executive', 'manager', 'specialist'];
    }

    /**
     * Spawn instance using simple subprocess approach
     * @param {Object} options - Spawn options
     * @param {string} options.role - Instance role
     * @param {string} options.workDir - Working directory
     * @param {string} options.context - Context for CLAUDE.md
     * @param {string} options.parentId - Parent instance ID
     * @returns {Promise<Object>} Instance information
     */
    async spawnSimple(options) {
        const { role, workDir, context, parentId } = options;
        
        // Check instance limit
        if (this.instances.size >= this.maxInstances) {
            throw new Error(`Phase 1 limit reached: Maximum ${this.maxInstances} instances`);
        }
        
        // Generate instance ID
        const instanceId = this.generateInstanceId(role, parentId);
        const projectDir = path.join(workDir, instanceId);
        const sessionName = `claude_${instanceId}`;
        
        try {
            // Create project directory
            await fs.mkdir(projectDir, { recursive: true });
            
            // Write CLAUDE.md using canonical builder
            const claudeContent = buildClaudeMd(role, instanceId, projectDir, parentId, context);
            await fs.writeFile(path.join(projectDir, 'CLAUDE.md'), claudeContent);
            
            // Create Git branch for specialists
            let branchName = null;
            if (role === 'specialist') {
                const taskId = `task-${Date.now()}`;
                const feature = 'implementation';
                
                branchName = await gitBranchManager.createSpecialistBranch({
                    instanceId,
                    taskId,
                    feature,
                    workDir: projectDir
                });
            }
            
            // Create tmux session
            await this.tmux.createSession(sessionName, projectDir);
            
            // Launch Claude using subprocess
            const paneTarget = this.tmux.getPaneTarget(sessionName);
            await this.launchClaudeSimple(paneTarget, projectDir);
            
            // Start todo monitoring
            todoMonitor.startMonitoring(instanceId, projectDir);
            
            // Store instance info
            const instance = {
                instanceId,
                role,
                parentId,
                sessionName,
                projectDir,
                paneTarget,
                branchName,
                created: new Date().toISOString(),
                children: []
            };
            
            this.instances.set(instanceId, instance);
            
            // Update parent's children
            if (parentId) {
                const parent = this.instances.get(parentId);
                if (parent) {
                    parent.children.push(instanceId);
                }
            }
            
            console.log(`[Phase 1] Created ${role} instance: ${instanceId}`);
            
            return {
                instanceId,
                sessionName,
                projectDir,
                branchName
            };
            
        } catch (error) {
            console.error(`[Phase 1] Failed to spawn instance: ${error.message}`);
            throw error;
        }
    }

    /**
     * Launch Claude without MCP
     * @param {string} paneTarget - Tmux pane target
     * @param {string} projectDir - Project directory
     */
    async launchClaudeSimple(paneTarget, projectDir) {
        // Set Claude configuration
        await this.tmux.sendKeys(paneTarget, `claude config set hasTrustDialogAccepted true`, true);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Launch Claude with correct flags
        await this.tmux.sendKeys(paneTarget, `claude --dangerously-skip-permissions`, true);
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    /**
     * Send command to instance
     * @param {string} instanceId - Instance ID
     * @param {string} text - Text to send
     */
    async sendToInstance(instanceId, text) {
        const instance = this.instances.get(instanceId);
        if (!instance) {
            throw new Error(`Instance not found: ${instanceId}`);
        }
        
        await this.tmux.sendKeys(instance.paneTarget, text, true);
    }

    /**
     * Read output from instance
     * @param {string} instanceId - Instance ID
     * @param {number} lines - Number of lines to read
     * @returns {Promise<string>} Output text
     */
    async readFromInstance(instanceId, lines = 50) {
        const instance = this.instances.get(instanceId);
        if (!instance) {
            throw new Error(`Instance not found: ${instanceId}`);
        }
        
        const output = await this.tmux.capturePane(instance.paneTarget, lines);
        return output;
    }

    /**
     * Generate instance ID
     * @param {string} role - Instance role
     * @param {string} parentId - Parent ID
     * @returns {string} Instance ID
     */
    generateInstanceId(role, parentId) {
        if (role === 'executive') {
            return 'exec_1';
        } else if (role === 'manager') {
            return 'mgr_1_1';
        } else if (role === 'specialist') {
            return 'spec_1_1_1';
        }
    }


    /**
     * List all instances
     * @returns {Array} List of instances
     */
    listInstances() {
        return Array.from(this.instances.values());
    }

    /**
     * Terminate instance
     * @param {string} instanceId - Instance ID
     * @param {boolean} cascade - Terminate children
     */
    async terminateInstance(instanceId, cascade = false) {
        const instance = this.instances.get(instanceId);
        if (!instance) {
            throw new Error(`Instance not found: ${instanceId}`);
        }
        
        // Terminate children first if cascade
        if (cascade && instance.children.length > 0) {
            for (const childId of instance.children) {
                await this.terminateInstance(childId, true);
            }
        }
        
        // Stop todo monitoring
        todoMonitor.stopMonitoring(instanceId);
        
        // Kill tmux session
        await this.tmux.killSession(instance.sessionName);
        
        // Remove from parent's children
        if (instance.parentId) {
            const parent = this.instances.get(instance.parentId);
            if (parent) {
                parent.children = parent.children.filter(id => id !== instanceId);
            }
        }
        
        // Remove instance
        this.instances.delete(instanceId);
        
        console.log(`[Phase 1] Terminated instance: ${instanceId}`);
    }

    /**
     * Get instance progress
     * @param {string} instanceId - Instance ID
     * @returns {Object} Progress information
     */
    getProgress(instanceId) {
        return todoMonitor.getProgress(instanceId);
    }

    /**
     * Demo workflow for Phase 1
     */
    async runDemo() {
        console.log('=== Phase 1 Simple Mode Demo ===');
        
        try {
            // Spawn Executive
            const exec = await this.spawnSimple({
                role: 'executive',
                workDir: './phase1-demo',
                context: 'You are the Executive. Plan a simple hello world web app.'
            });
            
            await this.sendToInstance(exec.instanceId, 'Plan a hello world web app with Express.js');
            
            // Wait and spawn Manager
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            const mgr = await this.spawnSimple({
                role: 'manager',
                workDir: './phase1-demo',
                context: 'You are the Manager. Coordinate implementation of the hello world app.',
                parentId: exec.instanceId
            });
            
            await this.sendToInstance(mgr.instanceId, 'Break down the hello world app into tasks');
            
            // Wait and spawn Specialist
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            const spec = await this.spawnSimple({
                role: 'specialist',
                workDir: './phase1-demo',
                context: 'You are the Specialist. Implement the hello world Express.js app.',
                parentId: mgr.instanceId
            });
            
            await this.sendToInstance(spec.instanceId, 'Create the Express.js hello world app');
            
            console.log('\nInstances created:');
            this.listInstances().forEach(inst => {
                console.log(`- ${inst.role}: ${inst.instanceId} (branch: ${inst.branchName || 'main'})`);
            });
            
        } catch (error) {
            console.error('Demo failed:', error);
        }
    }
}

// Export singleton
export const phase1Mode = new Phase1SimpleMode();

// Run demo if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    phase1Mode.runDemo().catch(console.error);
}